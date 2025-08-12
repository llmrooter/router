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
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur p-6 shadow">
        <h3 className="text-lg font-semibold mb-4">Login</h3>
        <div className="grid gap-3">
          <label className="text-sm text-slate-600 dark:text-slate-400">Username</label>
          <input className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={e => setEmail(e.target.value)} />
          <label className="text-sm text-slate-600 dark:text-slate-400">Password</label>
          <input className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="mt-3 text-sm border border-red-300/60 dark:border-red-700 rounded-md px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>}
        <button type="submit" className="mt-4 inline-flex items-center justify-center rounded-md bg-brand hover:bg-brand-dark text-white px-4 py-2">Login</button>
      </form>
    </div>
  )
}
