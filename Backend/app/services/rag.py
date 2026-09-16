import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus
from app.services.chunking import chunk_text, extract_pdf_text
from app.services.llm import embed_texts


async def ingest_document(db: AsyncSession, document: Document) -> None:
    try:
        document.status = DocumentStatus.PROCESSING
        await db.commit()

        if document.file_type == "pdf":
            pages = extract_pdf_text(document.file_path)
            document.page_count = len(pages)
        else:
            with open(document.file_path, "r", encoding="utf-8") as f:
                pages = [(None, f.read())]

        pending_chunks: list[tuple[int, str, int | None]] = []
        index = 0
        for page_number, page_text in pages:
            for piece in chunk_text(page_text):
                pending_chunks.append((index, piece, page_number))
                index += 1

        if not pending_chunks:
            document.status = DocumentStatus.FAILED
            document.error_message = "No extractable text found in document"
            await db.commit()
            return

        embeddings = await embed_texts([c[1] for c in pending_chunks])

        for (chunk_index, content, page_number), embedding in zip(pending_chunks, embeddings):
            db.add(
                Chunk(
                    document_id=document.id,
                    chunk_index=chunk_index,
                    content=content,
                    page_number=page_number,
                    embedding=embedding,
                )
            )

        document.status = DocumentStatus.READY
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        document.status = DocumentStatus.FAILED
        document.error_message = str(exc)
        await db.commit()


async def retrieve_relevant_chunks(
    db: AsyncSession,
    query_embedding: list[float],
    document_ids: list[uuid.UUID] | None = None,
    top_k: int = 5,
) -> list[Chunk]:
    stmt = (
        select(Chunk)
        .options(selectinload(Chunk.document))
        .order_by(Chunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    if document_ids:
        stmt = stmt.where(Chunk.document_id.in_(document_ids))

    result = await db.execute(stmt)
    return list(result.scalars().all())
