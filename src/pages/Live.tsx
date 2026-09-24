import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, Circle, Wallet, ArrowRight } from 'lucide-react'
import { useMode } from '../state/ModeProvider'
import { getCandles } from '../lib/demoData'
import { computeSignal, type Regime } from '../lib/signal'
import { defaultStrategy } from '../lib/strategies'
import { LiveChart } from '../components/LiveChart'
import { Badge } from '../components/Badge'
import { useLiveTick } from '../lib/useLiveTick'
import { inr, num, pct } from '../lib/format'
import { cn } from '../lib/cn'

const REGIMES: Regime[] = ['Choppy', 'Trending', 'Volatile']
const REGIME_TONE: Record<Regime, string> = {
  Choppy: 'bg-muted-l dark:bg-muted-d',
  Trending: 'bg-jade',
  Volatile: 'bg-brass',
}

function RegimeRibbon({ active, vol }: { active: Regime; vol: number }) {
  return (
    <div className="mt-3 border-t border-paper-3 pt-3 dark:border-ink-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
          Market regime
        </span>
        <span className="num text-[10px] text-muted-l dark:text-muted-d">ann. vol {num(vol, 1)}%</span>
      </div>
      <div className="flex gap-1">
        {REGIMES.map((r) => {
          const on = r === active
          return (
            <div key={r} className="flex-1">
              <div className={cn('h-1 rounded-sm transition-colors', on ? REGIME_TONE[r] : 'bg-paper-3 dark:bg-ink-3')} />
              <div
                className={cn(
                  'mt-1 text-center text-[10px]',
                  on ? 'font-medium text-ink-text dark:text-paper' : 'text-muted-l dark:text-muted-d',
                )}
              >
                {r}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LiveHeader({ symbol }: { symbol: string }) {
  const tick = useLiveTick(symbol)
  const up = tick.change >= 0
  return (
    <div className="text-right">
      <div
        className="flex items-center justify-end gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d"
        title={tick.live ? 'Real NSE price via Yahoo, delayed about 15 minutes' : 'Simulated — backend offline'}
      >
        <span className="relative flex h-1.5 w-1.5">
          {tick.live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage/60" />}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', tick.live ? 'bg-sage' : 'bg-muted-l dark:bg-muted-d')} />
        </span>
        {symbol} · {tick.live ? 'live' : 'sim'}
      </div>
      <div className="num mt-0.5 text-2xl font-semibold text-ink-text dark:text-paper">{num(tick.price)}</div>
      <div className={cn('num flex items-center justify-end gap-1 text-sm', up ? 'text-sage' : 'text-clay')}>
        {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        {pct(tick.changePct)}
      </div>
    </div>
  )
}

function TradingLive() {
  const symbol = 'NIFTY 50'
  const candles = useMemo(() => getCandles(symbol, 180), [])
  const signal = useMemo(() => computeSignal(candles), [candles])
  const strat = defaultStrategy('trading')!
  const positive = signal.trend === 'positive'

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-jade">
                BEST TRADING STRATEGY · LIVE
              </span>
              {strat.badges.map((b) => (
                <Badge key={b} kind={b} />
              ))}
            </div>
            <h1 className="mt-1.5 flex items-center gap-2 font-display text-2xl leading-tight text-ink-text dark:text-paper sm:text-3xl">
              <Circle className={cn('h-2.5 w-2.5 shrink-0 fill-current', positive ? 'text-sage' : 'text-clay')} />
              {positive ? 'Trend is positive.' : 'Trend has turned.'}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-l dark:text-muted-d">
              {positive
                ? `${strat.name} is holding ${symbol}, sized to a steady risk budget.`
                : `${strat.name} has stepped aside to cash while the trend is negative.`}
            </p>
          </div>
          <LiveHeader symbol={symbol} />
        </div>

        <div className="border-t border-paper-3 px-1 pb-1 pt-1 dark:border-ink-3">
          <LiveChart symbol={symbol} height={280} />
        </div>

        <RegimeRibbon active={signal.regime} vol={signal.annVolPct} />
      </section>

      <div className="grid grid-cols-2 gap-px bg-paper-3 dark:bg-ink-3 border border-paper-3 dark:border-ink-3">
        <PositionTile label="Position" value={signal.position} tone={positive ? 'up' : 'neutral'} />
        <PositionTile label="3-mo momentum" value={pct(signal.momentumPct)} tone={signal.momentumPct >= 0 ? 'up' : 'down'} />
        <PositionTile label="20d vs 50d MA" value={signal.fast >= signal.slow ? 'Above' : 'Below'} tone={signal.fast >= signal.slow ? 'up' : 'down'} />
        <PositionTile label="Regime" value={signal.regime} />
      </div>

      <Link
        to={`/strategies/${strat.id}`}
        className="flex items-center justify-between gap-4 border border-paper-3 bg-paper-2 hover:bg-paper-3/50 dark:border-ink-3 dark:bg-ink-2 dark:hover:bg-ink transition-colors p-4"
      >
        <div>
          <div className="font-display text-base text-ink-text dark:text-paper">How this strategy works</div>
          <p className="mt-0.5 text-xs text-muted-l dark:text-muted-d">{strat.tagline}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-jade" />
      </Link>
    </div>
  )
}

function PositionTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={cn(
      'p-3',
      tone === 'up' ? 'bg-sage/5 border border-sage/20' :
      tone === 'down' ? 'bg-clay/5 border border-clay/20' :
      'bg-paper-2 border border-paper-3 dark:bg-ink-2 dark:border-ink-3',
    )}>
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">{label}</div>
      <div
        className={cn(
          'num mt-0.5 text-lg font-semibold',
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

const SLEEVES = [
  { name: 'Quality', proxy: 'Nifty200 Quality 30', weight: 0.3 },
  { name: 'Low Volatility', proxy: 'Nifty Low Vol 50', weight: 0.25 },
  { name: 'Momentum', proxy: 'Nifty200 Momentum 30', weight: 0.25 },
  { name: 'Value', proxy: 'Nifty500 Value 50', weight: 0.1 },
  { name: 'Cash buffer', proxy: 'Liquid / T-bills', weight: 0.1 },
]
const PRESETS = [50000, 100000, 500000]

function InvestingLive() {
  const symbol = 'NIFTY 50'
  const candles = useMemo(() => getCandles(symbol, 180), [])
  const signal = useMemo(() => computeSignal(candles), [candles])
  const strat = defaultStrategy('investing')!
  const [budget, setBudget] = useState(100000)
  const constructive = signal.trend === 'positive'

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-jade">
                BEST INVESTING STRATEGY · LIVE
              </span>
              {strat.badges.map((b) => (
                <Badge key={b} kind={b} />
              ))}
            </div>
            <h1 className="mt-1.5 flex items-center gap-2 font-display text-2xl leading-tight text-ink-text dark:text-paper sm:text-3xl">
              <Circle className={cn('h-2.5 w-2.5 shrink-0 fill-current', constructive ? 'text-sage' : 'text-brass')} />
              {constructive ? 'Backdrop is constructive.' : 'Stay defensive.'}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-l dark:text-muted-d">
              {strat.name} stays fully diversified across factor sleeves and rebalances on a schedule — it does not try
              to time the market.
            </p>
          </div>
          <LiveHeader symbol={symbol} />
        </div>
        <div className="border-t border-paper-3 px-1 pb-1 pt-1 dark:border-ink-3">
          <LiveChart symbol={symbol} height={240} />
        </div>
      </section>

      <section className="border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-paper-3 dark:border-ink-3">
          <Wallet className="h-4 w-4 text-jade" />
          <h2 className="font-display text-base text-ink-text dark:text-paper">Budget → allocation</h2>
        </div>
        <p className="px-4 pt-2 pb-1 text-xs text-muted-l dark:text-muted-d">
          Enter what you'd invest and see how the strategy would split it. Illustrative weights, not advice.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
          <div className="flex items-center rounded-sm border border-paper-3 bg-paper px-2.5 dark:border-ink-3 dark:bg-ink">
            <span className="text-muted-l dark:text-muted-d text-xs">₹</span>
            <input
              type="number"
              value={budget}
              min={0}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
              className="num w-32 bg-transparent px-1.5 py-1.5 text-sm text-ink-text outline-none dark:text-paper"
            />
          </div>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setBudget(p)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                budget === p
                  ? 'bg-jade/12 text-jade-deep dark:text-jade-soft border border-jade/30'
                  : 'bg-paper-3/70 text-muted-l hover:text-ink-text dark:bg-ink-3/70 dark:text-muted-d dark:hover:text-paper border border-paper-3 dark:border-ink-3',
              )}
            >
              {inr(p, { compact: true })}
            </button>
          ))}
        </div>

        <div className="mt-4 border-t border-paper-3 dark:border-ink-3">
          {SLEEVES.map((s, i) => (
            <div
              key={s.name}
              className={cn(
                'flex items-center gap-4 px-4 py-2.5',
                i !== 0 && 'border-t border-paper-3 dark:border-ink-3',
              )}
            >
              <div className="w-28 shrink-0">
                <div className="text-sm font-medium text-ink-text dark:text-paper">{s.name}</div>
                <div className="text-[11px] text-muted-l dark:text-muted-d">{s.proxy}</div>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-3 dark:bg-ink-3">
                <div className="h-full rounded-full bg-jade" style={{ width: `${s.weight * 100}%` }} />
              </div>
              <div className="w-10 text-right text-xs text-muted-l dark:text-muted-d">{Math.round(s.weight * 100)}%</div>
              <div className="num w-24 text-right text-sm text-ink-text dark:text-paper">{inr(budget * s.weight, { decimals: 0 })}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function Live() {
  const { mode } = useMode()
  return mode === 'trading' ? <TradingLive /> : <InvestingLive />
}
