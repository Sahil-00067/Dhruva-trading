import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ModeProvider } from './state/ModeProvider'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { Live } from './pages/Live'
import { Dashboard } from './pages/Dashboard'
import { Markets } from './pages/Markets'
import { Backtest } from './pages/Backtest'
import { Strategies } from './pages/Strategies'
import { MyStrategies } from './pages/MyStrategies'
import { StrategyDetail } from './pages/StrategyDetail'
import { Settings } from './pages/Settings'
import { VideoIntro } from './components/VideoIntro'

function ScrollToTop() {
  const { pathname } = { pathname: '' as string }
  return null
}

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  const [showIntro, setShowIntro] = useState(true)
  const skipPref = localStorage.getItem('dhruva_skip_intro')

  useEffect(() => {
    if (skipPref === 'true') setShowIntro(false)
  }, [skipPref])

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-jade border-t-transparent" />
          <p className="mt-3 text-sm text-muted-l">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return showIntro ? (
    <VideoIntro onDone={() => setShowIntro(false)} />
  ) : (
    <Layout>
      <Routes>
        <Route path="/" element={<Live />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/my-strategies" element={<MyStrategies />} />
        <Route path="/strategies/:id" element={<StrategyDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Live />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ModeProvider>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </ModeProvider>
  )
}
