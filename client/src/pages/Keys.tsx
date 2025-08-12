import React from 'react'
import { api } from '../api'

export default function Keys() {
  const [keys, setKeys] = React.useState<any[]>([])
  const [name, setName] = React.useState('default')
  const [newKey, setNewKey] = React.useState<string | null>(null)
  async function load() { setKeys(await api('/keys')) }
  React.useEffect(() => { load() }, [])
  async function create() {
    const res = await api('/keys', { method: 'POST', body: JSON.stringify({ name }) })
    setNewKey(res.value)
    await load()
  }
  async function del(id: number) {
    await api(`/keys/${id}`, { method: 'DELETE' })
    await load()
  }
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">API Keys</h2>
      <div className="flex gap-2 items-center mb-3">
        <input className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm" onClick={create}>Create</button>
      </div>
      {newKey && <div className="mb-3 rounded-md border border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-2 text-sm">New key (copy now, shown once): <code>{newKey}</code></div>}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Prefix</th><th className="text-left p-2">Actions</th></tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="p-2">{k.id}</td>
                <td className="p-2">{k.name}</td>
                <td className="p-2">{k.prefix}</td>
                <td className="p-2"><button className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs" onClick={() => del(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
