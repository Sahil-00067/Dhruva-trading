import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '../lib/cn'
import { num, pct } from '../lib/format'

type Props = {
  result: SweepResult
  bestKey: string
}

export type SweepResult = {
  matrix: SweepCell[]
  best_key: string
  best_metrics: Metrics | null
  params: {
    fast_range: [number, number, number]
    slow_range: [number, number, number]
  }
  symbol: string
  ticker: string
  interval: string
  intraday: boolean
}

type SweepCell = {
  key: string
  fast: number
  slow: number
  metrics: Metrics
}

type Metrics = {
  cagr: number
  sharpe: number
  maxDD: number
  winRate: number
  trades: number
  exposure: number
  totalReturn: number
}

export function SweepView({ result, bestKey }: Props) {
  const matrix = useMemo(() => result.matrix, [result.matrix])
  const best = useMemo(() => result.best_metrics, [result.best_metrics])

  const grid = useMemo(() => {
    const fastSet = new Set<number>()
    matrix.forEach(c => fastSet.add(c.fast))
    const fastValues = Array.from(fastSet).sort((a, b) => a - b)

    const slowSet = new Set<number>()
    matrix.forEach(c => slowSet.add(c.slow))
    const slowValues = Array.from(slowSet).sort((a, b) => a - b)

    return { fastValues, slowValues }
  }, [matrix])

  const maxSharpe = useMemo(() => Math.max(...matrix.map(c => c.metrics.sharpe)), [matrix])
  const minSharpe = useMemo(() => Math.min(...matrix.map(c => c.metrics.sharpe)), [matrix])

  const getHeatColor = (sharpe: number) => {
    if (maxSharpe === minSharpe) return 'bg-jade/20'
    const ratio = (sharpe - minSharpe) / (maxSharpe - minSharpe)
    if (ratio > 0.7) return 'bg-jade/60'
    if (ratio > 0.4) return 'bg-jade/40'
    if (ratio > 0.2) return 'bg-jade/20'
    return 'bg-clay/20'
  }

  return (
    <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-3 dark:border-ink-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
            Parameter sweep · {matrix.length} combinations
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-text dark:text-paper">
            <TrendingUp className="h-3 w-3 text-jade" />
            <span>Best Sharpe: <span className={cn('font-semibold', (best?.sharpe ?? 0) >= 0 ? 'text-sage' : 'text-clay')}>{num(best?.sharpe ?? 0, 2)}</span></span>
            <span className="text-muted-l dark:text-muted-d">·</span>
            <span>CAGR: <span className={cn('font-semibold', (best?.cagr ?? 0) >= 0 ? 'text-sage' : 'text-clay')}>{pct(best?.cagr ?? 0)}</span></span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <table className="w-max mx-auto">
          <thead>
            <tr>
              <th className="w-10"></th>
              {grid.slowValues.map(s => (
                <th key={s} className="px-1 py-1.5 text-[9px] font-medium text-muted-l dark:text-muted-d text-center">
                  S{ s }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.fastValues.map(f => (
              <tr key={f}>
                <td className="py-1.5 pr-2 text-right text-[9px] font-medium text-muted-l dark:text-muted-d">
                  F{ f }
                </td>
                {grid.slowValues.map(s => {
                  const cell = matrix.find(c => c.fast === f && c.slow === s)
                  if (!cell) return <td key={`${f}-${s}`} className="w-10 h-8"></td>
                  const isBest = cell.key === bestKey
                  return (
                    <td
                      key={`${f}-${s}`}
                      className={cn(
                        'w-10 h-8 border border-paper-3 text-center dark:border-ink-3',
                        getHeatColor(cell.metrics.sharpe),
                        isBest && 'ring-1 ring-jade',
                      )}
                      title={`${cell.key}: Sharpe ${cell.metrics.sharpe.toFixed(2)}, CAGR ${cell.metrics.cagr.toFixed(1)}%`}
                    >
                      <div className="text-[9px] font-medium text-ink-text dark:text-paper">
                        {num(cell.metrics.sharpe, 1)}
                      </div>
                      {isBest && <div className="text-[7px] text-jade">★</div>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-paper-3 px-4 py-2 text-[10px] text-muted-l dark:text-muted-d dark:border-ink-3">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-clay/20"></span> Low</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-jade/20"></span> Mid</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-jade/40"></span> Good</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-jade/60"></span> Best</span>
        <span className="ml-auto flex items-center gap-1"><span className="text-jade">★</span> Selected</span>
      </div>
    </div>
  )
}
