import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, Search } from 'lucide-react'
import { INSTRUMENTS } from '../lib/demoData'
import { useLiveTick } from '../lib/useLiveTick'
import { PriceChart } from '../components/PriceChart'
import { computeSignal } from '../lib/signal'
import { fetchBars, searchInstruments, type Bar } from '../lib/api'
import { num, pct } from '../lib/format'
import { cn } from '../lib/cn'

export function Markets() {
  const location = useLocation() as { state?: { symbol?: string } }
  const [selected, setSelected] = useState(location.state?.symbol ?? 'NIFTY 50')
  const [query, setQuery] = useState('')
  const [backendInstruments, setBackendInstruments] = useState<{ symbol: string; name: string; kind: string }[]>([])
  const [allInstruments] = useState(() => INSTRUMENTS.map((i) => ({ symbol: i.symbol, name: i.name, kind: i.kind })))

  const filtered = useMemo(
    () => (backendInstruments.length > 0 ? backendInstruments : allInstruments).filter(
      (i) =>
        i.symbol.toLowerCase().includes(query.toLowerCase()) ||
        i.name.toLowerCase().includes(query.toLowerCase()),
    ),
    [backendInstruments, allInstruments, query],
  )

  // Fetch real daily bars from backend for the chart
  const [dailyBars, setDailyBars] = useState<Bar[]>([])
  const [live, setLive] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchBars(selected, '1d')
      .then((res) => {
        if (!cancelled) { setDailyBars(res.bars); setLive(true) }
      })
      .catch(() => { setDailyBars([]); setLive(false) })
    return () => { cancelled = true }
  }, [selected])

  const candles = useMemo(() => {
    if (dailyBars.length > 0) return dailyBars.map((b) => ({ time: String(b.time), open: b.open, high: b.high, low: b.low, close: b.close }))
    // Fallback to demo data
    return []
  }, [dailyBars])

  const signal = useMemo(() => computeSignal(candles), [candles])
  const tick = useLiveTick(selected)
  const up = tick.change >= 0

  // Load instruments from backend on mount
  useEffect(() => {
    searchInstruments('', new AbortController().signal)
      .then((r) => setBackendInstruments(r))
      .catch(() => {})
  }, [])

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-text dark:text-paper">Markets</h1>
        <p className="mt-1 text-sm text-muted-l dark:text-muted-d">
          NSE indices and large-caps — {live ? 'real Yahoo Finance data, delayed ~15 min' : 'simulated feed'} · {filtered.length} instruments
        </p>
      </div>

      <div className="space-y-4">
        <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-paper-3 px-3 py-2.5 dark:border-ink-3">
            <Search className="h-4 w-4 text-muted-l dark:text-muted-d" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-ink-text outline-none placeholder:text-muted-l/70 dark:text-paper dark:placeholder:text-muted-d/60"
            />
          </div>
          <div className="max-h-[420px] overflow-y-auto scroll-quiet">
            {filtered.map((inst) => (
              <InstrumentRow
                key={inst.symbol}
                symbol={inst.symbol}
                name={inst.name}
                active={selected === inst.symbol}
                onClick={() => setSelected(inst.symbol)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-l dark:text-muted-d">No matches.</div>
            )}
          </div>
        </div>

        <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div>
              <div className="font-display text-2xl text-ink-text dark:text-paper">{selected}</div>
              <div className="mt-0.5 text-sm text-muted-l dark:text-muted-d">
                {INSTRUMENTS.find((i) => i.symbol === selected)?.name ?? selected}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-2xl text-ink-text dark:text-paper">{num(tick.price)}</div>
              <div className={cn('num flex items-center justify-end gap-1 text-sm', up ? 'text-sage' : 'text-clay')}>
                {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {num(tick.change)} ({pct(tick.changePct)})
              </div>
            </div>
          </div>
          <div className="px-2 pb-3">
            {candles.length > 0
              ? <PriceChart data={candles} type="candles" height={360} />
              : <div className="flex h-[360px] items-center justify-center text-sm text-muted-l dark:text-muted-d">Loading chart…</div>
            }
          </div>
          <div className="flex items-center gap-6 border-t border-paper-3 px-5 py-2.5 dark:border-ink-3">
            <div className="text-xs text-muted-l dark:text-muted-d">
              <span className="uppercase tracking-wider text-[10px]">Trend</span>
              <span className={cn('ml-2 text-sm font-semibold', signal.trend === 'positive' ? 'text-sage' : 'text-clay')}>
                {signal.trend === 'positive' ? 'Positive' : 'Negative'}
              </span>
            </div>
            <div className="text-xs text-muted-l dark:text-muted-d">
              <span className="uppercase tracking-wider text-[10px]">3-mo</span>
              <span className={cn('num ml-2 text-sm font-semibold', signal.momentumPct >= 0 ? 'text-sage' : 'text-clay')}>
                {pct(signal.momentumPct)}
              </span>
            </div>
            <div className="text-xs text-muted-l dark:text-muted-d">
              <span className="uppercase tracking-wider text-[10px]">Regime</span>
              <span className="ml-2 text-sm font-semibold text-ink-text dark:text-paper">{signal.regime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InstrumentRow({
  symbol,
  name,
  active,
  onClick,
}: {
  symbol: string
  name: string
  active: boolean
  onClick: () => void
}) {
  const tick = useLiveTick(symbol)
  const up = tick.change >= 0
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors',
        active ? 'bg-jade/10' : 'hover:bg-paper-3/40 dark:hover:bg-ink-3/40',
      )}
    >
      <div className="min-w-0">
        <div className={cn('truncate text-sm font-medium', active ? 'text-jade-deep dark:text-jade-soft' : 'text-ink-text dark:text-paper')}>
          {symbol}
        </div>
        <div className="truncate text-xs text-muted-l dark:text-muted-d">{name}</div>
      </div>
      <div className="text-right">
        <div className="num text-sm text-ink-text dark:text-paper">{num(tick.price)}</div>
        <div className={cn('num text-xs', up ? 'text-sage' : 'text-clay')}>{pct(tick.changePct)}</div>
      </div>
    </button>
  )
}

function MiniStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">{label}</div>
      <div
        className={cn(
          'num mt-0.5 text-base',
          tone === 'up' && 'text-sage',
          tone === 'down' && 'text-clay',
          tone === 'neutral' && 'text-ink-text dark:text-paper',
        )}
      >
        {value}
      </div>
    </div>
  )
}
