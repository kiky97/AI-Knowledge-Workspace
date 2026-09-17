import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.conversation import Conversation, Message, MessageRole
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.llm import embed_texts, stream_chat_completion
from app.services.rag import retrieve_relevant_chunks
from app.services.usage import log_usage

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = (
    "You are a knowledge assistant. Answer the user's question using only the provided "
    "context excerpts. Cite sources inline as [1], [2], etc. matching the excerpt numbers. "
    "If the context does not contain the answer, say so honestly."
)


@router.post("")
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.conversation_id is not None:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == payload.conversation_id, Conversation.owner_id == current_user.id
            )
        )
        conversation = result.scalar_one_or_none()
    else:
        conversation = None

    if conversation is None:
        conversation = Conversation(owner_id=current_user.id, title=payload.message[:80])
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    user_message = Message(conversation_id=conversation.id, role=MessageRole.USER, content=payload.message)
    db.add(user_message)
    await db.commit()

    [query_embedding], embedding_tokens = await embed_texts([payload.message])
    chunks = await retrieve_relevant_chunks(db, query_embedding, document_ids=payload.document_ids)

    context_block = "\n\n".join(
        f"[{i + 1}] (source: {chunk.document.title if chunk.document else 'unknown'}"
        f"{f', page {chunk.page_number}' if chunk.page_number else ''})\n{chunk.content}"
        for i, chunk in enumerate(chunks)
    )
    user_prompt = f"Context:\n{context_block}\n\nQuestion: {payload.message}"
    chat_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    citations = [
        {
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "document_title": chunk.document.title if chunk.document else "",
            "page_number": chunk.page_number,
            "snippet": chunk.content[:240],
        }
        for chunk in chunks
    ]

    async def event_stream():
        yield f"event: citations\ndata: {json.dumps(citations)}\n\n"

        full_response = ""
        prompt_tokens_total = embedding_tokens
        completion_tokens_total = 0
        async for event in stream_chat_completion(chat_messages):
            if event["type"] == "token":
                full_response += event["text"]
                yield f"event: token\ndata: {json.dumps({'text': event['text']})}\n\n"
            elif event["type"] == "usage":
                prompt_tokens_total += event["prompt_tokens"]
                completion_tokens_total += event["completion_tokens"]

        async with AsyncSessionLocal() as save_db:
            assistant_message = Message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                citation_chunk_ids=[chunk.id for chunk in chunks] or None,
            )
            save_db.add(assistant_message)
            await save_db.commit()

            await log_usage(
                save_db,
                current_user.id,
                endpoint="chat",
                model=settings.CHAT_MODEL,
                prompt_tokens=prompt_tokens_total,
                completion_tokens=completion_tokens_total,
            )

        yield f"event: done\ndata: {json.dumps({'conversation_id': str(conversation.id)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .join(Conversation)
        .where(Conversation.id == conversation_id, Conversation.owner_id == current_user.id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {"id": str(m.id), "role": m.role.value, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in messages
    ]
