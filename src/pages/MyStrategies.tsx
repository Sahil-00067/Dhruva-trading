import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Save, Trash2, Play, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { getSavedStrategies, deleteStrategy, type SavedStrategy } from '../lib/storage'
import { num, pct } from '../lib/format'
import { cn } from '../lib/cn'

const MODE_LABEL: Record<string, string> = { template: 'Preset', rules: 'Custom' }

export function MyStrategies() {
  const navigate = useNavigate()
  const [strategies, setStrategies] = useState<SavedStrategy[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    setStrategies(getSavedStrategies().sort((a, b) => b.updatedAt - a.updatedAt))
  }, [])

  const handleDelete = (id: string) => {
    if (!confirm('Delete this saved strategy?')) return
    setDeleting(id)
    deleteStrategy(id)
    setStrategies((prev) => prev.filter((s) => s.id !== id))
    setDeleting(null)
  }

  const handleLoad = (s: SavedStrategy) => {
    navigate('/backtest', { state: { loadStrategy: s } })
  }

  const handleCreate = () => {
    navigate('/backtest')
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-text dark:text-paper">My Strategies</h1>
          <p className="mt-1 text-sm text-muted-l dark:text-muted-d">
            {strategies.length} saved{strategies.length === 1 ? '' : 's'} — backed up locally in your browser.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-jade-deep"
        >
          <Play className="h-4 w-4" />
          New backtest
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="card p-10 text-center">
          <Save className="mx-auto h-8 w-8 text-muted-l/40 dark:text-muted-d/40" />
          <p className="mt-3 text-sm text-muted-l dark:text-muted-d">
            No strategies saved yet. Run a backtest and click "Save strategy" to store it here.
          </p>
          <button
            onClick={handleCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-jade px-4 py-2 text-sm font-medium text-paper hover:bg-jade-deep"
          >
            <Play className="h-4 w-4" />
            Start a backtest
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((s) => (
            <StrategyRow
              key={s.id}
              s={s}
              onLoad={() => handleLoad(s)}
              onDelete={() => handleDelete(s.id)}
              deleting={deleting === s.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StrategyRow({
  s,
  onLoad,
  onDelete,
  deleting,
}: {
  s: SavedStrategy
  onLoad: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const m = s.lastResult?.metrics
  const pnlPct = m?.totalReturn ?? 0
  const isUp = pnlPct >= 0

  return (
    <div className="card flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-float">
      <button
        onClick={onLoad}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jade/10 text-jade-deep hover:bg-jade/20 dark:text-jade-soft"
      >
        <Play className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-text dark:text-paper">{s.name}</span>
          <span className="shrink-0 rounded-full border border-paper-3 bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-l dark:border-ink-3 dark:bg-ink-2 dark:text-muted-d">
            {MODE_LABEL[s.mode] ?? s.mode}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-l dark:text-muted-d">
          <span>{s.symbol}</span>
          <span>·</span>
          <span>{s.interval}</span>
          <span>·</span>
          <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
          {m && (
            <>
              <span>·</span>
              <span className={cn('num', isUp ? 'text-sage' : 'text-clay')}>
                {isUp ? <TrendingUp className="mr-0.5 inline h-3 w-3" /> : <TrendingDown className="mr-0.5 inline h-3 w-3" />}
                {pct(pnlPct)} · {m.trades} trades · Sharpe {num(m.sharpe, 2)}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        disabled={deleting}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-l transition-colors hover:bg-clay/10 hover:text-clay disabled:opacity-50 dark:text-muted-d"
        aria-label="Delete"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

