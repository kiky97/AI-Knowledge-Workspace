import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/Layout'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

interface DocumentItem {
  id: string
  title: string
  status: string
}

interface Citation {
  chunk_id: string
  document_id: string
  document_title: string
  page_number: number | null
  snippet: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

export function Chat() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<DocumentItem[]>('/api/documents').then(({ data }) => {
      setDocuments(data.filter((d) => d.status === 'ready'))
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)

    const token = useAuthStore.getState().token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: text,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
      }),
    })

    if (!response.body) {
      setStreaming(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const rawEvent of events) {
        const eventMatch = rawEvent.match(/^event: (\w+)/m)
        const dataMatch = rawEvent.match(/^data: (.*)$/m)
        if (!eventMatch || !dataMatch) continue

        const eventType = eventMatch[1]
        const data = JSON.parse(dataMatch[1])

        if (eventType === 'citations') {
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], citations: data }
            return next
          })
        } else if (eventType === 'token') {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            next[next.length - 1] = { ...last, content: last.content + data.text }
            return next
          })
        } else if (eventType === 'done') {
          setConversationId(data.conversation_id)
        }
      }
    }

    setStreaming(false)
  }

  return (
    <Layout>
      <div className="chat-page">
        <div className="doc-scope">
          <span>Scope:</span>
          {documents.length === 0 && <span className="muted">No ready documents yet</span>}
          {documents.map((doc) => (
            <label key={doc.id} className="doc-chip">
              <input
                type="checkbox"
                checked={selectedDocIds.includes(doc.id)}
                onChange={() => toggleDoc(doc.id)}
              />
              {doc.title}
            </label>
          ))}
        </div>

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message message-${m.role}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || '…'}</ReactMarkdown>
              {m.citations && m.citations.length > 0 && (
                <div className="citations">
                  {m.citations.map((c) => (
                    <div key={c.chunk_id} className="citation">
                      <strong>{c.document_title}</strong>
                      {c.page_number && <span> · p.{c.page_number}</span>}
                      <p>{c.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask a question about your documents…"
            disabled={streaming}
          />
          <button onClick={sendMessage} disabled={streaming || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </Layout>
  )
}
