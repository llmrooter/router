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
      <h2>API Keys</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={create}>Create</button>
      </div>
      {newKey && <div style={{ padding: 8, background: '#eef', border: '1px solid #99f', marginBottom: 12 }}>
        New key (copy now, shown once): <code>{newKey}</code>
      </div>}
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Prefix</th><th>Actions</th></tr></thead>
        <tbody>
          {keys.map(k => (
            <tr key={k.id}><td>{k.id}</td><td>{k.name}</td><td>{k.prefix}</td><td><button onClick={() => del(k.id)}>Delete</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

