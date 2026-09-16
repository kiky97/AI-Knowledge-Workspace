import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.document import DocumentStatus


class DocumentRead(BaseModel):
    id: uuid.UUID
    title: str
    file_type: str
    status: DocumentStatus
    error_message: str | None = None
    page_count: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
