import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Strategy } from '../lib/strategies'
import { Badge } from './Badge'

export function StrategyCard({ s }: { s: Strategy }) {
  return (
    <Link
      to={`/strategies/${s.id}`}
      className="card group relative flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-float focus-visible:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-jade-deep dark:text-jade-soft">
            {s.category}
          </div>
          <h3 className="mt-1 font-display text-lg leading-tight text-ink-text dark:text-paper">{s.name}</h3>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-l/60 transition-colors group-hover:text-jade dark:text-muted-d/60" />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-l dark:text-muted-d">{s.tagline}</p>

      {s.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.badges.map((b) => (
            <Badge key={b} kind={b} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-paper-3 pt-3 text-xs text-muted-l dark:border-ink-3 dark:text-muted-d">
        <span>{s.horizon}</span>
        <span className="text-muted-l/40 dark:text-muted-d/40">·</span>
        <span>{s.complexity} to run</span>
      </div>
    </Link>
  )
}
