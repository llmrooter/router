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
  const controllerRef = React.useRef<AbortController | null>(null)
  const chatRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Highlight code blocks in rendered markdown
  React.useEffect(() => {
    const root = chatRef.current
    // @ts-ignore
    const hljs = (window as any).hljs
    if (!root || !hljs) return
    const blocks = root.querySelectorAll('pre code')
    blocks.forEach((b: Element) => {
      try { hljs.highlightElement(b) } catch {}
    })
  }, [messages])

  React.useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort()
    }
  }, [])

  React.useEffect(() => {
    api('/models').then((data:any[]) => {
      // server returns array of { provider_id, provider_name, name }
      // Build qualified ids: provider/name
      const qualified = data.map((m:any) => `${String(m.provider_name || '').toLowerCase()}/${m.name}`)
      // Do not de-duplicate by raw name; keep provider distinction

      // Custom sort based on the raw model id portion
      function parseModelId(id: string) {
        // Extracts family and version for sorting from the raw part
        // e.g. "gpt-4-0613" => { family: "gpt-4", version: "0613" }
        //      "gpt-3.5-turbo" => { family: "gpt-3.5-turbo", version: "" }
        //      "gpt-4" => { family: "gpt-4", version: "" }
        //      "gpt-5" => { family: "gpt-5", version: "" }
        //      "gpt-4-1106-preview" => { family: "gpt-4", version: "1106-preview" }
        const raw = id.includes('/') ? id.split('/', 2)[1] : id
        const match = raw.match(/^(gpt-\d+(?:\.\d+)?(?:-[a-z]+)?)(?:-(.+))?$/i)
        if (match) {
          return { family: match[1], version: match[2] || "" }
        }
        // fallback: treat the whole id as family
        return { family: raw, version: "" }
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
        const ar = a.includes('/') ? a.split('/',2)[1] : a
        const br = b.includes('/') ? b.split('/',2)[1] : b
        if (ar.length !== br.length) return ar.length - br.length
        return a.localeCompare(b)
      }

      qualified.sort(compareModels)
      const list = qualified.map((id:string) => ({ id }))
      setModels(list)
      if (!model && list.length) setModel(list[0].id)
    }).catch(() => setModels([]))
  }, [])

  async function send() {
    if (loading) return
    if (!model || !input.trim()) return
    setError(null)
    const userMsg: Msg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      // Streaming implementation
      const controller = new AbortController()
      controllerRef.current = controller
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
      controllerRef.current = null
    }
  }

  function stop() {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Chat</h2>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select disabled={loading} className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-60" value={model} onChange={e => setModel(e.target.value)}>
          {models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:opacity-60"
            onClick={() => setMessages([])}
            disabled={loading || messages.length === 0}
            title="Clear conversation"
          >
            Clear
          </button>
          {loading && (
            <button className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm" onClick={stop}>Stop</button>
          )}
        </div>
        {error && <div className="w-full rounded-md border border-red-300/70 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-300 px-3 py-2 text-sm">{error}</div>}
      </div>
      <div ref={chatRef} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 min-h-[360px] max-h-[60vh] overflow-auto bg-white/70 dark:bg-slate-900/60">
        {messages.length === 0 && (
          <div className="text-slate-500 text-sm">
            Start the conversation, or try: <span className="italic">“Summarize this text…”</span>
          </div>
        )}
        {messages.map((m, i) => {
          const you = m.role === 'user'
          const label = m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'You'
          return (
            <div key={i} className={`my-3 flex ${you ? 'justify-end' : 'justify-start'} items-end gap-2`}>
              {!you && <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-[10px] text-slate-700 dark:text-slate-200">AI</div>}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-card border ${you ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40' : 'bg-white/90 border-slate-200 dark:bg-slate-900/60 dark:border-slate-800'}`}>
                <div className={`mb-1 text-xs ${you ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}>{label}</div>
                <div
                  className="prose prose-slate prose-sm leading-7 dark:prose-invert prose-pre:bg-slate-50 dark:prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:p-3 prose-pre:overflow-x-auto prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:my-1"
                  dangerouslySetInnerHTML={{ __html: marked.parse(m.content || '') }}
                />
              </div>
              {you && <div className="h-7 w-7 shrink-0 rounded-full bg-indigo-200 dark:bg-indigo-800 grid place-items-center text-[10px] text-indigo-900 dark:text-indigo-100">You</div>}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 mt-2">
        <textarea
          rows={3}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
          placeholder={loading ? 'Generating…' : 'Type your message...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (loading) return
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">Press Enter to send • Shift+Enter for newline</div>
          <div className="flex items-center gap-2">
            {loading && (
              <button className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm" onClick={stop}>Stop</button>
            )}
            <button
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"
              onClick={send}
              disabled={!model || !input.trim() || loading}
              aria-busy={loading}
            >
              {loading ? 'Generating…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
