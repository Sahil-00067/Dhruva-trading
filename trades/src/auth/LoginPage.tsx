import { useState } from 'react'
import { useAuth } from './AuthContext'
import { cn } from '../lib/cn'

export function LoginPage() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(username, password)
      } else {
        if (!phone.match(/^\+?[0-9]{10,15}$/)) {
          throw new Error('Enter a valid phone number')
        }
        await register(username, phone, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-jade/5 via-transparent to-brass/5" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-jade/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brass/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-jade to-jade-deep mb-4">
            <span className="text-2xl font-display font-bold text-paper">D</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink-text">Dhruva</h1>
          <p className="mt-1 text-sm text-muted-l">Strategy Lab for Indian Markets</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-paper-3 bg-paper-2 shadow-soft p-6">
          {/* Toggle */}
          <div className="flex rounded-lg bg-paper-3 p-1 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError('') }}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                isLogin ? 'bg-paper-2 text-ink-text shadow-sm' : 'text-muted-l hover:text-ink-text',
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError('') }}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                !isLogin ? 'bg-paper-2 text-ink-text shadow-sm' : 'text-muted-l hover:text-ink-text',
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-l mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className="w-full rounded-lg border border-paper-3 bg-paper px-3 py-2.5 text-sm text-ink-text outline-none focus:border-jade/50 transition-colors"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-l mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full rounded-lg border border-paper-3 bg-paper px-3 py-2.5 text-sm text-ink-text outline-none focus:border-jade/50 transition-colors"
                />
                <p className="mt-1 text-xs text-muted-l">We'll send WhatsApp alerts to this number</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-l mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="w-full rounded-lg border border-paper-3 bg-paper px-3 py-2.5 text-sm text-ink-text outline-none focus:border-jade/50 transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-clay/30 bg-clay/5 px-3 py-2 text-xs text-clay">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-jade py-2.5 text-sm font-medium text-paper transition-colors hover:bg-jade-deep disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-l">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-jade hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-l">
          Educational tool with simulated data — not investment advice.
        </p>
      </div>
    </div>
  )
}
