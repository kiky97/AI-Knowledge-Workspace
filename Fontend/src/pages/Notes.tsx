import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/Layout'
import { api } from '../lib/api'

interface NoteSummary {
  id: string
  title: string
  updated_at: string
}

interface NoteDetail extends NoteSummary {
  content: string
  created_at: string
}

export function Notes() {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadNotes() {
    const { data } = await api.get<NoteSummary[]>('/api/notes')
    setNotes(data)
    return data
  }

  useEffect(() => {
    loadNotes()
  }, [])

  async function openNote(id: string) {
    const { data } = await api.get<NoteDetail>(`/api/notes/${id}`)
    setActiveNote(data)
    setTitle(data.title)
    setContent(data.content)
    setPreview(false)
  }

  async function createNote() {
    const { data } = await api.post<NoteDetail>('/api/notes', { title: 'Untitled note', content: '' })
    await loadNotes()
    setActiveNote(data)
    setTitle(data.title)
    setContent(data.content)
    setPreview(false)
  }

  async function saveNote() {
    if (!activeNote) return
    setSaving(true)
    try {
      const { data } = await api.patch<NoteDetail>(`/api/notes/${activeNote.id}`, { title, content })
      setActiveNote(data)
      await loadNotes()
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id: string) {
    await api.delete(`/api/notes/${id}`)
    if (activeNote?.id === id) setActiveNote(null)
    await loadNotes()
  }

  return (
    <Layout>
      <div className="notes-page">
        <div className="notes-list">
          <div className="page-header">
            <h1>Notes</h1>
            <button onClick={createNote}>New</button>
          </div>
          <Link to="/notes/graph" className="graph-link">
            View graph →
          </Link>
          <ul>
            {notes.map((note) => (
              <li key={note.id} className={activeNote?.id === note.id ? 'active' : ''}>
                <button className="note-item" onClick={() => openNote(note.id)}>
                  {note.title || 'Untitled'}
                </button>
                <button className="link-button" onClick={() => deleteNote(note.id)}>
                  ×
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="empty-state">No notes yet.</li>}
          </ul>
        </div>

        <div className="note-editor">
          {activeNote ? (
            <>
              <div className="editor-toolbar">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="title-input" />
                <button onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
                <button onClick={saveNote} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {preview ? (
                <div className="markdown-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  className="content-editor"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write in Markdown. Link other notes with [[Note Title]]."
                />
              )}
            </>
          ) : (
            <div className="empty-state">Select a note or create a new one.</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
