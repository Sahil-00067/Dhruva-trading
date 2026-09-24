import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Sparkles,
  Play,
  ChevronDown,
  Activity,
  Radio,
  WifiOff,
  Loader2,
  Wrench,
  LayoutGrid,
  TrendingUp,
  Download,
  Share2,
  Wand2,
} from 'lucide-react'
import { getCandles, type Candle } from '../lib/demoData'
import { StockSearch } from '../components/StockSearch'
import { RuleBuilder } from '../components/RuleBuilder'
import {
  runBacktest,
  reviewBacktest,
  describeConfig,
  describeRules,
  validateRules,
  rulesWarmup,
  type Template,
  type Review,
  type Trade,
  type Metrics,
  type StrategyDSL,
} from '../lib/backtest'
import { fetchBacktest, type Interval, type OOSResult, fetchBacktestOOS, fetchBacktestSweep, fetchWalkForward, fetchAIReview, type SweepResult, type WalkForwardResult, type AIReviewResult } from '../lib/api'
import { saveStrategy, getSavedStrategies, type SavedStrategy } from '../lib/storage'
import { NLStrategy } from '../components/NLStrategy'
import { SweepView } from '../components/SweepView'
import { WalkForwardView } from '../components/WalkForwardView'
import { PnLCalendar } from '../components/PnLCalendar'
import { ExportPDF } from '../components/ExportPDF'
import { PriceChart, type ChartMarker } from '../components/PriceChart'
import { Disclaimer } from '../components/Disclaimer'
import { num, pct } from '../lib/format'
import { cn } from '../lib/cn'

const BARS = 250
const NOTIONAL = 100000 // frame the equity curve as a ₹1,00,000 paper account

// Backtest timeframe ladder. Daily uses cached EOD history (up to BARS sessions);
// intraday pulls live bars, bounded by Yahoo's per-interval history caps.
const TIMEFRAMES: { id: Interval; label: string }[] = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '60m', label: '1H' },
  { id: '1d', label: '1D' },
]

type View = {
  candles: Candle[]
  equity: { time: string | number; value: number }[]
  trades: Trade[]
  metrics: Metrics
  reviews: Review[]
  intraday?: boolean
}

const TEMPLATES: { id: Template; label: string; blurb: string; example: string }[] = [
  { id: 'ma', label: 'Trend (MA cross)', blurb: 'Ride uptrends, step aside in downtrends.', example: 'Buy NIFTY when the 20-day average is above the 50-day average, and move to cash when it crosses back below.' },
  { id: 'rsi', label: 'Mean-reversion (RSI)', blurb: 'Buy oversold dips, sell into strength.', example: 'Buy when RSI(14) drops below 30 and sell when it climbs back above 55.' },
  { id: 'breakout', label: 'Breakout (Donchian)', blurb: 'Buy new highs, exit on new lows.', example: 'Go long when price breaks above the 20-day high and exit on the 20-day low.' },
]

