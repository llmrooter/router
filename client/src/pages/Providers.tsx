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
      <h2>Providers</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Add Provider</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="openai">OpenAI-compatible</option></select>
            <input placeholder="Base URL" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} />
            <input placeholder="API Key" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} />
            {/* Pull models is always on now */}
            <label><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
            <button onClick={create}>Save</button>
          </div>
        </div>
        <div>
          <h3>Existing</h3>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Enabled</th><th>Actions</th></tr></thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.type}</td>
                  <td>{String(p.enabled)}</td>
                  <td>
                    <button onClick={() => setEdit({ ...p })}>Edit</button>
                    <button onClick={() => del(p.id)} style={{ marginLeft: 8 }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {edit && (
            <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
              <h4>Edit Provider #{edit.id}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label>Name</label>
                <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                <label>Type</label>
                <select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })}>
                  <option value="openai">OpenAI-compatible</option>
                </select>
                <label>Base URL</label>
                <input value={edit.base_url} onChange={e => setEdit({ ...edit, base_url: e.target.value })} />
                <label>API Key (leave blank to keep)</label>
                <input value={edit.api_key || ''} onChange={e => setEdit({ ...edit, api_key: e.target.value })} />
                <label><input type="checkbox" checked={!!edit.enabled} onChange={e => setEdit({ ...edit, enabled: e.target.checked })} /> Enabled</label>
                <div>
                  <button onClick={saveEdit}>Save</button>
                  <button onClick={() => setEdit(null)} style={{ marginLeft: 8 }}>Cancel</button>
                </div>
                {edit.runtime_models && edit.runtime_models.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Pulled models ({edit.runtime_models.length}):</strong>
                    <div style={{ maxHeight: 150, overflow: 'auto', border: '1px solid #eee', padding: 6 }}>
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
