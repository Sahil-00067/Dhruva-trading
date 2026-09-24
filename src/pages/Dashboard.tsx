import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, Loader2, Search, X, TrendingUp, Zap, Activity } from 'lucide-react'
import { INSTRUMENTS, sparkline, type Instrument } from '../lib/demoData'
import { useLiveTick } from '../lib/useLiveTick'
import { searchInstruments } from '../lib/api'
import { StatTile } from '../components/StatTile'
import { Sparkline } from '../components/Sparkline'
import { LiveSignals } from '../components/LiveSignals'
import { useMode } from '../state/ModeProvider'
import { defaultStrategy } from '../lib/strategies'
import { num, pct } from '../lib/format'
import { cn } from '../lib/cn'

function WatchRow({ inst }: { inst: Instrument }) {
  const tick = useLiveTick(inst.symbol)
  const spark = sparkline(inst.symbol, 44)
  const up = tick.change >= 0
  return (
    <Link
      to="/markets"
      state={{ symbol: inst.symbol }}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-paper-3 dark:hover:bg-ink-3 border-b border-paper-3 dark:border-ink-3 last:border-0"
    >
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold',
        inst.kind === 'index' ? 'bg-brass/15 text-brass' : 'bg-jade/12 text-jade',
      )}>
        {inst.symbol.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink-text dark:text-paper">{inst.symbol}</div>
        <div className="truncate text-[11px] text-muted-l dark:text-muted-d">{inst.name}</div>
      </div>
      <Sparkline data={spark} width={72} height={24} className="hidden sm:block" />
      <div className="w-20 text-right">
        <div className="num text-sm text-ink-text dark:text-paper">{num(tick.price)}</div>
        <div className={cn('num flex items-center justify-end gap-0.5 text-xs', up ? 'text-sage' : 'text-clay')}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {pct(tick.changePct)}
        </div>
      </div>
    </Link>
  )
}

export function Dashboard() {
  const { mode } = useMode()
  const strat = defaultStrategy(mode)!
  const navigate = useNavigate()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink-text dark:text-paper">Dashboard</h1>
            <div className="flex items-center gap-1.5 rounded-sm border border-sage/30 bg-sage/10 px-2 py-0.5">
              <span className="live-dot" />
              <span className="text-[9px] font-medium uppercase tracking-widest text-sage">Live</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-l dark:text-muted-d">
            Paper account · simulated positions
          </p>
        </div>
        <StockSearchBox />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-paper-3 dark:bg-ink-3 border border-paper-3 dark:border-ink-3">
        <StatTile label="Paper equity" value="₹1,04,820" sub="Started at ₹1,00,000" />
        <StatTile label="Today" value="+₹1,240" sub="+0.12% vs prev close" tone="up" />
        <StatTile label="Open positions" value="1" sub="NIFTY 50 · long" />
        <StatTile label="Since inception" value="+4.82%" sub="Paper, all-in" tone="up" />
      </div>

      {/* Live signals */}
      <LiveSignals />

      {/* Best strategy */}
      <Link
        to="/"
        className="flex items-center justify-between gap-4 border border-jade/30 bg-jade/5 hover:bg-jade/10 transition-colors p-4"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-jade/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-jade-deep dark:text-jade">
              {mode === 'trading' ? 'Best trading' : 'Best investing'}
            </span>
            <span className="text-brass text-xs">★</span>
          </div>
          <div className="mt-1.5 font-display text-lg text-ink-text dark:text-paper">{strat.name}</div>
          <p className="mt-0.5 truncate text-xs text-muted-l dark:text-muted-d">{strat.tagline}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-jade/15 text-jade">
          <Zap className="h-4 w-4" />
        </div>
      </Link>

      {/* Watchlist */}
      <section className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
        <div className="flex items-center justify-between border-b border-paper-3 px-4 py-2 dark:border-ink-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-jade" />
            <h2 className="text-xs font-medium uppercase tracking-widest text-ink-text dark:text-paper">Watchlist</h2>
          </div>
          <Link to="/markets" className="text-xs font-medium text-jade hover:underline">
            All markets →
          </Link>
        </div>
        <div className="max-h-[480px] overflow-y-auto scroll-quiet">
          {INSTRUMENTS.map((inst) => (
            <WatchRow key={inst.symbol} inst={inst} />
          ))}
        </div>
      </section>
    </div>
  )
}

function StockSearchBox() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const offline = useMemo(
    () => INSTRUMENTS.map((i) => ({ symbol: i.symbol, name: i.name })),
    [],
  )

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      searchInstruments(query, ctrl.signal)
        .then((r) =>
          setResults(
            r.length ? r.map((x) => ({ symbol: x.symbol, name: x.name })) : offlineSearchOffline(query),
          ),
        )
        .catch(() => setResults(offlineSearchOffline(query)))
        .finally(() => setLoading(false))
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => { setActive(0) }, [results])

  const offlineSearchOffline = (q: string) => {
    const s = q.trim().toLowerCase()
    return s ? offline.filter((i) => i.symbol.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)) : offline
  }

  const openPanel = () => {
    setOpen(true)
    setQuery('')
    setResults(offline)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const choose = (sym: string) => {
    setOpen(false)
    navigate('/markets', { state: { symbol: sym } })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active].symbol) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={boxRef} className="w-64 shrink-0">
      <button
        type="button"
        onClick={openPanel}
        className="flex w-full items-center gap-2 rounded-sm border border-paper-3 bg-paper-2 px-2.5 py-1.5 text-left text-xs text-ink-text outline-none transition-all hover:border-jade/40 focus:border-jade dark:border-ink-3 dark:bg-ink dark:text-paper"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-l dark:text-muted-d" />
        <span className="flex-1 truncate text-muted-l dark:text-muted-d">Search stocks & indices…</span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-sm border border-paper-3 bg-paper-2 shadow-lg dark:border-ink-3 dark:bg-ink-2 slide-in">
          <div className="flex items-center gap-2 border-b border-paper-3 px-2.5 py-1.5 dark:border-ink-3">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-jade" />
            ) : (
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-l dark:text-muted-d" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Nifty, Reliance, Tata…"
              className="w-full bg-transparent text-xs text-ink-text outline-none placeholder:text-muted-l/70 dark:text-paper dark:placeholder:text-muted-d/60"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-l hover:text-clay dark:text-muted-d">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-auto py-0.5">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-l dark:text-muted-d">No match.</div>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.symbol}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.symbol)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                    i === active ? 'bg-jade/10' : 'hover:bg-paper-3 dark:hover:bg-ink',
                  )}
                >
                  <div className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold',
                    r.symbol.includes('NIFTY') || r.symbol === 'SENSEX'
                      ? 'bg-brass/15 text-brass'
                      : 'bg-jade/12 text-jade',
                  )}>
                    {r.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="num truncate text-xs font-medium text-ink-text dark:text-paper">{r.symbol}</div>
                    <div className="truncate text-[11px] text-muted-l dark:text-muted-d">{r.name}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
