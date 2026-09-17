import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.note import Note
from app.models.user import User
from app.schemas.note import GraphEdge, GraphNode, GraphResponse, NoteCreate, NoteRead, NoteSummary, NoteUpdate
from app.services.notes import extract_linked_titles

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=list[NoteSummary])
async def list_notes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Note).where(Note.owner_id == current_user.id).order_by(Note.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    note = Note(owner_id=current_user.id, title=payload.title, content=payload.content)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def _get_owned_note(db: AsyncSession, note_id: uuid.UUID, user: User) -> Note:
    result = await db.execute(select(Note).where(Note.id == note_id, Note.owner_id == user.id))
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.get("/graph", response_model=GraphResponse)
async def get_graph(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Note).where(Note.owner_id == current_user.id))
    notes = list(result.scalars().all())

    title_to_id = {note.title.strip().lower(): str(note.id) for note in notes}
    nodes = [GraphNode(id=str(note.id), label=note.title) for note in notes]

    edges: list[GraphEdge] = []
    for note in notes:
        for linked_title in extract_linked_titles(note.content):
            target_id = title_to_id.get(linked_title.strip().lower())
            if target_id and target_id != str(note.id):
                edges.append(GraphEdge(source=str(note.id), target=target_id))

    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(
    note_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return await _get_owned_note(db, note_id, current_user)


@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await _get_owned_note(db, note_id, current_user)
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    note = await _get_owned_note(db, note_id, current_user)
    await db.delete(note)
    await db.commit()
