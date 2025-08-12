import React from 'react'
import { Auth } from '../api'

export default function Login({ onLoggedIn }: { onLoggedIn: (me: any) => void }) {
  const [email, setEmail] = React.useState('admin')
  const [password, setPassword] = React.useState('admin')
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await Auth.login(email, password)
      const me = await Auth.me()
      onLoggedIn(me)
    } catch (e: any) {
      setError(e.message || 'Login failed')
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={submit} style={{ width: 320, border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
        <h3>Login</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>Username</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        <button type="submit" style={{ marginTop: 12 }}>Login</button>
      </form>
    </div>
  )
}

