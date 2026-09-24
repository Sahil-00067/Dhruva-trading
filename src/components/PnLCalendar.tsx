import { useMemo } from 'react'
import { cn } from '../lib/cn'
import type { Trade } from '../lib/backtest'

type Props = {
  trades: Trade[]
  className?: string
}

export function PnLCalendar({ trades, className }: Props) {
  const calendar = useMemo(() => {
    const months: Record<string, number> = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    trades.forEach((t) => {
      const date = new Date(typeof t.exitTime === 'number' ? t.exitTime * 1000 : t.exitTime)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = 0
      months[key] += t.retPct
    })

    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => {
        const [year, month] = key.split('-')
        return {
          month: monthNames[parseInt(month) - 1],
          year,
          pnl: value,
        }
      })
  }, [trades])

  if (trades.length === 0) return null

  return (
    <div className={cn('border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2', className)}>
      <div className="px-4 py-2 border-b border-paper-3 dark:border-ink-3">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">Monthly P&L</span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-paper-3 dark:bg-ink-3">
        {calendar.map((m) => (
          <div
            key={m.month}
            className={cn(
              'px-3 py-2 text-center bg-paper-2 dark:bg-ink-2',
              m.pnl >= 0 ? '' : '',
            )}
          >
            <div className="text-[10px] text-muted-l dark:text-muted-d">{m.month}</div>
            <div className={cn('num text-sm font-semibold', m.pnl >= 0 ? 'text-sage' : 'text-clay')}>
              {m.pnl >= 0 ? '+' : ''}{m.pnl.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
