import tiktoken

from app.core.config import settings

_encoding = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str, chunk_size: int = settings.CHUNK_SIZE, overlap: int = settings.CHUNK_OVERLAP) -> list[str]:
    tokens = _encoding.encode(text)
    if not tokens:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunks.append(_encoding.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start = end - overlap
    return chunks


def extract_pdf_text(file_path: str) -> list[tuple[int, str]]:
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