const toneMap: Record<Review['tone'], { icon: typeof Info; color: string; ring: string }> = {
  good: { icon: CheckCircle2, color: 'text-sage', ring: 'border-sage/30' },
  warn: { icon: AlertTriangle, color: 'text-brass', ring: 'border-brass/30' },
  bad: { icon: XCircle, color: 'text-clay', ring: 'border-clay/30' },
  info: { icon: Info, color: 'text-jade', ring: 'border-jade/30' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

// Format a bar's time for display. Intraday bars carry a unix timestamp whose UTC
// wall-clock IS the IST session time (see backend _bars_from_df), so read it back with
// getUTC*; daily bars carry a 'yyyy-mm-dd' string.
function fmtBar(time: string | number): string {
  if (typeof time === 'number') {
    const dt = new Date(time * 1000)
    const hh = String(dt.getUTCHours()).padStart(2, '0')
    const mm = String(dt.getUTCMinutes()).padStart(2, '0')
    return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${hh}:${mm}`
  }
  return shortDate(time)
}

function positionAt(trades: Trade[], i: number): boolean {
  for (const t of trades) {
    if (i >= t.entryIndex && (t.open || i < t.exitIndex)) return true
  }
  return false
}

const prefersReduced =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const DEFAULT_RULES: StrategyDSL = {
  entry: [{ left: { kind: 'sma', n: 20 }, op: 'cross_above', right: { kind: 'sma', n: 50 } }],
  exit: [{ left: { kind: 'sma', n: 20 }, op: 'cross_below', right: { kind: 'sma', n: 50 } }],
}

export function Backtest() {
  const [mode, setMode] = useState<'template' | 'rules' | 'nl'>('template')
  const [template, setTemplate] = useState<Template>('ma')
  const [symbol, setSymbol] = useState('NIFTY 50')
  const [fast, setFast] = useState(20)
  const [slow, setSlow] = useState(50)
  const [costBps, setCostBps] = useState(20)
  const [targetWinRate, setTargetWinRate] = useState(50) // user-set target
  const [interval, setInterval] = useState<Interval>('1d')
  const [advanced, setAdvanced] = useState(false)
  const [replayTo, setReplayTo] = useState<number | null>(null)

  // Draft rules being edited, plus the committed rules actually backtested (via "Test this").
  const [draftRules, setDraftRules] = useState<StrategyDSL>(DEFAULT_RULES)
  const [runRules, setRunRules] = useState<StrategyDSL>(DEFAULT_RULES)

  const cfgFast = Math.max(2, fast)
  const cfgSlow = Math.max(3, slow)
  const ruleErr = (mode === 'rules' || mode === 'nl') ? validateRules(draftRules) : null
  // Draft differs from what's committed? Then a re-test is pending.
  const dirty = (mode === 'rules' || mode === 'nl') && JSON.stringify(draftRules) !== JSON.stringify(runRules)

  // Include draft rules for NL mode so the cfg key (and thus all backtest fetches)
  // invalidates when the user re-parses, forcing a fresh run without clicking "Test".
  const rulesKey = (mode === 'rules' || mode === 'nl') ? JSON.stringify(runRules) : ''
  const engineMode: 'template' | 'rules' = mode === 'nl' ? 'rules' : mode
  const cfgKey = `${engineMode}|${template}|${symbol}|${cfgFast}|${cfgSlow}|${costBps}|${targetWinRate}|${interval}|${rulesKey}`

  // Instant client-side result so the page is never empty (also the offline fallback).
  const local = useMemo<View>(() => {
    const candles = getCandles(symbol, BARS)
    const engineMode: 'template' | 'rules' = mode === 'nl' ? 'rules' : mode
    const cfg = { template, fast: cfgFast, slow: cfgSlow, costBps, mode: engineMode, rules: runRules }
    const r = runBacktest(candles, cfg)
    return { candles, equity: r.equity, trades: r.trades, metrics: r.metrics, reviews: reviewBacktest(r.metrics, cfg) }
  }, [template, symbol, cfgFast, cfgSlow, costBps, mode, rulesKey])

  // Live result from the Python engine (real NSE data), keyed to the config it answers.
  const [live, setLive] = useState<{
    key: string
    ticker: string
    start: string | number
    end: string | number
    intraday: boolean
    interval: string
    view: View
  } | null>(null)
  const [loading, setLoading] = useState(false)

  // Out-of-sample results (70/30 split) — runs in parallel with the main request.
  const [oos, setOos] = useState<OOSResult | null>(null)
  const [loadingOos, setLoadingOos] = useState(false)

  // Sweep and walk-forward results
  const [sweep, setSweep] = useState<SweepResult | null>(null)
  const [loadingSweep, setLoadingSweep] = useState(false)
  const [wf, setWf] = useState<WalkForwardResult | null>(null)
  const [loadingWf, setLoadingWf] = useState(false)

  // AI review
  const [aiReviews, setAiReviews] = useState<AIReviewResult | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  // Tabs for bottom sections
  const [resultTab, setResultTab] = useState<'overview' | 'sweep' | 'walkforward' | 'ai'>('overview')
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = cfgKey
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      fetchBacktest(
        { template, symbol, fast: cfgFast, slow: cfgSlow, costBps, lookback: BARS, interval, mode: engineMode, rules: mode === 'rules' || mode === 'nl' ? runRules : undefined },
        ctrl.signal,
      )
        .then((d) => {
          setLive({
            key,
            ticker: d.ticker,
            start: d.start,
            end: d.end,
            intraday: d.intraday,
            interval: d.interval,
            view: { candles: d.candles, equity: d.equity, trades: d.trades, metrics: d.metrics, reviews: d.reviews, intraday: d.intraday },
          })
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setLive((prev) => (prev && prev.key === key ? null : prev))
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [cfgKey])

  // OOS in parallel — same config, 70/30 split, no user action needed.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoadingOos(true)
    fetchBacktestOOS(
      { template, symbol, fast: cfgFast, slow: cfgSlow, costBps, lookback: BARS, interval, mode: engineMode, rules: mode === 'rules' || mode === 'nl' ? runRules : undefined },
      ctrl.signal,
    )
      .then((d) => setOos(d))
      .catch((e) => {
        if (e.name !== 'AbortError') setOos(null)
      })
      .finally(() => setLoadingOos(false))
    return () => ctrl.abort()
  }, [cfgKey])

  // Sweep — debounced, only when explicitly requested
  const triggerSweep = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setLoadingSweep(true)
        fetchBacktestSweep(
          { template, symbol, fast: cfgFast, slow: cfgSlow, costBps, lookback: BARS, interval, mode: engineMode, rules: mode === 'rules' || mode === 'nl' ? runRules : undefined },
        ).then((d) => setSweep(d)).finally(() => setLoadingSweep(false))
      }, 400)
    }
  }, [template, symbol, cfgFast, cfgSlow, costBps, interval, mode, rulesKey])

  // Walk-forward — triggered on demand
  const triggerWf = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setLoadingWf(true)
        fetchWalkForward(
          { template, symbol, fast: cfgFast, slow: cfgSlow, costBps, lookback: BARS, interval, mode: engineMode, rules: mode === 'rules' || mode === 'nl' ? runRules : undefined },
          100, 20,
        ).then((d) => setWf(d)).finally(() => setLoadingWf(false))
      }, 400)
    }
  }, [template, symbol, cfgFast, cfgSlow, costBps, interval, mode, rulesKey])

  // AI review — triggered on demand
  const triggerAiReview = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>
    return () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setLoadingAi(true)
        fetchAIReview(
          { template, symbol, fast: cfgFast, slow: cfgSlow, costBps, lookback: BARS, interval, mode: engineMode, rules: mode === 'rules' || mode === 'nl' ? runRules : undefined },
        ).then((d) => setAiReviews(d)).finally(() => setLoadingAi(false))
      }, 400)
    }
  }, [template, symbol, cfgFast, cfgSlow, costBps, interval, mode, rulesKey])

  const useLive = live !== null && live.key === cfgKey
  const view = useLive ? live!.view : local
  const source: 'live' | 'demo' = useLive ? 'live' : 'demo'
  // Intraday windows are counted in bars, not sessions — used in the plain-English readout.
  const unit = view.intraday ? `${interval} bars` : 'trading days'

  const m = view.metrics
  const total = view.equity.length

  // Buy/sell markers, tagged with bar index so replay can reveal them in sequence.
  const markers = useMemo(() => {
    const out: (ChartMarker & { index: number })[] = []
    for (const t of view.trades) {
      out.push({ index: t.entryIndex, time: t.entryTime, position: 'belowBar', color: '#2E9E8F', shape: 'arrowUp', text: 'BUY' })
      if (!t.open)
        out.push({ index: t.exitIndex, time: t.exitTime, position: 'aboveBar', color: '#C77F76', shape: 'arrowDown', text: 'SELL' })
    }
    return out
  }, [view])

  // Reset the replay when the config changes or a live result swaps in.
  useEffect(() => {
    setReplayTo(null)
  }, [cfgKey, source])

  // Drive the bar-by-bar reveal.
  useEffect(() => {
    if (replayTo === null) return
    if (replayTo >= total) {
      const t = setTimeout(() => setReplayTo(null), 700)
      return () => clearTimeout(t)
    }
    const step = Math.max(1, Math.round(total / 110))
    const t = setTimeout(() => setReplayTo((v) => (v === null ? null : Math.min(total, v + step))), 45)
    return () => clearTimeout(t)
  }, [replayTo, total])

  const playing = replayTo !== null
  const visibleCount = replayTo ?? total
  const cursor = Math.max(0, Math.min(visibleCount, total) - 1)
  const cursorCandle = view.candles[cursor]
  const cursorEquity = view.equity[cursor]?.value ?? 100
  const portfolio = (cursorEquity / 100) * NOTIONAL
  const pnlPct = cursorEquity - 100
  const inPos = positionAt(view.trades, cursor)

  const shownCandles = useMemo(() => view.candles.slice(0, visibleCount), [view, visibleCount])
  const shownMarkers = useMemo(
    () =>
      markers
        .filter((mk) => mk.index < visibleCount)
        .map(({ time, position, color, shape, text }) => ({ time, position, color, shape, text })),
    [markers, visibleCount],
  )

  const equityData = useMemo(
    () => view.equity.map((e) => ({ time: e.time, open: e.value, high: e.value, low: e.value, close: e.value })),
    [view],
  )
  const finalValue = (view.equity[total - 1].value / 100) * NOTIONAL

  // Buy & hold benchmark: hold the instrument from the first bar to the last, marked
  // to market and indexed to the same base-100 as the strategy equity so the two lines
  // (and their returns) compare directly. Derived from candles — no engine round-trip.
  const benchmark = useMemo(() => {
    const c = view.candles
    const base = c[0]?.close ?? 0
    if (!base) return []
    return view.equity.map((e, i) => ({ time: e.time, value: ((c[i]?.close ?? base) / base) * 100 }))
  }, [view])
  const benchRet = (benchmark[benchmark.length - 1]?.value ?? 100) - 100
  const stratRet = (view.equity[total - 1]?.value ?? 100) - 100
  const edge = stratRet - benchRet

  const startReplay = () => {
    if (playing || loading) return
    // Need enough bars to animate meaningfully — less than 20 is just a flash.
    if (total < 20) return
    setReplayTo(prefersReduced ? total : 1)
  }

  const pickTemplate = (t: Template) => {
    setTemplate(t)
    if (t === 'rsi') setFast(14)
    if (t === 'ma') {
      setFast(20)
      setSlow(50)
    }
    if (t === 'breakout') setSlow(20)
  }

  const cfg = { template, fast: cfgFast, slow: cfgSlow, costBps, mode: engineMode, rules: runRules }
  const testThis = () => {
    if (ruleErr) return
    setRunRules(draftRules)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-text dark:text-paper">Backtest</h1>
        <p className="mt-0.5 text-xs text-muted-l dark:text-muted-d">
          Define a rule · run on real NSE history · review the numbers
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Builder */}
        <div className="space-y-4">
          {/* Mode toggle: pick a preset, or build your own rule */}
          <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d mb-3">
              Define mode
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setMode('template')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-sm border py-2 text-xs font-medium transition-colors',
                  mode === 'template'
                    ? 'border-jade/50 bg-jade/10 text-jade'
                    : 'border-paper-3 text-muted-l hover:border-jade/30 dark:border-ink-3 dark:text-muted-d',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Preset
              </button>
              <button
                onClick={() => setMode('nl')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-sm border py-2 text-xs font-medium transition-colors',
                  mode === 'nl'
                    ? 'border-jade/50 bg-jade/10 text-jade'
                    : 'border-paper-3 text-muted-l hover:border-jade/30 dark:border-ink-3 dark:text-muted-d',
                )}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Type it out
              </button>
              <button
                onClick={() => setMode('rules')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-sm border py-2 text-xs font-medium transition-colors',
                  mode === 'rules'
                    ? 'border-jade/50 bg-jade/10 text-jade'
                    : 'border-paper-3 text-muted-l hover:border-jade/30 dark:border-ink-3 dark:text-muted-d',
                )}
              >
                <Wrench className="h-3.5 w-3.5" />
                Advanced
              </button>
            </div>
          </div>

          {mode === 'template' ? (
            <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d mb-3">
                Preset rule
              </div>
              <div className="space-y-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTemplate(t.id)}
                    className={cn(
                      'w-full rounded-sm border p-2.5 text-left transition-colors',
                      template === t.id
                        ? 'border-jade/50 bg-jade/10'
                        : 'border-paper-3 hover:border-jade/30 dark:border-ink-3',
                    )}
                  >
                    <div className="text-xs font-medium text-ink-text dark:text-paper">{t.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-l dark:text-muted-d">{t.blurb}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'nl' ? (
            <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4">
              <NLStrategy onParsed={setDraftRules} />
              {ruleErr && <p className="mt-2 text-xs text-clay">{ruleErr}</p>}

              <button
                onClick={testThis}
                disabled={!!ruleErr || !dirty}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-sm py-2 text-xs font-medium transition-colors',
                  ruleErr
                    ? 'cursor-not-allowed bg-paper-3/60 text-muted-l dark:bg-ink-3/60 dark:text-muted-d'
                    : dirty
                      ? 'bg-jade text-paper hover:bg-jade-deep'
                      : 'cursor-default bg-jade/10 text-jade',
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                {dirty ? 'Test on real data' : 'Tested ✓ — edit to re-run'}
              </button>
            </div>
          ) : (
            <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d mb-3">
                Custom rules
              </div>
              <div className="mt-1">
                <RuleBuilder rules={draftRules} onChange={setDraftRules} />
              </div>

              {ruleErr && <p className="mt-2 text-xs text-clay">{ruleErr}</p>}
              {!ruleErr && rulesWarmup(draftRules) > BARS - 10 && (
                <p className="mt-2 text-xs text-brass">
                  Longest lookback ({rulesWarmup(draftRules)} bars) approaches the {BARS}-bar window — limited warmup data.
                </p>
              )}

              <button
                onClick={testThis}
                disabled={!!ruleErr || !dirty}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-sm py-2 text-xs font-medium transition-colors',
                  ruleErr
                    ? 'cursor-not-allowed bg-paper-3/60 text-muted-l dark:bg-ink-3/60 dark:text-muted-d'
                    : dirty
                      ? 'bg-jade text-paper hover:bg-jade-deep'
                      : 'cursor-default bg-jade/10 text-jade',
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                {dirty ? 'Test on real data' : 'Tested — edit to re-run'}
              </button>
            </div>
          )}

          <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4 space-y-4">
            <Field label="Instrument">
              <StockSearch value={symbol} onSelect={setSymbol} />
            </Field>

            <Field label="Timeframe">
              <div className="flex overflow-hidden rounded-sm border border-paper-3 dark:border-ink-3">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setInterval(tf.id)}
                    aria-pressed={interval === tf.id}
                    className={cn(
                      'num flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors',
                      interval === tf.id
                        ? 'bg-jade text-paper'
                        : 'text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper',
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-l dark:text-muted-d">
                {interval === '1d' ? 'Daily EOD history.' : 'Intraday bars (~15 min delayed via Yahoo).'}
              </p>
            </Field>

            <Field label={`Target win rate`}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={targetWinRate}
                  onChange={(e) => setTargetWinRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="num w-16 rounded-sm border border-paper-3 bg-paper px-2 py-1.5 text-xs text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
                />
                <span className="text-xs text-muted-l dark:text-muted-d">%</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-l dark:text-muted-d">Minimum acceptable win rate.</p>
            </Field>

            <div>
              <button
                onClick={() => setAdvanced((v) => !v)}
                className="flex w-full items-center justify-between rounded-sm py-1 text-left text-[10px] font-medium uppercase tracking-widest text-muted-l transition-colors hover:text-jade dark:text-muted-d"
              >
                <span>Advanced</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', advanced && 'rotate-180')} />
              </button>

              {advanced && (
                <div className="mt-3 space-y-3 border-t border-paper-3 pt-3 dark:border-ink-3">
                  {mode === 'template' && template === 'ma' && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Fast MA" value={fast} onChange={setFast} min={2} />
                      <NumField label="Slow MA" value={slow} onChange={setSlow} min={3} />
                    </div>
                  )}
                  {mode === 'template' && template === 'rsi' && <NumField label="RSI length" value={fast} onChange={setFast} min={2} />}
                  {mode === 'template' && template === 'breakout' && <NumField label="Channel length" value={slow} onChange={setSlow} min={3} />}

                  <Field label={`Cost: ${costBps} bps`}>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={5}
                      value={costBps}
                      onChange={(e) => setCostBps(Number(e.target.value))}
                      className="w-full accent-jade"
                    />
                    <p className="mt-1 text-[11px] text-muted-l dark:text-muted-d">
                      Brokerage + STT + slippage per round trip.
                    </p>
                  </Field>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {/* Watch it trade */}
          <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
                  <Activity className="h-3.5 w-3.5 text-jade" />
                  Strategy
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-text dark:text-paper">
                  {engineMode === 'rules'
                    ? describeRules(runRules, symbol, view.candles.length, unit)
                    : describeConfig(cfg, symbol, view.candles.length, unit)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={startReplay}
                  disabled={playing || loading || total < 20}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                    playing || loading || total < 20
                      ? 'cursor-default bg-jade/10 text-jade'
                      : 'bg-jade text-paper hover:bg-jade-deep',
                  )}
                >
                  {playing ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jade" />
                      Replaying…
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" fill="currentColor" />
                      Replay
                    </>
                  )}
                </button>
                <SaveStrategyButton
                  cfg={{ template, fast: cfgFast, slow: cfgSlow, costBps, mode: engineMode, rules: runRules }}
                  symbol={symbol}
                  interval={interval}
                  metrics={m}
                  trades={view.trades}
                  equity={view.equity}
                />
                <ExportPDF
                  element={resultsRef.current}
                  strategyName={`${symbol} · ${cfgFast}-${cfgSlow} MA`}
                />
              </div>
            </div>

            {/* Data-source badge */}
            <div className="px-4 pb-2">
              <SourceBadge source={source} loading={loading} ticker={live?.ticker} start={live?.start} end={live?.end} intraday={live?.intraday} interval={interval} />
            </div>

            {/* Live readout */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-paper-3 bg-paper/50 px-4 py-2 dark:border-ink-3 dark:bg-ink/20">
              <Readout label="As of" value={cursorCandle ? fmtBar(cursorCandle.time) : '—'} />
              <Readout label={`${symbol} price`} value={cursorCandle ? `₹${num(cursorCandle.close)}` : '—'} />
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-sm', inPos ? 'animate-pulse bg-sage' : 'bg-muted-l/40 dark:bg-muted-d/40')} />
                <span className={cn('text-xs', inPos ? 'text-sage' : 'text-muted-l dark:text-muted-d')}>
                  {inPos ? 'In position' : 'In cash'}
                </span>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[9px] uppercase tracking-widest text-muted-l dark:text-muted-d">Paper value</div>
                <div className="num text-xs text-ink-text dark:text-paper">
                  ₹{num(portfolio, 0)}{' '}
                  <span className={cn(pnlPct >= 0 ? 'text-sage' : 'text-clay')}>({pct(pnlPct)})</span>
                </div>
              </div>
            </div>

            <div className="px-1 pb-1 pt-0.5">
              <PriceChart data={shownCandles} type="candles" height={260} markers={shownMarkers} intraday={view.intraday ?? false} fixedRange={playing ? total : undefined} zoomable />
            </div>
            <p className="px-4 pb-3 text-[11px] text-muted-l dark:text-muted-d">
              <span className="text-jade">▲ BUY</span> / <span className="text-clay">▼ SELL</span> marks every entry
              and exit
              {source === 'live' && live
                ? ` — real NSE ${live.intraday ? `${interval} bars` : 'EOD'} (${fmtBar(live.start)} → ${fmtBar(live.end)}).`
                : ` — ${view.candles.length} simulated sessions.`}
            </p>
          </div>

          {/* Scorecard */}
          <div className="grid grid-cols-2 gap-px bg-paper-3 dark:bg-ink-3 border border-paper-3 dark:border-ink-3">
            <Metric label="Total return" value={pct(m.totalReturn)} tone={m.totalReturn >= 0 ? 'up' : 'down'} />
            <Metric label="CAGR" value={pct(m.cagr)} tone={m.cagr >= 0 ? 'up' : 'down'} />
            <Metric label="Sharpe" value={num(m.sharpe)} tone={m.sharpe >= 1 ? 'up' : m.sharpe < 0.4 ? 'down' : 'neutral'} />
            <Metric label="Max drawdown" value={pct(m.maxDD)} tone="down" />
            <Metric
              label="Win rate"
              value={
                <span className="flex items-baseline gap-1">
                  <span className={cn(m.winRate >= targetWinRate ? 'text-sage' : 'text-clay', 'font-semibold')}>
                    {num(m.winRate, 0)}%
                  </span>
                  <span className="text-[10px] text-muted-l dark:text-muted-d">/ {targetWinRate}%</span>
                </span>
              }
            />
            <Metric label="Trades · exposure" value={`${m.trades} · ${num(m.exposure, 0)}%`} />
          </div>

          {/* Equity curve */}
          <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
            <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-paper-3 dark:border-ink-3">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
                Equity curve · ₹{num(NOTIONAL, 0)} start
              </span>
              <span className="num text-sm text-ink-text dark:text-paper">
                → ₹{num(finalValue, 0)}{' '}
                <span className={cn(m.totalReturn >= 0 ? 'text-sage' : 'text-clay')}>({pct(m.totalReturn)})</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[10px] border-b border-paper-3 dark:border-ink-3">
              <span className="flex items-center gap-1.5 text-muted-l dark:text-muted-d">
                <span className="inline-block h-0.5 w-3 bg-jade" />
                Strategy <span className="num text-ink-text dark:text-paper">{pct(stratRet)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-l dark:text-muted-d">
                <span className="inline-block h-0 w-3 border-t-2 border-dashed border-brass" />
                Buy &amp; hold <span className="num text-ink-text dark:text-paper">{pct(benchRet)}</span>
              </span>
              <span className={cn('num ml-auto font-medium', edge >= 0 ? 'text-sage' : 'text-clay')}>
                {edge >= 0 ? 'Beat' : 'Lagged'} B&amp;H by {num(Math.abs(edge))}%
              </span>
            </div>

            <div className="px-1 py-1">
              <PriceChart data={equityData} type="area" height={150} intraday={view.intraday ?? false} overlay={benchmark} zoomable />
            </div>
          </div>

          {/* Result tabs */}
          <div className="flex items-center gap-0 border-b border-paper-3 dark:border-ink-3">
            {(['overview', 'sweep', 'walkforward', 'ai'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setResultTab(tab)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
                  resultTab === tab
                    ? 'border-jade text-jade'
                    : 'border-transparent text-muted-l hover:text-ink-text dark:hover:text-paper',
                )}
              >
                {tab === 'overview' && 'OVERVIEW'}
                {tab === 'sweep' && 'SWEEP'}
                {tab === 'walkforward' && 'WALK-FWD'}
                {tab === 'ai' && 'AI REVIEW'}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {resultTab === 'overview' && (
            <>
              {/* Out-of-sample split — 70/30 train/test with stability verdict */}
              {oos ? (
                <OOSPanel oos={oos} loading={loadingOos} />
              ) : (
                loadingOos && (
                  <div className="card flex items-center gap-3 px-5 py-4 text-sm text-muted-l dark:text-muted-d">
                    <Loader2 className="h-4 w-4 animate-spin text-jade" />
                    Running out-of-sample split…
                  </div>
                )
              )}
            </>
          )}

          {/* Sweep tab */}
          {resultTab === 'sweep' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
                    Parameter sweep
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-l dark:text-muted-d">
                    Grid search over fast/slow periods. Best by Sharpe.
                  </p>
                </div>
                <button
                  onClick={triggerSweep}
                  disabled={loadingSweep}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-jade px-3 py-1.5 text-xs font-medium text-paper hover:bg-jade-deep disabled:opacity-50"
                >
                  {loadingSweep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  Run sweep
                </button>
              </div>
              {loadingSweep && (
                <div className="shimmer h-56 rounded-sm" />
              )}
              {sweep && !loadingSweep && (
                <SweepView result={sweep} bestKey={sweep.best_key} />
              )}
              {!loadingSweep && !sweep && (
                <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-6 text-center text-xs text-muted-l dark:text-muted-d">
                  Click "Run sweep" to explore parameter space
                </div>
              )}
            </div>
          )}

          {/* Walk-forward tab */}
          {resultTab === 'walkforward' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
                    Walk-forward validation
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-l dark:text-muted-d">
                    Rolling 100-bar train / 20-bar test windows.
                  </p>
                </div>
                <button
                  onClick={triggerWf}
                  disabled={loadingWf}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-jade px-3 py-1.5 text-xs font-medium text-paper hover:bg-jade-deep disabled:opacity-50"
                >
                  {loadingWf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  Run walk-forward
                </button>
              </div>
              {loadingWf && (
                <div className="shimmer h-56 rounded-sm" />
              )}
              {wf && !loadingWf && (
                <WalkForwardView result={wf} candles={view.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))} />
              )}
              {!loadingWf && !wf && (
                <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-6 text-center text-xs text-muted-l dark:text-muted-d">
                  Click "Run walk-forward" to validate across rolling windows
                </div>
              )}
            </div>
          )}

          {/* AI Review tab */}
          {resultTab === 'ai' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-jade" />
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
                    AI Strategy Advisor
                  </div>
                </div>
                <button
                  onClick={triggerAiReview}
                  disabled={loadingAi}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-jade px-3 py-1.5 text-xs font-medium text-paper hover:bg-jade-deep disabled:opacity-50"
                >
                  {loadingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Get review
                </button>
              </div>
              {loadingAi && (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="shimmer h-12 rounded-sm" />
                  ))}
                </div>
              )}
              {aiReviews && !loadingAi && (
                <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-4">
                  {aiReviews.source !== 'heuristic' && (
                    <div className="mb-3 rounded-sm bg-jade/10 px-3 py-1.5 text-xs text-jade">
                      {aiReviews.source} · {aiReviews.message}
                    </div>
                  )}
                  <div className="space-y-2">
                    {aiReviews.reviews.map((r, i) => {
                      const t = toneMap[r.tone]
                      const RevIcon = t.icon
                      return (
                        <div key={i} className={cn('flex gap-3 rounded-sm border p-3', t.ring)}>
                          <RevIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', t.color)} />
                          <div>
                            <div className="text-sm font-medium text-ink-text dark:text-paper">{r.title}</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-l dark:text-muted-d">{r.body}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {!loadingAi && !aiReviews && (
                <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 p-6 text-center text-xs text-muted-l dark:text-muted-d">
                  Click "Get review" for LLM-powered critique
                </div>
              )}
            </div>
          )}

          {/* Monthly P&L Calendar */}
          {view.trades.length > 0 && (
            <PnLCalendar trades={view.trades} />
          )}

          {/* Trade log */}
          <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-3 dark:border-ink-3">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">Trade log</span>
              <span className="text-[10px] text-muted-l dark:text-muted-d">{view.trades.length} trades</span>
            </div>
            {view.trades.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-l dark:text-muted-d">
                This rule never triggered a trade on the window. Try a shorter lookback, a different instrument, or adjust the parameters.
              </p>
            ) : (
              <div className="scroll-quiet max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-paper-2 dark:bg-ink-2">
                    <tr className="border-b border-paper-3 dark:border-ink-3 text-left text-[10px] uppercase tracking-widest text-muted-l dark:text-muted-d">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Entry</th>
                      <th className="py-2 pr-3 font-medium">Exit</th>
                      <th className="py-2 pr-3 text-right font-medium">Bars</th>
                      <th className="py-2 text-right font-medium">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-3 dark:divide-ink-3">
                    {view.trades.map((t, i) => (
                      <tr key={i} className="hover:bg-paper-3/50 dark:hover:bg-ink/30 transition-colors">
                        <td className="py-1.5 pr-3 text-muted-l dark:text-muted-d">{i + 1}</td>
                        <td className="py-1.5 pr-3 num text-ink-text dark:text-paper">
                          {fmtBar(t.entryTime)}
                          <span className="ml-1 text-muted-l dark:text-muted-d">₹{num(t.entryPrice)}</span>
                        </td>
                        <td className="py-1.5 pr-3 num text-ink-text dark:text-paper">
                          {t.open ? (
                            <span className="text-brass">open</span>
                          ) : (
                            <>
                              {fmtBar(t.exitTime)}
                              <span className="ml-1 text-muted-l dark:text-muted-d">₹{num(t.exitPrice)}</span>
                            </>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right num text-muted-l dark:text-muted-d">{t.bars}</td>
                        <td className={cn('py-1.5 text-right num font-medium', t.retPct >= 0 ? 'text-sage' : 'text-clay')}>{pct(t.retPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>


          <Disclaimer />
        </div>
      </div>
    </div>
  )
}

function SourceBadge({
  source,
  loading,
  ticker,
  start,
  end,
  intraday,
  interval,
}: {
  source: 'live' | 'demo'
  loading: boolean
  ticker?: string
  start?: string | number
  end?: string | number
  intraday?: boolean
  interval: string
}) {
  if (source === 'live') {
    // Year range only reads well for daily EOD (string 'yyyy-…') times.
    const range =
      !intraday && typeof start === 'string' && typeof end === 'string' ? `${start.slice(0, 4)}–${end.slice(0, 4)}` : ''
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/[0.08] px-2.5 py-1 text-[11px] font-medium text-sage">
        <Radio className="h-3 w-3" />
        Live NSE {intraday ? interval : 'end-of-day'} · {ticker}
        {range && <span className="font-normal text-sage/70">· {range}</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-paper-3 bg-paper-3/40 px-2.5 py-1 text-[11px] font-medium text-muted-l dark:border-ink-3 dark:bg-ink-3/40 dark:text-muted-d">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3" />}
      {loading ? 'Checking live engine…' : 'Demo data · start the engine for live NSE data'}
    </span>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-l dark:text-muted-d">{label}</div>
      <div className="num text-sm text-ink-text dark:text-paper">{value}</div>
    </div>
  )
}

function SaveStrategyButton({ cfg, symbol, interval, metrics, trades, equity }: {
  cfg: { template: Template; fast: number; slow: number; costBps: number; mode: 'template' | 'rules'; rules?: StrategyDSL }
  symbol: string
  interval: string
  metrics: Metrics
  trades: Trade[]
  equity: { time: string | number; value: number }[]
}) {
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSave = () => {
    if (saving) return
    const name = prompt('Name this strategy:', `${symbol} · ${cfg.mode === 'rules' ? 'custom' : cfg.template} · ${interval}`)
    if (!name) return
    setSaving(true)
    const s: SavedStrategy = {
      id: `s_${Date.now()}`,
      name,
      mode: cfg.mode,
      template: cfg.template,
      rules: cfg.mode === 'rules' && cfg.rules ? { entry: cfg.rules.entry, exit: cfg.rules.exit, risk: cfg.rules.risk } : undefined,
      symbol,
      interval,
      fast: cfg.fast,
      slow: cfg.slow,
      costBps: cfg.costBps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastResult: { metrics, trades, equity },
    }
    saveStrategy(s)
    setSaving(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
        done
          ? 'bg-sage/20 text-sage'
          : 'border border-paper-3 bg-paper text-ink-text hover:border-jade/40 hover:text-jade dark:border-ink-3 dark:bg-ink dark:text-paper dark:hover:text-jade-soft',
        saving && 'opacity-50 cursor-not-allowed',
      )}
    >
      {done
        ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
        : <><Sparkles className="h-4 w-4" /> Save strategy</>
      }
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">{label}</div>
      {children}
    </div>
  )
}

function NumField({ label, value, onChange, min = 2 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="num w-full rounded-sm border border-paper-3 bg-paper px-2 py-1.5 text-xs text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
      />
    </Field>
  )
}

function OOSPanel({ oos, loading }: { oos: OOSResult; loading: boolean }) {
  const s = oos.stability
  const gradeColor =
    s.grade === 'stable'
      ? 'text-sage bg-sage/10 border-sage/30'
      : s.grade === 'mild'
        ? 'text-brass bg-brass/10 border-brass/30'
        : 'text-clay bg-clay/10 border-clay/30'
  return (
    <div className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-3 dark:border-ink-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
            Out-of-sample · {oos.train.bars} / {oos.test.bars} bars
          </div>
          <div className={cn('mt-1 inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-medium', gradeColor)}>
            {s.label}
          </div>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-l dark:text-muted-d" />}
      </div>

      <div className="grid grid-cols-2 divide-x divide-paper-3 border-t border-paper-3 dark:divide-ink-3 dark:border-ink-3">
        <div className="px-4 py-2.5">
          <div className="text-[9px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">Train (70%)</div>
          <div className="mt-0.5 num text-base font-semibold text-ink-text dark:text-paper">{pct(oos.train.metrics.totalReturn)}</div>
          <div className="num text-[10px] text-muted-l dark:text-muted-d">CAGR {pct(oos.train.metrics.cagr)} · Sharpe {num(oos.train.metrics.sharpe, 2)}</div>
          <div className="num text-[10px] text-muted-l dark:text-muted-d">{oos.train.metrics.trades} trades · {num(oos.train.metrics.exposure, 0)}% exposure</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[9px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">Test (30%)</div>
          <div className={cn('mt-0.5 num text-base font-semibold', oos.test.metrics.totalReturn >= 0 ? 'text-sage' : 'text-clay')}>
            {pct(oos.test.metrics.totalReturn)}
          </div>
          <div className="num text-[10px] text-muted-l dark:text-muted-d">CAGR {pct(oos.test.metrics.cagr)} · Sharpe {num(oos.test.metrics.sharpe, 2)}</div>
          <div className="num text-[10px] text-muted-l dark:text-muted-d">{oos.test.metrics.trades} trades · {num(oos.test.metrics.exposure, 0)}% exposure</div>
        </div>
      </div>

      {s.details && (
        <div className="border-t border-paper-3 px-4 py-2 text-[11px] text-muted-l dark:text-muted-d dark:border-ink-3">
          {s.details}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="p-3 bg-paper-2 dark:bg-ink-2">
      <div className="text-[9px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">{label}</div>
      <div
        className={cn(
          'num mt-0.5 text-base font-semibold',
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
