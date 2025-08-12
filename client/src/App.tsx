import React from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
  if (loading) return <div style={{ padding: 20 }}>Loading...</div>
  if (!me) return <Login onLoggedIn={(u) => { setMe(u); nav('/') }} />
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, borderRight: '1px solid #ddd', padding: 16 }}>
        <h3>LLM Router</h3>
        <div style={{ margin: '12px 0', color: '#555' }}>
          <button
            onClick={() => nav('/account')}
            title="View account"
            style={{ background: 'none', border: 'none', padding: 0, color: '#06c', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {me.email}
          </button> ({me.role})
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!mustChange && <>
            <Link to="/">Dashboard</Link>
            <Link to="/chat">Chat</Link>
            <Link to="/models">Models</Link>
            <Link to="/keys">API Keys</Link>
            {me.role === 'admin' && <>
              <Link to="/providers">Providers</Link>
              <Link to="/users">Users</Link>
            </>}
          </>}
          <a href="#" onClick={async (e) => { e.preventDefault(); await Auth.logout(); window.location.href='/' }}>Logout</a>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 16 }}>
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
