import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '../lib/cn'
import { num, pct } from '../lib/format'
import { PriceChart } from './PriceChart'
import type { ChartBar } from './PriceChart'

type Props = {
  result: WalkForwardResult
  candles: ChartBar[]
}

export type WalkForwardResult = {
  windows: WFWindow[]
  summary: WFSummary
  symbol: string
  ticker: string
  interval: string
  intraday: boolean
}

export type WFWindow = {
  train_start_index: number
  train_end_index: number
  test_start_index: number
  test_end_index: number
  train_metrics: Metrics
  test_metrics: Metrics
}

export type WFSummary = {
  num_windows: number
  avg_test_return: number
  avg_train_return: number
  overall_win_rate: number
  avg_test_sharpe: number
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

export function WalkForwardView({ result, candles }: Props) {
  const windows = useMemo(() => result.windows, [result.windows])
  const summary = useMemo(() => result.summary, [result.summary])

  const equityPoints = useMemo(() => {
    let value = 100
    const points: { time: string | number; value: number }[] = []

    windows.forEach(w => {
      const testStart = w.test_start_index
      const testEnd = w.test_end_index
      for (let i = testStart; i < testEnd && i < candles.length; i++) {
        const ret = i > 0 ? (candles[i].close - candles[i - 1].close) / candles[i - 1].close : 0
        value *= 1 + ret
        points.push({ time: candles[i].time, value })
      }
    })

    return points
  }, [windows, candles])

  const lastValue = equityPoints[equityPoints.length - 1]?.value ?? 100
  const totalReturn = lastValue - 100

  return (
    <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-3 dark:border-ink-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
            Walk-forward · {summary.num_windows} windows
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-text dark:text-paper">
            <span className="flex items-center gap-1">
              <TrendingUp className={cn('h-3 w-3', totalReturn >= 0 ? 'text-sage' : 'text-clay')} />
              <span>Total: <span className={cn('font-semibold', totalReturn >= 0 ? 'text-sage' : 'text-clay')}>{pct(totalReturn)}</span></span>
            </span>
            <span className="text-muted-l dark:text-muted-d">·</span>
            <span>Win rate: <span className="font-semibold text-brass">{num(summary.overall_win_rate, 0)}%</span></span>
            <span className="text-muted-l dark:text-muted-d">·</span>
            <span>Avg Sharpe: <span className="font-semibold">{num(summary.avg_test_sharpe, 2)}</span></span>
          </div>
        </div>
      </div>

      {equityPoints.length > 0 && (
        <div className="px-1 py-1">
          <PriceChart data={equityPoints as never} type="area" height={160} intraday={false} />
        </div>
      )}

      <div className="border-t border-paper-3 dark:border-ink-3">
        <div className="grid grid-cols-5 gap-0 border-b border-paper-3 px-4 py-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-l dark:border-ink-3 dark:text-muted-d">
          <span>W#</span>
          <span>Train Ret</span>
          <span>Test Ret</span>
          <span>Test Sharpe</span>
          <span>Win %</span>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {windows.slice(0, 10).map((w, i) => (
            <div key={i} className="grid grid-cols-5 gap-0 border-b border-paper-3/50 px-4 py-1.5 text-[11px] dark:border-ink-3/50">
              <span className="text-muted-l dark:text-muted-d">#{i + 1}</span>
              <span className={cn('font-mono', w.train_metrics.totalReturn >= 0 ? 'text-sage' : 'text-clay')}>
                {pct(w.train_metrics.totalReturn)}
              </span>
              <span className={cn('font-mono', w.test_metrics.totalReturn >= 0 ? 'text-sage' : 'text-clay')}>
                {pct(w.test_metrics.totalReturn)}
              </span>
              <span className="font-mono">{num(w.test_metrics.sharpe, 2)}</span>
              <span className="font-mono">{num(w.test_metrics.winRate, 0)}%</span>
            </div>
          ))}
          {windows.length > 10 && (
            <div className="px-4 py-1.5 text-[11px] text-muted-l dark:text-muted-d">
              …{windows.length - 10} more
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-paper-3 px-4 py-2 dark:border-ink-3">
        <div className="text-[11px] text-muted-l dark:text-muted-d">
          {Math.abs(summary.avg_test_return - summary.avg_train_return) < 5
            ? 'Stable across out-of-sample periods'
            : 'Performance drift between train and test — check for overfitting'
          }
        </div>
      </div>
    </div>
  )
}
