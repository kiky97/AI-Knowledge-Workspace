import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/Layout'
import { useAuthStore } from '../store/auth'

interface ToolEvent {
  name: string
  arguments?: Record<string, unknown>
  result?: unknown
}

interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  tools?: ToolEvent[]
}

export function Agent() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '', tools: [] }])
    setStreaming(true)

    const token = useAuthStore.getState().token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

    const response = await fetch(`${baseUrl}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
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

        setMessages((prev) => {
          const next = [...prev]
          const last = { ...next[next.length - 1] }
          last.tools = last.tools ? [...last.tools] : []

          if (eventType === 'tool_call') {
            last.tools.push({ name: data.name, arguments: data.arguments })
          } else if (eventType === 'tool_result') {
            const idx = [...last.tools].reverse().findIndex((t) => t.name === data.name && t.result === undefined)
            if (idx !== -1) {
              const realIdx = last.tools.length - 1 - idx
              last.tools[realIdx] = { ...last.tools[realIdx], result: data.result }
            }
          } else if (eventType === 'token') {
            last.content += data.text
          }

          next[next.length - 1] = last
          return next
        })
      }
    }

    setStreaming(false)
  }

  return (
    <Layout>
      <div className="chat-page">
        <div className="page-header">
          <h1>AI Agent</h1>
          <span className="muted">Calculator &amp; web search tools</span>
        </div>

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message message-${m.role}`}>
              {m.tools && m.tools.length > 0 && (
                <div className="tool-calls">
                  {m.tools.map((t, j) => (
                    <div key={j} className="tool-call">
                      <span className="tool-badge">{t.name === 'calculator' ? '🧮' : '🔍'} {t.name}</span>
                      <code>{JSON.stringify(t.arguments)}</code>
                      {t.result !== undefined && (
                        <pre className="tool-result">{JSON.stringify(t.result, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || (m.role === 'assistant' ? '…' : '')}</ReactMarkdown>
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
            placeholder="Ask something that needs a calculation or a web search…"
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
