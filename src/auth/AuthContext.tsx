import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  username: string
  phone?: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>
  register: (username: string, phone: string, password: string) => Promise<void>
  logout: () => void
  getToken: () => string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('dhruva_token')
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(user => setState({ user, token, loading: false }))
        .catch(() => {
          localStorage.removeItem('dhruva_token')
          setState({ user: null, token: null, loading: false })
        })
    } else {
      setState({ user: null, token: null, loading: false })
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('dhruva_token', data.token)
    setState({ user: { id: data.user_id, username: data.username }, token: data.token, loading: false })
  }

  const register = async (username: string, phone: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, phone, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Registration failed')
    }
    const data = await res.json()
    localStorage.setItem('dhruva_token', data.token)
    setState({ user: { id: data.user_id, username: data.username, phone: data.phone }, token: data.token, loading: false })
  }

  const logout = () => {
    localStorage.removeItem('dhruva_token')
    setState({ user: null, token: null, loading: false })
  }

  const getToken = () => state.token

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
