import React from 'react'
import { api } from '../api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = React.useState<any>(null)
  const [providers, setProviders] = React.useState<any[]>([])
  const [keys, setKeys] = React.useState<any[]>([])
  const [models, setModels] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      try {
        const [s, p, k, m] = await Promise.all([
          api('/stats/me').catch(() => null),
          api('/providers').catch(() => []),
          api('/keys').catch(() => []),
          api('/models').catch(() => []),
        ])
        setStats(s)
        setProviders(p || [])
        setKeys(k || [])
        setModels(m || [])
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const origin = (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080')
  const curlExample = `curl -sS -X POST \\
  "${origin}/api/v1/chat/completions" \\
  -H "Authorization: Bearer sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4.1",
    "messages": [{"role":"user","content":"Hello!"}]
  }'`

  React.useEffect(() => {
    const el = document.getElementById('quick-curl')?.querySelector('code')
    if (el) {
      el.textContent = curlExample
    }
  }, [curlExample])

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Overview of your usage and quick-start links.</p>
        </div>
        <div className="hidden md:flex gap-2">
          <Link to="/chat" className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm">Open Chat</Link>
          <Link to="/keys" className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">Manage Keys</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 shadow-card">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h6V3H3v10zm0 8h6v-6H3v6zm8 0h10V11H11v10zm0-18v6h10V3H11z"/></svg>
            Usage
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-slate-500">Requests</div>
              <div className="text-xl font-semibold">{stats ? stats.requests : '-'}</div>
            </div>
            <div>
              <div className="text-slate-500">Messages</div>
              <div className="text-xl font-semibold">{stats && typeof stats.messages !== 'undefined' ? stats.messages : '-'}</div>
            </div>
            <div>
              <div className="text-slate-500">Prompt tokens</div>
              <div className="text-xl font-semibold">{stats ? stats.tokens_in : '-'}</div>
            </div>
            <div>
              <div className="text-slate-500">Completion tokens</div>
              <div className="text-xl font-semibold">{stats ? stats.tokens_out : '-'}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 shadow-card">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z"/></svg>
            Avg latency (s)
          </div>
          <div className="text-3xl font-semibold">{(stats && typeof stats.avg_ms === 'number') ? (stats.avg_ms / 1000).toFixed(2) : '-'}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 shadow-card lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Quick start</h3>
            <Link to="/keys" className="text-sm text-indigo-600 hover:text-indigo-700">Manage keys →</Link>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Use OpenAI-compatible endpoints at <code>/api/v1</code>. Model must be <code>provider/model</code> (e.g., <code>openai/gpt-4.1</code>). URL below uses your current origin.</p>
          <pre id="quick-curl" className="text-xs overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3"><code>{`curl -sS -X POST \
  http://localhost:8080/api/v1/chat/completions \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4.1",
    "messages": [{"role":"user","content":"Hello!"}]
  }'`}</code></pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/chat" className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm">Try in Chat</Link>
            <Link to="/models" className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">View Models</Link>
          </div>
        </div>
      </div>

      {error && <div className="mt-3 rounded-md border border-red-300/70 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-300 px-3 py-2 text-sm">{error}</div>}
      {loading && <div className="mt-3 text-slate-500">Loading…</div>}
    </div>
  )
}
