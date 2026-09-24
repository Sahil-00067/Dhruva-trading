import { useEffect, useRef, useState } from 'react'
import { CandlestickChart, LineChart as LineIcon, AreaChart, BarChart3, GitCompareArrows, Loader2 } from 'lucide-react'
import { PriceChart, type ChartType, type ChartBar } from './PriceChart'
import { fetchBars, type Interval } from '../lib/api'
import { getCandles } from '../lib/demoData'
import { cn } from '../lib/cn'

const INTERVALS: { id: Interval; label: string }[] = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '60m', label: '1H' },
  { id: '1d', label: '1D' },
]

const TYPES: { id: ChartType; label: string; Icon: typeof LineIcon }[] = [
  { id: 'area', label: 'Area', Icon: AreaChart },
  { id: 'candles', label: 'Candles', Icon: CandlestickChart },
  { id: 'bars', label: 'Bars', Icon: BarChart3 },
  { id: 'line', label: 'Line', Icon: LineIcon },
  { id: 'baseline', label: 'Baseline', Icon: GitCompareArrows },
]

type Props = { symbol: string; height?: number }

// The Live chart: real OHLC bars at a switchable timeframe (1m/5m/15m/30m/1H/1D) and
// chart type (area/candles/bars/line/baseline). Falls back to daily demo candles
// when the backend is unreachable, so it stays usable offline.
export function LiveChart({ symbol, height = 340 }: Props) {
  const [interval, setInterval] = useState<Interval>('15m')
  const [type, setType] = useState<ChartType>('area')
  const [bars, setBars] = useState<ChartBar[]>([])
  const [intraday, setIntraday] = useState(true)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    const controller = new AbortController()
    setLoading(true)
    setError('')

    fetchBars(symbol, interval, controller.signal)
      .then((res) => {
        if (id !== reqId.current) return
        setBars(res.bars)
        setIntraday(res.intraday)
        setLive(true)
        setLoading(false)
      })
      .catch((e) => {
        if (id !== reqId.current || controller.signal.aborted) return
        // Offline fallback: daily demo candles. Intraday timeframes have no offline
        // equivalent, so we show daily bars and flag the feed as simulated.
        setBars(getCandles(symbol, 180))
        setIntraday(false)
        setLive(false)
        setError(e instanceof Error ? e.message : 'Feed unavailable')
        setLoading(false)
      })

    return () => controller.abort()
  }, [symbol, interval])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
        {/* Chart-type toggle */}
        <div className="flex overflow-hidden rounded-lg border border-paper-3 dark:border-ink-3">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              title={t.label}
              aria-label={t.label}
              aria-pressed={type === t.id}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                type === t.id ? 'bg-jade text-paper' : 'text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper',
              )}
            >
              <t.Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Timeframe toggle */}
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-l dark:text-muted-d" />}
          <div className="flex overflow-hidden rounded-lg border border-paper-3 dark:border-ink-3">
            {INTERVALS.map((iv) => (
              <button
                key={iv.id}
                onClick={() => setInterval(iv.id)}
                aria-pressed={interval === iv.id}
                className={cn(
                  'num px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                  interval === iv.id ? 'bg-jade text-paper' : 'text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper',
                )}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PriceChart data={bars} type={type} intraday={intraday} height={height} zoomable />

      <div className="px-2 pt-1 text-right text-[10px] text-muted-l dark:text-muted-d">
        {live
          ? `Real NSE ${interval === '1d' ? 'daily' : interval} bars · Yahoo, delayed ~15 min`
          : `Simulated daily bars — ${error || 'backend offline'}`}
      </div>
    </div>
  )
}
