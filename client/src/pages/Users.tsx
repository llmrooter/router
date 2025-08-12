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
      <h2 className="text-xl font-semibold mb-3">Users</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
          <h3 className="font-medium mb-2">Add User</h3>
          <div className="space-y-3">
            <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <select className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm" onClick={create} disabled={!form.email || !form.password}>Create</button>
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-2">Existing</h3>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50"><tr><th className="text-left p-2">ID</th><th className="text-left p-2">Username</th><th className="text-left p-2">Role</th><th className="text-left p-2">Disabled</th><th className="text-left p-2">Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2">{u.id}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.role}</td>
                    <td className="p-2">{String(u.disabled)}</td>
                    <td className="p-2">
                      <button className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs mr-2" onClick={() => setEdit({ ...u, newPassword: '' })}>Edit</button>
                      {u.email !== 'admin' && <button className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs" onClick={() => del(u.id)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edit && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow mt-3">
              <h4 className="font-medium mb-2">Edit User #{edit.id}</h4>
              <div className="flex flex-wrap gap-3 items-center text-sm">
                <label className="text-slate-500">Role</label>
                <select className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <label className="text-slate-500">Disabled</label>
                <input type="checkbox" checked={!!edit.disabled} onChange={e => setEdit({ ...edit, disabled: e.target.checked })} />
                <label className="text-slate-500">New Password</label>
                <input className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5" type="password" value={edit.newPassword} onChange={e => setEdit({ ...edit, newPassword: e.target.value })} placeholder="Leave blank to keep" />
                <button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2" onClick={saveEdit}>Save</button>
                <button className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2" onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
