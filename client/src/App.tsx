import React from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Auth } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Providers from './pages/Providers'
import Models from './pages/Models'
import Users from './pages/Users'
import Keys from './pages/Keys'
import Account from './pages/Account'
import Chat from './pages/Chat'

function useMe() {
  const [me, setMe] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    Auth.me().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false))
  }, [])
  return { me, loading, setMe }
}

function Layout() {
  const { me, loading, setMe } = useMe()
  const nav = useNavigate()
  const loc = useLocation()
  // Determine requirement before returns
  const mustChange = me?.role === 'admin' && me?.must_change_password
  // Ensure hook is always called (no conditional returns before this)
  React.useEffect(() => {
    if (mustChange && loc.pathname !== '/account') {
      nav('/account')
    }
  }, [mustChange, loc.pathname, nav])
  if (loading) return <div className="p-6">Loading...</div>
  if (!me) return <Login onLoggedIn={(u) => { setMe(u); nav('/') }} />
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">LLM Router</h3>
        </div>
        <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <button
            onClick={() => nav('/account')}
            title="View account"
            className="underline decoration-dotted underline-offset-2 hover:text-brand"
          >
            {me.email}
          </button>
          <span className="ml-1">({me.role})</span>
        </div>
        <nav className="mt-5 flex flex-col gap-1">
          {!mustChange && <>
            <NavLink to="/" end className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 0h11v8H10v-8z"/></svg>
              Dashboard
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v10H5.17L4 15.17V4zm0 14h12v2H4v-2z"/></svg>
              Chat
            </NavLink>
            <NavLink to="/models" className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l9-4 9 4v6l-9 4-9-4V7zm9 2l6-2.67L12 3 6 6.33 12 9z"/></svg>
              Models
            </NavLink>
            <NavLink to="/keys" className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10A5 5 0 1020 5a5 5 0 00-7.35 5zM2 20l7-7 2 2-7 7H2v-2z"/></svg>
              API Keys
            </NavLink>
            {me.role === 'admin' && <>
              <NavLink to="/providers" className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19a4 4 0 010-8 5 5 0 019.58-1.36A4.5 4.5 0 1118.5 19H6z"/></svg>
                Providers
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-indigo-50 text-brand ring-1 ring-inset ring-indigo-100 dark:bg-slate-800/60 dark:text-indigo-300 dark:ring-slate-700' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                Users
              </NavLink>
            </>}
          </>}
          <button onClick={async (e) => { e.preventDefault(); await Auth.logout(); window.location.href='/' }}
            className="mt-3 text-left px-3 py-2 rounded-lg text-sm hover:bg-red-50 text-red-600 dark:hover:bg-red-900/30">
            Logout
          </button>
        </nav>
      </aside>
      <main className="p-5 md:p-8">
        <Routes>
          <Route path="/account" element={<Account onUpdated={() => { setMe({ ...me, must_change_password: false }) }} me={me} />} />
          {!mustChange && <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/keys" element={<Keys />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/models" element={<Models />} />
            <Route path="/users" element={<Users />} />
          </>}
          {mustChange && <Route path="*" element={<Account onUpdated={() => { setMe({ ...me, must_change_password: false }) }} me={me} />} />}
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <Layout />
}
