import { useNavigate, useLocation } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { useMode } from '../state/ModeProvider'
import { cn } from '../lib/cn'

export function TopNav() {
  const { theme, toggle } = useTheme()
  const { mode, setMode } = useMode()
  const navigate = useNavigate()
  const location = useLocation()
  const onLive = location.pathname === '/'

  const pick = (m: 'trading' | 'investing') => {
    setMode(m)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-paper-3 bg-paper/95 backdrop-blur-xl dark:border-ink-3 dark:bg-ink/95">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade rounded-sm px-1"
        >
          <div className="relative flex h-7 w-7 items-center justify-center">
            <div className="absolute inset-0 rounded-sm bg-jade/20 blur-sm" />
            <svg viewBox="0 0 24 24" className="relative h-4 w-4" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#2E9E8F" />
            </svg>
          </div>
          <span className="font-display text-base font-semibold tracking-tight text-ink-text dark:text-paper">
            Dhruva
          </span>
          <span className="hidden rounded-sm border border-paper-3 bg-paper-2 px-1.5 py-0.5 text-[9px] font-medium text-muted-l dark:border-ink-3 dark:bg-ink dark:text-muted-d sm:inline">
            PAPER
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-sm bg-paper-3 p-0.5 dark:bg-ink-2 border border-paper-3 dark:border-ink-3">
            {(['trading', 'investing'] as const).map((m) => {
              const active = mode === m && onLive
              return (
                <button
                  key={m}
                  onClick={() => pick(m)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-sm px-3 py-1 text-xs font-medium capitalize transition-all',
                    active
                      ? 'bg-paper-2 text-jade-deep shadow-sm dark:bg-ink-3 dark:text-jade-soft'
                      : 'text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper',
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>

          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-8 w-8 place-items-center rounded-sm border border-paper-3 text-muted-l transition-colors hover:text-ink-text hover:border-jade/40 dark:border-ink-3 dark:text-muted-d dark:hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </header>
  )
}
