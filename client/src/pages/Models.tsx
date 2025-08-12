import React from 'react'
import { api } from '../api'

function parseModelId(id: string) {
  const match = id.match(/^(gpt-\d+(?:\.\d+)?(?:-[a-z]+)?)(?:-(.+))?$/i)
  if (match) {
    return { family: match[1], version: match[2] || "" }
  }
  return { family: id, version: "" }
}

function familyRank(family: string) {
  if (family.startsWith("gpt-5")) return 500
  if (family.startsWith("gpt-4")) return 400
  if (family.startsWith("gpt-3.5")) return 350
  if (family.startsWith("gpt-3")) return 300
  return 0
}

function compareModels(a: string, b: string) {
  const isFtA = a.startsWith("ft:");
  const isFtB = b.startsWith("ft:");
  if (isFtA && !isFtB) return 1;
  if (!isFtA && isFtB) return -1;
  const pa = parseModelId(a)
  const pb = parseModelId(b)
  const ra = familyRank(pa.family)
  const rb = familyRank(pb.family)
  if (ra !== rb) return rb - ra
  if (pa.family !== pb.family) return pa.family.localeCompare(pb.family)
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

export default function Models() {
  const [providers, setProviders] = React.useState<any[]>([])
  const [q, setQ] = React.useState('')
  const [providerFilter, setProviderFilter] = React.useState<string>('all')
  const [copied, setCopied] = React.useState<string>('')

  React.useEffect(() => { api('/providers').then(setProviders).catch(() => setProviders([])) }, [])

  function copy(id: string) {
    navigator.clipboard?.writeText(id).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(''), 1200)
    }).catch(() => {})
  }

  const enabledProviders = providers.filter((p:any) => p.enabled)
  const providerOptions = [{ id: 'all', name: 'All providers' }, ...enabledProviders.map((p:any) => ({ id: String(p.id), name: p.name }))]

  const filteredByProvider = (p:any) => providerFilter === 'all' || String(p.id) === providerFilter

  function filterModels(list: string[]): string[] {
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(m => m.toLowerCase().includes(term))
  }
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Models</h2>
      <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow text-sm">
        Models are pulled from providers and kept in memory. This list refreshes on startup and when providers are edited.
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          placeholder="Search models (e.g., gpt-4)"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
        >
          {providerOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
        <div className="ml-auto text-sm text-slate-600 dark:text-slate-400">
          {(() => {
            let total = 0
            providers.forEach((p:any) => { if (p.enabled) total += (p.runtime_models?.length || 0) })
            return <>Total models: <span className="font-medium">{total}</span></>
          })()}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {enabledProviders.filter(filteredByProvider).map((p:any) => {
          let pulled: string[] = p.runtime_models || []
          pulled = filterModels(pulled)
          if (!pulled.length) return null
          const sorted = [...pulled].sort(compareModels)
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{p.name}</h3>
                <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1">{sorted.length}</span>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0"><tr><th className="text-left p-2">Model</th><th className="text-right p-2">Actions</th></tr></thead>
                  <tbody>
                    {sorted.map((name:string) => (
                      <tr key={name} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-2 font-mono text-[12px]">{name}</td>
                        <td className="p-2 text-right">
                          <button
                            className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
                            onClick={() => copy(name)}
                            title="Copy model id"
                          >
                            {copied === name ? 'Copied' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {enabledProviders.filter(filteredByProvider).every((p:any) => !filterModels(p.runtime_models || []).length) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow text-sm text-slate-500 mt-3">
          No models match your filters.
        </div>
      )}
    </div>
  )
}
