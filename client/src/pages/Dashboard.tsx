import React from 'react'
import { api } from '../api'

export default function Dashboard() {
  const [stats, setStats] = React.useState<any>(null)
  React.useEffect(() => { api('/stats/me').then(setStats).catch(() => setStats(null)) }, [])
  return (
    <div>
      <h2>Dashboard</h2>
      {stats ? (
        <ul>
          <li>Requests: {stats.requests}</li>
          <li>Avg Latency (ms): {stats.avg_ms}</li>
          <li>Prompt Tokens: {stats.tokens_in}</li>
          <li>Completion Tokens: {stats.tokens_out}</li>
        </ul>
      ) : <div>No stats yet.</div>}
      <p>Use your API key with OpenAI-compatible endpoints at <code>/api/v1</code>.</p>
    </div>
  )
}

