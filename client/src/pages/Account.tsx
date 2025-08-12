import React from 'react'
import { Account as AccountAPI } from '../api'

export default function Account({ me, onUpdated }: { me: any, onUpdated: () => void }) {
  const [data, setData] = React.useState<any>({})
  const [email, setEmail] = React.useState(me?.email || '')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => { AccountAPI.get().then(setData).catch(() => {}) }, [])

  async function saveEmail() {
    setMsg(null); setErr(null)
    try {
      await AccountAPI.update({ email })
      setMsg('Email updated.')
    } catch (e:any) { setErr(e.message) }
  }

  async function savePassword() {
    setMsg(null); setErr(null)
    try {
      await AccountAPI.update({ current_password: currentPassword, new_password: newPassword })
      setMsg('Password updated.')
      onUpdated()
      setCurrentPassword(''); setNewPassword('')
    } catch (e:any) { setErr(e.message) }
  }

  return (
    <div>
      <h2>Account</h2>
      <div style={{ marginBottom: 8, color: '#555' }}>
        <div>User ID: {data.id}</div>
        <div>Role: {data.role}</div>
        {data.role === 'admin' && data.must_change_password && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            color: '#856404',
            padding: '8px 12px',
            borderRadius: 6,
            marginTop: 8,
          }}>
            Please change your password before using LLM Router.
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Update Email</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={saveEmail} disabled={!email}>Save Email</button>
          </div>
        </div>
        <div>
          <h3>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Current password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <input placeholder="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button onClick={savePassword} disabled={!currentPassword || newPassword.length < 6}>Save Password</button>
          </div>
        </div>
      </div>
      {msg && <div style={{ marginTop: 12, color: 'green' }}>{msg}</div>}
      {err && <div style={{ marginTop: 12, color: 'red' }}>{err}</div>}
    </div>
  )
}
