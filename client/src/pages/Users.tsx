import React from 'react'
import { api } from '../api'

export default function Users() {
  const [users, setUsers] = React.useState<any[]>([])
  const [form, setForm] = React.useState<any>({ email: '', password: '', role: 'user' })
  const [edit, setEdit] = React.useState<any | null>(null)
  async function load() { setUsers(await api('/users')) }
  React.useEffect(() => { load() }, [])
  async function create() { await api('/users', { method: 'POST', body: JSON.stringify(form) }); setForm({ email: '', password: '', role: 'user' }); await load() }
  async function del(id: number) { await api(`/users/${id}`, { method: 'DELETE' }); await load() }
  async function saveEdit() {
    if (!edit) return
    const payload: any = {}
    if (edit.role) payload.role = edit.role
    if (typeof edit.disabled === 'boolean') payload.disabled = edit.disabled
    if (edit.newPassword) payload.password = edit.newPassword
    await api(`/users/${edit.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    setEdit(null)
    await load()
  }
  return (
    <div>
      <h2>Users</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Add User</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button onClick={create} disabled={!form.email || !form.password}>Create</button>
          </div>
        </div>
        <div>
          <h3>Existing</h3>
          <table>
            <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Disabled</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{String(u.disabled)}</td>
                  <td>
                    <button onClick={() => setEdit({ ...u, newPassword: '' })}>Edit</button>
                    {u.email !== 'admin' && <button onClick={() => del(u.id)} style={{ marginLeft: 8 }}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {edit && (
            <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
              <h4>Edit User #{edit.id}</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Role</label>
                <select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <label>Disabled</label>
                <input type="checkbox" checked={!!edit.disabled} onChange={e => setEdit({ ...edit, disabled: e.target.checked })} />
                <label>New Password</label>
                <input type="password" value={edit.newPassword} onChange={e => setEdit({ ...edit, newPassword: e.target.value })} placeholder="Leave blank to keep" />
                <button onClick={saveEdit}>Save</button>
                <button onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
