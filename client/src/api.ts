export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    let err
    try { err = await res.json() } catch { err = { error: res.statusText } }
    throw new Error(err.message || err.error || 'Request failed')
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const Auth = {
  login: (email: string, password: string) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => api('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
}

export const Account = {
  get: () => api('/account'),
  update: (data: { email?: string, current_password?: string, new_password?: string }) => api('/account', { method: 'PUT', body: JSON.stringify(data) }),
}

// OpenAI-compatible v1 endpoints (require user API key)
export const V1 = {
  chatSession: async (payload: any) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const t = await res.text(); try { const j = JSON.parse(t); throw new Error(j.error || j.message || 'Request failed') } catch { throw new Error(t || 'Request failed') }
    }
    return res.json()
  }
}
