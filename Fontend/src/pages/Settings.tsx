import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { api } from '../lib/api'

interface DailyUsage {
  day: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface EndpointUsage {
  endpoint: string
  total_tokens: number
}

interface UsageSummary {
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  by_day: DailyUsage[]
  by_endpoint: EndpointUsage[]
}

export function Settings() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)

  useEffect(() => {
    api.get<UsageSummary>('/api/usage/summary?days=30').then(({ data }) => setUsage(data))
  }, [])

  const maxDaily = usage ? Math.max(1, ...usage.by_day.map((d) => d.total_tokens)) : 1

  return (
    <Layout>
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Usage (last 30 days)</h2>
        {!usage ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="usage-stats">
              <div className="stat-tile">
                <span className="stat-value">{usage.total_tokens.toLocaleString()}</span>
                <span className="stat-label">Total tokens</span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{usage.prompt_tokens.toLocaleString()}</span>
                <span className="stat-label">Prompt tokens</span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{usage.completion_tokens.toLocaleString()}</span>
                <span className="stat-label">Completion tokens</span>
              </div>
            </div>

            {usage.by_day.length > 0 ? (
              <div className="usage-chart">
                {usage.by_day.map((d) => (
                  <div key={d.day} className="usage-bar-col" title={`${d.day}: ${d.total_tokens} tokens`}>
                    <div className="usage-bar" style={{ height: `${(d.total_tokens / maxDaily) * 100}%` }} />
                    <span className="usage-bar-label">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No usage yet — start a chat or ask the agent something.</p>
            )}

            {usage.by_endpoint.length > 0 && (
              <div className="usage-by-endpoint">
                {usage.by_endpoint.map((e) => (
                  <div key={e.endpoint} className="doc-chip">
                    {e.endpoint}: {e.total_tokens.toLocaleString()} tokens
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  )
}
