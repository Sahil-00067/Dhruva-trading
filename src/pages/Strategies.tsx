import { useState } from 'react'
import { Search } from 'lucide-react'
import { STRATEGIES, CATEGORIES } from '../lib/strategies'
import { StrategyCard } from '../components/StrategyCard'
import { cn } from '../lib/cn'

type Filter = 'all' | 'trading' | 'investing'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'trading', label: 'TRADING' },
  { id: 'investing', label: 'INVESTING' },
]

export function Strategies() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const match = STRATEGIES.filter((s) => {
    const modeOk = filter === 'all' || s.mode === filter || s.mode === 'both'
    const q = query.toLowerCase()
    const qOk = !q || s.name.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    return modeOk && qOk
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-text dark:text-paper">Strategy library</h1>
          <p className="mt-0.5 text-xs text-muted-l dark:text-muted-d">
            {STRATEGIES.length} researched approaches — from trend-following to factor investing.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-sm border border-paper-3 bg-paper-2 px-2.5 py-1.5 dark:border-ink-3 dark:bg-ink">
          <Search className="h-3.5 w-3.5 text-muted-l dark:text-muted-d" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-40 bg-transparent text-xs text-ink-text outline-none placeholder:text-muted-l/70 dark:text-paper dark:placeholder:text-muted-d"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-paper-3 dark:border-ink-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
              filter === f.id
                ? 'border-jade text-jade'
                : 'border-transparent text-muted-l hover:text-ink-text dark:hover:text-paper',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {CATEGORIES.map((cat) => {
        const items = match.filter((s) => s.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat}>
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <StrategyCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )
      })}

      {match.length === 0 && (
        <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-8 text-center text-xs text-muted-l dark:text-muted-d">
          No strategies match your search.
        </div>
      )}
    </div>
  )
}
