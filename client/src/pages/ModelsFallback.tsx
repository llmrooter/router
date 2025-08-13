import React from 'react'
import { api } from '../api'

type Route = {
  id: number
  name: string
  enabled: boolean
  targets: { id: number, provider_id: number, model: string, position: number }[]
}

export default function ModelsFallback() {
  const [routes, setRoutes] = React.useState<Route[]>([])
  const [models, setModels] = React.useState<any[]>([])
  const [providers, setProviders] = React.useState<any[]>([])
  const [name, setName] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [deleteRoute, setDeleteRoute] = React.useState<Route | null>(null)

  React.useEffect(() => {
    refresh()
    api('/models').then(setModels).catch(() => setModels([]))
    api('/providers').then(setProviders).catch(() => setProviders([]))
  }, [])

  async function refresh() {
    const list = await api('/fallbacks').catch(() => [])
    setRoutes(list || [])
  }

  async function create() {
    if (!name.trim()) return
    setCreating(true)
    try {
      await api('/fallbacks', { method: 'POST', body: JSON.stringify({ name: name.trim(), enabled: true, targets: [] }) })
      setName('')
      await refresh()
    } finally { setCreating(false) }
  }

  function providerOptions() {
    // Build qualified ids from provider models (exclude router entries)
    return models.filter((m:any) => (m.provider_name || '').toLowerCase() !== 'router')
      .map((m:any) => ({ id: `${String(m.provider_name).toLowerCase()}/${m.name}` }))
  }

  async function addTarget(route: Route, qualified: string) {
    const next = [...route.targets.map(t => `${t.provider_id}`)] // placeholder
    // server accepts array of qualified ids; rebuild based on UI state
    const currentQualified = await targetsToQualified(route)
    const updated = [...currentQualified, qualified]
    await api(`/fallbacks/${route.id}`, { method: 'PUT', body: JSON.stringify({ targets: updated }) })
    await refresh()
  }

  async function move(route: Route, index: number, dir: number) {
    const current = await targetsToQualified(route)
    const j = index + dir
    if (j < 0 || j >= current.length) return
    const arr = [...current]
    const tmp = arr[index]; arr[index] = arr[j]; arr[j] = tmp
    await api(`/fallbacks/${route.id}`, { method: 'PUT', body: JSON.stringify({ targets: arr }) })
    await refresh()
  }

  async function removeTarget(route: Route, index: number) {
    const current = await targetsToQualified(route)
    current.splice(index, 1)
    await api(`/fallbacks/${route.id}`, { method: 'PUT', body: JSON.stringify({ targets: current }) })
    await refresh()
  }

  async function targetsToQualified(route: Route): Promise<string[]> {
    // Build map provider_id -> provider_name from providers list (authoritative), fallback to /models list
    const providerNameById = new Map<number, string>()
    providers.forEach((p:any) => { if (p.id && p.name) providerNameById.set(p.id, String(p.name).toLowerCase()) })
    if (providerNameById.size === 0) {
      models.forEach((m:any) => { if (m.provider_id && m.provider_name) providerNameById.set(m.provider_id, String(m.provider_name).toLowerCase()) })
    }
    return route.targets
      .sort((a,b) => a.position - b.position)
      .map(t => {
        const prov = providerNameById.get(t.provider_id)
        return prov ? `${prov}/${t.model}` : ''
      })
      .filter(s => !!s)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Models Fallback</h2>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
        <div className="text-sm mb-3 text-slate-600 dark:text-slate-400">Create router models (e.g., router/gpt-4.1) that fall back across providers.</div>
        <div className="flex gap-2 items-center mb-3">
          <input className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" placeholder="Route name (e.g., gpt-4.1)" value={name} onChange={e => setName(e.target.value)} />
          <button disabled={creating || !name.trim()} onClick={create} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm disabled:opacity-60">Create</button>
        </div>
        {routes.length === 0 && (
          <div className="text-sm text-slate-600 dark:text-slate-400">No fallback routes yet.</div>
        )}
        <div className="grid gap-3">
          {routes.map(route => (
            <div key={route.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                <div className="text-sm font-medium">router/{route.name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">{route.enabled ? 'enabled' : 'disabled'}</div>
                  <button
                    className={`rounded-md px-2 py-1 text-xs border ${route.enabled ? 'border-slate-300 dark:border-slate-700' : 'border-green-300 dark:border-green-700'} ${route.enabled ? '' : 'text-green-700 dark:text-green-300'}`}
                    onClick={async () => { await api(`/fallbacks/${route.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !route.enabled }) }); await refresh() }}
                  >
                    {route.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="rounded-md px-2 py-1 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300"
                    onClick={() => setDeleteRoute(route)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <select id={`add-${route.id}`} className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                    <option value="">Select target…</option>
                    {providerOptions().map(opt => <option key={opt.id} value={opt.id}>{opt.id}</option>)}
                  </select>
                  <button className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm" onClick={() => {
                    const sel = (document.getElementById(`add-${route.id}`) as HTMLSelectElement)
                    if (sel && sel.value) addTarget(route, sel.value)
                  }}>Add target</button>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50"><tr><th className="text-left p-2">Priority</th><th className="text-left p-2">Target</th><th className="text-right p-2">Actions</th></tr></thead>
                    <tbody>
                      {route.targets.sort((a,b) => a.position - b.position).map((t, idx) => {
                        const provider = models.find((m:any) => m.provider_id === t.provider_id)?.provider_name || t.provider_id
                        const qualified = `${String(provider).toLowerCase()}/${t.model}`
                        return (
                          <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800">
                            <td className="p-2 align-middle">{idx + 1}</td>
                            <td className="p-2 font-mono text-[12px]">{qualified}</td>
                            <td className="p-2 text-right">
                              <div className="inline-flex gap-1">
                                <button className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs" onClick={() => move(route, idx, -1)} disabled={idx === 0}>Up</button>
                                <button className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs" onClick={() => move(route, idx, 1)} disabled={idx === route.targets.length - 1}>Down</button>
                                <button className="rounded-md border border-red-300 dark:border-red-700 px-2 py-1 text-xs text-red-600 dark:text-red-300" onClick={() => removeTarget(route, idx)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {deleteRoute && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute inset-0 grid place-items-center p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-sm font-medium">Delete Fallback</div>
              <div className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete <span className="font-mono">router/{deleteRoute.name}</span>? This action cannot be undone.
              </div>
              <div className="px-4 py-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm" onClick={() => setDeleteRoute(null)}>Cancel</button>
                <button className="rounded-md border border-red-300 dark:border-red-700 bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm" onClick={async () => {
                  if (!deleteRoute) return
                  await api(`/fallbacks/${deleteRoute.id}`, { method: 'DELETE' })
                  setDeleteRoute(null)
                  await refresh()
                }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
