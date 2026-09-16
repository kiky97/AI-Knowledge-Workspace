import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.conversation import MessageRole


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str
    document_ids: list[uuid.UUID] | None = None


class Citation(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    page_number: int | None = None
    snippet: str


class MessageRead(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
