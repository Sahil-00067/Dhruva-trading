import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CandlestickChart, FlaskConical, Bookmark, Settings } from 'lucide-react'
import { cn } from '../lib/cn'

const ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/my-strategies', label: 'Saved', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mt-2 flex items-center gap-0.5 rounded-t-lg border border-t-0 border-paper-3 bg-paper-2 px-1.5 py-1.5 shadow-lg dark:border-ink-3 dark:bg-ink-2">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group flex flex-col items-center gap-0.5 rounded-sm px-3 py-1.5 transition-colors',
                isActive
                  ? 'text-jade'
                  : 'text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive && 'stroke-[2.5px]')} />
                <span className="text-[10px] font-medium">{label}</span>
                {isActive && <div className="mt-0.5 h-[2px] w-4 rounded-full bg-jade" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
