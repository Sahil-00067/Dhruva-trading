import type { Candle } from './demoData'

export function sma(values: number[], n: number): number {
  if (values.length < n) return values.reduce((a, b) => a + b, 0) / values.length
  let s = 0
  for (let i = values.length - n; i < values.length; i++) s += values[i]
  return s / n
}

export type Regime = 'Trending' | 'Choppy' | 'Volatile'
export type Signal = {
  position: 'Long' | 'Flat'
  trend: 'positive' | 'negative'
  regime: Regime
  momentumPct: number // ~3-month
  annVolPct: number
  fast: number
  slow: number
}

// A transparent long/flat trend read used for the "best strategy" status hero.
// Deliberately simple and inspectable — the real engine lands in Phase 2.
export function computeSignal(candles: Candle[]): Signal {
  const closes = candles.map((c) => c.close)
  const n = closes.length
  const fast = sma(closes, 20)
  const slow = sma(closes, 50)

  const lookback = Math.min(63, n - 1)
  const momentumPct = (closes[n - 1] / closes[n - 1 - lookback] - 1) * 100

  // Annualised volatility from daily log returns.
  const rets: number[] = []
  for (let i = 1; i < n; i++) rets.push(Math.log(closes[i] / closes[i - 1]))
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  const annVolPct = Math.sqrt(variance) * Math.sqrt(252) * 100

  const trend: Signal['trend'] = fast >= slow && momentumPct >= 0 ? 'positive' : 'negative'
  const gapPct = (Math.abs(fast - slow) / slow) * 100

  let regime: Regime = 'Trending'
  if (annVolPct >= 22) regime = 'Volatile'
  else if (gapPct < 1.2) regime = 'Choppy'

  return {
    position: trend === 'positive' ? 'Long' : 'Flat',
    trend,
    regime,
    momentumPct,
    annVolPct,
    fast,
    slow,
  }
}
