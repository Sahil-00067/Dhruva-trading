// Simple localStorage persistence for saved strategies and user profile.
// No backend needed — works offline, syncs across tabs in the same browser.

export type SavedStrategy = {
  id: string
  name: string
  mode: 'template' | 'rules'
  template?: string
  rules?: {
    entry: any[]
    exit: any[]
    risk?: any
  }
  symbol: string
  interval: string
  fast: number
  slow: number
  costBps: number
  createdAt: number
  updatedAt: number
  lastResult?: {
    metrics: any
    trades: any[]
    equity: any[]
  }
}

const STORAGE_KEY = 'dhruva_saved_strategies'
const USER_KEY = 'dhruva_user'

export function getSavedStrategies(): SavedStrategy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveStrategy(strategy: SavedStrategy): SavedStrategy {
  const strategies = getSavedStrategies()
  const existing = strategies.findIndex((s) => s.id === strategy.id)
  if (existing >= 0) {
    strategies[existing] = { ...strategy, updatedAt: Date.now() }
  } else {
    strategies.push({ ...strategy, createdAt: Date.now(), updatedAt: Date.now() })
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies))
  return strategies[strategies.length - 1]
}

export function deleteStrategy(id: string): void {
  const strategies = getSavedStrategies().filter((s) => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies))
}

export type UserProfile = {
  email: string
  displayName: string
  createdAt: number
  plan: 'free' | 'pro'
}

export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(profile))
}
