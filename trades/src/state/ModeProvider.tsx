import { createContext, useContext, useState, type ReactNode } from 'react'

export type Mode = 'trading' | 'investing'
type ModeCtx = { mode: Mode; setMode: (m: Mode) => void }

const Ctx = createContext<ModeCtx | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem('mode')
      if (saved === 'trading' || saved === 'investing') return saved
    } catch {}
    return 'trading'
  })
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem('mode', m)
    } catch {}
  }
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>
}

export function useMode() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMode must be used within ModeProvider')
  return c
}
