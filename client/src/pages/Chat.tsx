import React from 'react'
import { V1, api } from '../api'
import { marked } from 'marked'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

export default function Chat() {
  const [models, setModels] = React.useState<{ id: string }[]>([])
  const [model, setModel] = React.useState<string>('')
  const [messages, setMessages] = React.useState<Msg[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    api('/models').then((data:any[]) => {
      // server returns array of { provider_id, provider_name, name }
      const unique = Array.from(new Set(data.map((m:any) => m.name)))

      // Custom sort: prioritize gpt-5 > gpt-4 > gpt-3.5 > gpt-3, then by variant
      function parseModelId(id: string) {
        // Extracts family and version for sorting
        // e.g. "gpt-4-0613" => { family: "gpt-4", version: "0613" }
        //      "gpt-3.5-turbo" => { family: "gpt-3.5-turbo", version: "" }
        //      "gpt-4" => { family: "gpt-4", version: "" }
        //      "gpt-5" => { family: "gpt-5", version: "" }
        //      "gpt-4-1106-preview" => { family: "gpt-4", version: "1106-preview" }
        const match = id.match(/^(gpt-\d+(?:\.\d+)?(?:-[a-z]+)?)(?:-(.+))?$/i)
        if (match) {
          return { family: match[1], version: match[2] || "" }
        }
        // fallback: treat the whole id as family
        return { family: id, version: "" }
      }

      function parseGptVersion(family: string): number {
        // Extracts the numeric version from family, e.g. "gpt-4.1" => 4.1, "gpt-4" => 4, "gpt-3.5" => 3.5
        const m = family.match(/^gpt-(\d+(?:\.\d+)?)/)
        return m ? parseFloat(m[1]) : 0
      }

      function familyRank(family: string) {
        // Higher number = higher priority
        if (family.startsWith("gpt-")) return parseGptVersion(family) * 100
        // Add more as needed
        return 0
      }

      function compareModels(a: string, b: string) {
        const isFtA = a.startsWith("ft:");
        const isFtB = b.startsWith("ft:");
        if (isFtA && !isFtB) return 1;   // a goes after b
        if (!isFtA && isFtB) return -1;  // a goes before b
        // Both are or are not ft: models, continue with normal logic
        const pa = parseModelId(a)
        const pb = parseModelId(b)
        const ra = familyRank(pa.family)
        const rb = familyRank(pb.family)
        if (ra !== rb) return rb - ra // higher version first
        if (pa.family !== pb.family) return pa.family.localeCompare(pb.family)
        // Same family: shorter id (base) first, then lexicographically
        if (a.length !== b.length) return a.length - b.length
        return a.localeCompare(b)
      }

      unique.sort(compareModels)
      const list = unique.map((id:string) => ({ id }))
      setModels(list)
      if (!model && list.length) setModel(list[0].id)
    }).catch(() => setModels([]))
  }, [])

  async function send() {
    if (!model || !input.trim()) return
    setError(null)
    const userMsg: Msg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    let controller: AbortController | null = null
    try {
      // Streaming implementation
      controller = new AbortController()
      const resp = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: newMessages, stream: true }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        throw new Error('Streaming failed')
      }
      let assistantMsg = ''
      setMessages([...newMessages, { role: 'assistant', content: '' }])
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          // OpenAI-style SSE: lines start with "data: "
          const chunk = decoder.decode(value)
          // Split by newlines, handle each event
          chunk.split('\n').forEach(line => {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6)
              if (data === '[DONE]') return
              try {
                const delta = JSON.parse(data)
                // OpenAI: delta.choices[0].delta.content
                const token = delta?.choices?.[0]?.delta?.content
                if (token) {
                  assistantMsg += token
                  setMessages(msgs => {
                    const arr = [...msgs]
                    arr[arr.length - 1] = { role: 'assistant', content: assistantMsg }
                    return arr
                  })
                }
              } catch {}
            }
          })
        }
      }
    } catch (e: any) {
      setError(e.message || 'Request failed')
    } finally {
      setLoading(false)
      controller = null
    }
  }

  return (
    <div>
      <h2>Chat</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={model} onChange={e => setModel(e.target.value)}>
          {models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
        </select>
        {error && <span style={{ color: 'red' }}>{error}</span>}
      </div>
      <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, minHeight: 240, maxHeight: 400, overflow: 'auto' }}>
        {messages.length === 0 && <div style={{ color: '#777' }}>Start the conversation...</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'You'}:</strong>{' '}
            <span
              dangerouslySetInnerHTML={{
                __html: marked.parse(m.content || '')
              }}
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input style={{ flex: 1 }} placeholder="Type your message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button onClick={send} disabled={!model || !input.trim() || loading}>{loading ? 'Sending...' : 'Send'}</button>
      </div>
    </div>
  )
}
