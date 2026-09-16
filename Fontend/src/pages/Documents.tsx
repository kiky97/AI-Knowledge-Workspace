import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/Layout'
import { api } from '../lib/api'

interface DocumentItem {
  id: string
  title: string
  file_type: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  error_message: string | null
  page_count: number | null
  created_at: string
}

export function Documents() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadDocuments() {
    const { data } = await api.get<DocumentItem[]>('/api/documents')
    setDocuments(data)
  }

  useEffect(() => {
    loadDocuments()
    const interval = setInterval(loadDocuments, 4000)
    return () => clearInterval(interval)
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadDocuments()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/documents/${id}`)
    await loadDocuments()
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Documents</h1>
        <label className="upload-button">
          {uploading ? 'Uploading…' : 'Upload PDF / Markdown'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.markdown"
            onChange={handleFileChange}
            disabled={uploading}
            hidden
          />
        </label>
      </div>

      <table className="doc-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Pages</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.title}</td>
              <td>{doc.file_type}</td>
              <td>
                <span className={`status status-${doc.status}`}>{doc.status}</span>
                {doc.status === 'failed' && doc.error_message && (
                  <span className="error-hint" title={doc.error_message}>
                    ⚠
                  </span>
                )}
              </td>
              <td>{doc.page_count ?? '—'}</td>
              <td>
                <button className="link-button" onClick={() => handleDelete(doc.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                No documents yet. Upload a PDF or Markdown file to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Layout>
  )
}
