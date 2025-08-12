import React from 'react'
import { Account as AccountAPI } from '../api'

export default function Account({ me, onUpdated }: { me: any, onUpdated: () => void }) {
  const [data, setData] = React.useState<any>({})
  const [email, setEmail] = React.useState(me?.email || '')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [savingEmail, setSavingEmail] = React.useState(false)
  const [savingPw, setSavingPw] = React.useState(false)
  const [showPw, setShowPw] = React.useState(false)

  React.useEffect(() => { AccountAPI.get().then(setData).catch(() => {}) }, [])

  async function saveEmail() {
    setMsg(null); setErr(null)
    setSavingEmail(true)
    try {
      await AccountAPI.update({ email })
      setMsg('Email updated.')
    } catch (e:any) { setErr(e.message) }
    finally { setSavingEmail(false) }
  }

  async function savePassword() {
    setMsg(null); setErr(null)
    setSavingPw(true)
    try {
      await AccountAPI.update({ current_password: currentPassword, new_password: newPassword })
      setMsg('Password updated.')
      onUpdated()
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e:any) { setErr(e.message) }
    finally { setSavingPw(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Account</h2>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-200 dark:bg-indigo-800 grid place-items-center text-indigo-900 dark:text-indigo-100 text-sm font-semibold">
            {String(me?.email || '?').slice(0,1).toUpperCase()}
          </div>
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-400">User ID: {data.id}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Role: {data.role}</div>
          </div>
        </div>
        {data.role === 'admin' && data.must_change_password && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300 px-3 py-2">
            Please change your password before using LLM Router.
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
          <h3 className="font-medium mb-2">Update Email</h3>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Email</label>
            <input
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
            />
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"
                onClick={saveEmail}
                disabled={!email || savingEmail}
                aria-busy={savingEmail}
              >
                {savingEmail ? 'Saving…' : 'Save Email'}
              </button>
              {email !== me?.email && <span className="text-xs text-slate-500">Pending change from {me?.email}</span>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 shadow">
          <h3 className="font-medium mb-2">Change Password</h3>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Current password</label>
            <input
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Current password"
              type={showPw ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <label className="text-xs text-slate-500">New password</label>
            <input
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New password"
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <label className="text-xs text-slate-500">Confirm new password</label>
            <input
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm new password"
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => setShowPw(v => !v)}>
                {showPw ? 'Hide passwords' : 'Show passwords'}
              </button>
              <span>At least 8 characters recommended</span>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <div className="rounded-md border border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300 px-3 py-2 text-sm">
                New password and confirmation do not match.
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"
                onClick={savePassword}
                disabled={!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword || savingPw}
                aria-busy={savingPw}
              >
                {savingPw ? 'Saving…' : 'Save Password'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="mt-3 rounded-md border border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-2 text-sm">{msg}</div>}
      {err && <div className="mt-3 rounded-md border border-red-300/70 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-300 px-3 py-2 text-sm">{err}</div>}
    </div>
  )
}
