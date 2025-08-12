import React from 'react'
import { api } from '../api'

type Provider = { id: number, name: string, type: string, base_url: string, enabled: boolean, runtime_models?: string[] }

export default function Providers() {
  const [providers, setProviders] = React.useState<Provider[]>([])
  const [form, setForm] = React.useState<any>({ name: '', type: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', enabled: true })
  const [edit, setEdit] = React.useState<any | null>(null)
  async function load() { setProviders(await api('/providers')) }
  React.useEffect(() => { load() }, [])
  async function create() {
    await api('/providers', { method: 'POST', body: JSON.stringify(form) })
    setForm({ name: '', type: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', enabled: true })
    await load()
  }
  async function del(id: number) { await api(`/providers/${id}`, { method: 'DELETE' }); await load() }
  async function saveEdit() {
    if (!edit) return
    const payload: any = { name: edit.name, type: edit.type, base_url: edit.base_url, enabled: !!edit.enabled }
    if (edit.api_key) payload.api_key = edit.api_key
    await api(`/providers/${edit.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    // Force refresh models after editing
    await api(`/providers/${edit.id}/refresh_models`, { method: 'POST' }).catch(() => {})
    setEdit(null)
    await load()
  }
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Providers</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
          <h3 className="font-medium mb-2">Add Provider</h3>
          <div className="space-y-3">
            <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="openai">OpenAI-compatible</option></select>
            <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Base URL" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} />
            <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="API Key" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
            <button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm" onClick={create}>Save</button>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Existing</h3>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50"><tr><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Type</th><th className="text-left p-2">Enabled</th><th className="text-left p-2">Actions</th></tr></thead>
              <tbody>
                {providers.map(p => (
                  <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2">{p.id}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.type}</td>
                    <td className="p-2">{String(p.enabled)}</td>
                    <td className="p-2">
                      <button className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs mr-2" onClick={() => setEdit({ ...p })}>Edit</button>
                      <button className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs" onClick={() => del(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edit && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow mt-3">
              <h4 className="font-medium mb-2">Edit Provider #{edit.id}</h4>
              <div className="space-y-3">
                <label className="text-xs text-slate-500">Name</label>
                <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                <label className="text-xs text-slate-500">Type</label>
                <select className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })}>
                  <option value="openai">OpenAI-compatible</option>
                </select>
                <label className="text-xs text-slate-500">Base URL</label>
                <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={edit.base_url} onChange={e => setEdit({ ...edit, base_url: e.target.value })} />
                <label className="text-xs text-slate-500">API Key (leave blank to keep)</label>
                <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={edit.api_key || ''} onChange={e => setEdit({ ...edit, api_key: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={!!edit.enabled} onChange={e => setEdit({ ...edit, enabled: e.target.checked })} /> Enabled</label>
                <div className="flex gap-2">
                  <button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm" onClick={saveEdit}>Save</button>
                  <button className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm" onClick={() => setEdit(null)}>Cancel</button>
                </div>
                {edit.runtime_models && edit.runtime_models.length > 0 && (
                  <div className="space-y-2">
                    <strong>Pulled models ({edit.runtime_models.length}):</strong>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 max-h-40 overflow-auto text-xs">
                      {edit.runtime_models.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
