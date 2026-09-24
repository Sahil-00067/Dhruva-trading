import type { Candle } from './demoData'

export type Template = 'ma' | 'rsi' | 'breakout'

// ---- Custom-strategy DSL --------------------------------------------------
// A whitelisted, bounded rule language. It is DATA, never code — the engine
// interprets it; nothing is eval'd. An LLM can later emit this exact shape from
// a plain-English idea, hitting the same validation boundary the backend enforces.

export type MacdLine = 'macd' | 'signal' | 'hist'
export type BollBand = 'upper' | 'lower' | 'mid'
export type Operand =
  | { kind: 'price' }
  | { kind: 'const'; value: number }
  | { kind: 'sma'; n: number }
  | { kind: 'ema'; n: number }
  | { kind: 'rsi'; n: number }
  | { kind: 'roc'; n: number } // percent change over the prior n bars
  | { kind: 'atr'; n: number } // Wilder average true range
  | { kind: 'adx'; n: number } // Wilder ADX (trend strength)
  | { kind: 'stoch'; n: number } // stochastic %K
  | { kind: 'high'; n: number } // rolling high of the prior n bars
  | { kind: 'low'; n: number } // rolling low of the prior n bars
  | { kind: 'prevhigh' } // yesterday's bar high
  | { kind: 'prevlow' } // yesterday's bar low
  | { kind: 'macd'; fast: number; slow: number; signal: number; line: MacdLine }
  | { kind: 'boll'; n: number; k: number; band: BollBand }

export type Op =
  | 'gt'
  | 'lt'
  | 'cross_above'
  | 'cross_below'
  | 'rises_for' // left rose for `bars` consecutive bars (right ignored)
  | 'falls_for' // left fell for `bars` consecutive bars (right ignored)
  | 'stays_above' // left > right held for the last `bars` bars
  | 'stays_below' // left < right held for the last `bars` bars
  | 'within_pct' // |left - right| <= pct% of |right|

// `bars` is used by *_for / stays_* operators; `pct` by within_pct.
export type Condition = { left: Operand; op: Op; right: Operand; bars?: number; pct?: number }

// A node is either a single condition or one level of AND/OR grouping (depth capped at 2).
export type Group = { op: 'all' | 'any'; conds: Condition[] }
export type Node = Condition | Group

// Position-management overlay, checked while in a trade before the rule exits fire.
export type RiskExits = {
  stopLossPct?: number // exit if price falls this % below entry
  takeProfitPct?: number // exit if price rises this % above entry
  trailPct?: number // exit if price falls this % below the peak close since entry
  maxHoldBars?: number // exit after this many bars in the position
}

export type StrategyDSL = {
  entry: Node[] // ALL nodes must be true to open a long
  exit: Node[] // ANY node true closes the position
  risk?: RiskExits
}

// Narrow a Node to a Group (a Condition has a `left` operand; a Group has `conds`).
export function isGroup(n: Node): n is Group {
  return (n as Group).conds !== undefined
}

export type BacktestConfig = {
  template: Template
  fast: number
  slow: number
  costBps: number // round-trip cost in basis points applied on position change
  mode?: 'template' | 'rules' // default 'template'
  rules?: StrategyDSL // used when mode === 'rules'
}

export type Trade = {
  entryIndex: number
  exitIndex: number
  // 'yyyy-mm-dd' for daily bars; a unix timestamp (IST wall-clock) for intraday.
  entryTime: string | number
  exitTime: string | number
  entryPrice: number
  exitPrice: number
  retPct: number
  bars: number
  open: boolean // still open at end of window
}

export type Metrics = {
  cagr: number
  sharpe: number
  maxDD: number
  winRate: number
  trades: number
  exposure: number
  totalReturn: number
}

export type BacktestResult = {
  equity: { time: string | number; value: number }[]
  metrics: Metrics
  trades: Trade[]
}

function smaSeries(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN)
  let sum = 0
  for (let i = 0; i < v.length; i++) {
    sum += v[i]
    if (i >= n) sum -= v[i - n]
    if (i >= n - 1) out[i] = sum / n
  }
  return out
}

function rsiSeries(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN)
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i < v.length; i++) {
    const ch = v[i] - v[i - 1]
    const gain = Math.max(ch, 0)
    const loss = Math.max(-ch, 0)
    if (i <= n) {
      avgGain += gain / n
      avgLoss += loss / n
      if (i === n) out[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-9))
    } else {
      avgGain = (avgGain * (n - 1) + gain) / n
      avgLoss = (avgLoss * (n - 1) + loss) / n
      out[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-9))
    }
  }
  return out
}

function highSeries(v: number[], n: number): number[] {
  // Rolling max of the n bars *before* i (no look-ahead).
  const out = new Array(v.length).fill(NaN)
  for (let i = n; i < v.length; i++) {
    let hi = -Infinity
    for (let j = i - n; j < i; j++) if (v[j] > hi) hi = v[j]
    out[i] = hi
  }
  return out
}

function lowSeries(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN)
  for (let i = n; i < v.length; i++) {
    let lo = Infinity
    for (let j = i - n; j < i; j++) if (v[j] < lo) lo = v[j]
    out[i] = lo
  }
  return out
}

// Wilder-style EMA seeded with an SMA of the first n values (matches most charting tools).
function emaSeries(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN)
  if (v.length < n) return out
  const kf = 2 / (n + 1)
  let seed = 0
  for (let i = 0; i < n; i++) seed += v[i]
  let prev = seed / n
  out[n - 1] = prev
  for (let i = n; i < v.length; i++) {
    prev = (v[i] - prev) * kf + prev
    out[i] = prev
  }
  return out
}

// Percent change over the prior n bars.
function rocSeries(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN)
  for (let i = n; i < v.length; i++) {
    const base = v[i - n]
    if (base !== 0) out[i] = ((v[i] - base) / base) * 100
  }
  return out
}

// True range for each bar (needs prior close), then Wilder-smoothed to ATR.
function atrSeries(high: number[], low: number[], close: number[], n: number): number[] {
  const len = close.length
  const tr = new Array(len).fill(NaN)
  for (let i = 0; i < len; i++) {
    if (i === 0) tr[i] = high[i] - low[i]
    else tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  }
  const out = new Array(len).fill(NaN)
  if (len <= n) return out
  let sum = 0
  for (let i = 1; i <= n; i++) sum += tr[i]
  let prev = sum / n
  out[n] = prev
  for (let i = n + 1; i < len; i++) {
    prev = (prev * (n - 1) + tr[i]) / n
    out[i] = prev
  }
  return out
}

// Wilder DMI → ADX (trend strength, 0–100).
function adxSeries(high: number[], low: number[], close: number[], n: number): number[] {
  const len = close.length
  const out = new Array(len).fill(NaN)
  if (len <= 2 * n) return out
  const tr = new Array(len).fill(0)
  const plusDM = new Array(len).fill(0)
  const minusDM = new Array(len).fill(0)
  for (let i = 1; i < len; i++) {
    const up = high[i] - high[i - 1]
    const down = low[i - 1] - low[i]
    plusDM[i] = up > down && up > 0 ? up : 0
    minusDM[i] = down > up && down > 0 ? down : 0
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  }
  // Wilder-smoothed TR / +DM / -DM, seeded with the first n sums (indices 1..n).
  let trS = 0
  let pS = 0
  let mS = 0
  for (let i = 1; i <= n; i++) {
    trS += tr[i]
    pS += plusDM[i]
    mS += minusDM[i]
  }
  const dx = new Array(len).fill(NaN)
  const dxAt = (i: number) => {
    const pDI = trS === 0 ? 0 : (100 * pS) / trS
    const mDI = trS === 0 ? 0 : (100 * mS) / trS
    const denom = pDI + mDI
    dx[i] = denom === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / denom
  }
  dxAt(n)
  for (let i = n + 1; i < len; i++) {
    trS = trS - trS / n + tr[i]
    pS = pS - pS / n + plusDM[i]
    mS = mS - mS / n + minusDM[i]
    dxAt(i)
  }
  // ADX = Wilder average of DX, first value at index 2n-1 (n DX values from index n..2n-1).
  let dxSum = 0
  for (let i = n; i <= 2 * n - 1; i++) dxSum += dx[i]
  let prev = dxSum / n
  out[2 * n - 1] = prev
  for (let i = 2 * n; i < len; i++) {
    prev = (prev * (n - 1) + dx[i]) / n
    out[i] = prev
  }
  return out
}

// Stochastic %K over n bars (inclusive of the current bar).
function stochSeries(high: number[], low: number[], close: number[], n: number): number[] {
  const len = close.length
  const out = new Array(len).fill(NaN)
  for (let i = n - 1; i < len; i++) {
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - n + 1; j <= i; j++) {
      if (high[j] > hi) hi = high[j]
      if (low[j] < lo) lo = low[j]
    }
    const range = hi - lo
    out[i] = range === 0 ? 0 : ((close[i] - lo) / range) * 100
  }
  return out
}

// MACD line / signal / histogram from close.
function macdSeries(close: number[], fast: number, slow: number, signal: number): { line: number[]; signal: number[]; hist: number[] } {
  const ef = emaSeries(close, fast)
  const es = emaSeries(close, slow)
  const line = close.map((_, i) => (isNaN(ef[i]) || isNaN(es[i]) ? NaN : ef[i] - es[i]))
  // Signal = EMA of the MACD line over its defined region.
  const startsAt = line.findIndex((x) => !isNaN(x))
  const sig = new Array(close.length).fill(NaN)
  if (startsAt >= 0 && close.length - startsAt >= signal) {
    const seg = line.slice(startsAt)
    const es2 = emaSeries(seg, signal)
    for (let i = 0; i < es2.length; i++) sig[startsAt + i] = es2[i]
  }
  const hist = line.map((v, i) => (isNaN(v) || isNaN(sig[i]) ? NaN : v - sig[i]))
  return { line, signal: sig, hist }
}

// Rolling population standard deviation over n bars (inclusive).
function stdevSeries(v: number[], n: number): number[] {
  const len = v.length
  const out = new Array(len).fill(NaN)
  for (let i = n - 1; i < len; i++) {
    let sum = 0
    for (let j = i - n + 1; j <= i; j++) sum += v[j]
    const mean = sum / n
    let acc = 0
    for (let j = i - n + 1; j <= i; j++) acc += (v[j] - mean) ** 2
    out[i] = Math.sqrt(acc / n)
  }
  return out
}

function bollSeries(close: number[], n: number, k: number, band: BollBand): number[] {
  const mid = smaSeries(close, n)
  if (band === 'mid') return mid
  const sd = stdevSeries(close, n)
  return close.map((_, i) => {
    if (isNaN(mid[i]) || isNaN(sd[i])) return NaN
    return band === 'upper' ? mid[i] + k * sd[i] : mid[i] - k * sd[i]
  })
}

// OHLC source series shared by every operand resolver (close-only strategies still work).
type Src = { high: number[]; low: number[]; close: number[] }

// Resolve an operand to a per-bar numeric series (NaN where not yet defined).
function operandSeries(op: Operand, s: Src): number[] {
  const close = s.close
  switch (op.kind) {
    case 'price':
      return close
    case 'const':
      return new Array(close.length).fill(op.value)
    case 'sma':
      return smaSeries(close, op.n)
    case 'ema':
      return emaSeries(close, op.n)
    case 'rsi':
      return rsiSeries(close, op.n)
    case 'roc':
      return rocSeries(close, op.n)
    case 'atr':
      return atrSeries(s.high, s.low, close, op.n)
    case 'adx':
      return adxSeries(s.high, s.low, close, op.n)
    case 'stoch':
      return stochSeries(s.high, s.low, close, op.n)
    case 'high':
      return highSeries(close, op.n)
    case 'low':
      return lowSeries(close, op.n)
    case 'prevhigh':
      return s.high.map((_, i) => (i === 0 ? NaN : s.high[i - 1]))
    case 'prevlow':
      return s.low.map((_, i) => (i === 0 ? NaN : s.low[i - 1]))
    case 'macd': {
      const m = macdSeries(close, op.fast, op.slow, op.signal)
      return op.line === 'signal' ? m.signal : op.line === 'hist' ? m.hist : m.line
    }
    case 'boll':
      return bollSeries(close, op.n, op.k, op.band)
  }
}

// Evaluate one condition across all bars → boolean[] (false where inputs are NaN).
function evalCondition(c: Condition, s: Src): boolean[] {
  const len = s.close.length
  const L = operandSeries(c.left, s)
  const R = operandSeries(c.right, s)
  const out = new Array(len).fill(false)
  const bars = Math.max(2, Math.min(100, c.bars ?? 2))

  for (let i = 0; i < len; i++) {
    const l = L[i]
    const r = R[i]
    switch (c.op) {
      case 'gt':
        if (!isNaN(l) && !isNaN(r)) out[i] = l > r
        break
      case 'lt':
        if (!isNaN(l) && !isNaN(r)) out[i] = l < r
        break
      case 'within_pct': {
        if (!isNaN(l) && !isNaN(r)) {
          const tol = (Math.abs(r) * (c.pct ?? 1)) / 100
          out[i] = Math.abs(l - r) <= tol
        }
        break
      }
      case 'cross_above':
      case 'cross_below': {
        const lp = i > 0 ? L[i - 1] : NaN
        const rp = i > 0 ? R[i - 1] : NaN
        if (isNaN(l) || isNaN(r) || isNaN(lp) || isNaN(rp)) break
        out[i] = c.op === 'cross_above' ? lp <= rp && l > r : lp >= rp && l < r
        break
      }
      case 'rises_for':
      case 'falls_for': {
        if (i < bars) break
        let ok = true
        for (let j = i - bars + 1; j <= i; j++) {
          const a = L[j]
          const b = L[j - 1]
          if (isNaN(a) || isNaN(b) || (c.op === 'rises_for' ? a <= b : a >= b)) {
            ok = false
            break
          }
        }
        out[i] = ok
        break
      }
      case 'stays_above':
      case 'stays_below': {
        if (i < bars - 1) break
        let ok = true
        for (let j = i - bars + 1; j <= i; j++) {
          const a = L[j]
          const b = R[j]
          if (isNaN(a) || isNaN(b) || (c.op === 'stays_above' ? a <= b : a >= b)) {
            ok = false
            break
          }
        }
        out[i] = ok
        break
      }
    }
  }
  return out
}

// Evaluate a node (single condition, or a one-level all/any group) across all bars.
function evalNode(node: Node, s: Src): boolean[] {
  if (!isGroup(node)) return evalCondition(node, s)
  const evals = node.conds.map((c) => evalCondition(c, s))
  const len = s.close.length
  const out = new Array(len).fill(false)
  if (evals.length === 0) return out
  for (let i = 0; i < len; i++) {
    out[i] = node.op === 'all' ? evals.every((e) => e[i]) : evals.some((e) => e[i])
  }
  return out
}

// Rules-based long/flat series: enter when ALL entry nodes hold; while in a position, risk exits
// fire first, then ANY exit node. No look-ahead — every series is defined through bar i only.
function rulesPositions(candles: Candle[], dsl: StrategyDSL): number[] {
  const s: Src = { high: candles.map((c) => c.high), low: candles.map((c) => c.low), close: candles.map((c) => c.close) }
  const close = s.close
  const pos = new Array(close.length).fill(0)
  const entryEvals = dsl.entry.map((n) => evalNode(n, s))
  const exitEvals = dsl.exit.map((n) => evalNode(n, s))
  const risk = dsl.risk
  let inPos = 0
  let entryPrice = 0
  let peak = 0
  let heldBars = 0

  for (let i = 0; i < close.length; i++) {
    const entry = entryEvals.length > 0 && entryEvals.every((e) => e[i])
    const ruleExit = exitEvals.length > 0 && exitEvals.some((e) => e[i])

    if (inPos === 1) {
      peak = Math.max(peak, close[i])
      heldBars++
      let riskExit = false
      if (risk) {
        if (risk.stopLossPct != null && close[i] <= entryPrice * (1 - risk.stopLossPct / 100)) riskExit = true
        else if (risk.takeProfitPct != null && close[i] >= entryPrice * (1 + risk.takeProfitPct / 100)) riskExit = true
        else if (risk.trailPct != null && close[i] <= peak * (1 - risk.trailPct / 100)) riskExit = true
        else if (risk.maxHoldBars != null && heldBars >= risk.maxHoldBars) riskExit = true
      }
      if (riskExit || ruleExit) inPos = 0
    } else if (entry) {
      inPos = 1
      entryPrice = close[i]
      peak = close[i]
      heldBars = 0
    }
    pos[i] = inPos
  }
  return pos
}

// Build a long/flat position series (no look-ahead: position for day i uses data through i).
function positions(candles: Candle[], cfg: BacktestConfig): number[] {
  const close = candles.map((c) => c.close)
  const pos = new Array(close.length).fill(0)

  if (cfg.mode === 'rules' && cfg.rules) {
    return rulesPositions(candles, cfg.rules)
  }

  if (cfg.template === 'ma') {
    const f = smaSeries(close, cfg.fast)
    const s = smaSeries(close, cfg.slow)
    for (let i = 0; i < close.length; i++) pos[i] = !isNaN(s[i]) && f[i] > s[i] ? 1 : 0
  } else if (cfg.template === 'rsi') {
    const r = rsiSeries(close, cfg.fast)
    let inPos = 0
    for (let i = 0; i < close.length; i++) {
      if (!isNaN(r[i])) {
        if (inPos === 0 && r[i] < 30) inPos = 1
        else if (inPos === 1 && r[i] > 55) inPos = 0
      }
      pos[i] = inPos
    }
  } else {
    // Donchian breakout: enter on N-high, exit on N-low (N = slow).
    const N = cfg.slow
    let inPos = 0
    for (let i = 0; i < close.length; i++) {
      if (i >= N) {
        let hi = -Infinity
        let lo = Infinity
        for (let j = i - N; j < i; j++) {
          if (close[j] > hi) hi = close[j]
          if (close[j] < lo) lo = close[j]
        }
        if (inPos === 0 && close[i] > hi) inPos = 1
        else if (inPos === 1 && close[i] < lo) inPos = 0
      }
      pos[i] = inPos
    }
  }
  return pos
}

export function runBacktest(candles: Candle[], cfg: BacktestConfig, periodsPerYear = 252): BacktestResult {
  const close = candles.map((c) => c.close)
  const pos = positions(candles, cfg)
  const cost = cfg.costBps / 10000

  const equity: { time: string; value: number }[] = [{ time: candles[0].time, value: 100 }]
  const dailyRets: number[] = []
  const trades: Trade[] = []
  let value = 100
  let daysIn = 0

  let entryIndex = -1
  let entryPrice = 0

  for (let i = 1; i < close.length; i++) {
    const held = pos[i - 1] // yesterday's position earns today's return
    const changed = pos[i] !== pos[i - 1]
    let ret = held === 1 ? close[i] / close[i - 1] - 1 : 0
    if (changed) ret -= cost // entry/exit friction

    value *= 1 + ret
    dailyRets.push(ret)
    if (held === 1) daysIn++
    equity.push({ time: candles[i].time, value })

    if (pos[i] === 1 && pos[i - 1] === 0) {
      entryIndex = i
      entryPrice = close[i]
    } else if (pos[i] === 0 && pos[i - 1] === 1 && entryIndex >= 0) {
      const grossRet = close[i] / entryPrice - 1 - 2 * cost
      trades.push({
        entryIndex,
        exitIndex: i,
        entryTime: candles[entryIndex].time,
        exitTime: candles[i].time,
        entryPrice,
        exitPrice: close[i],
        retPct: grossRet * 100,
        bars: i - entryIndex,
        open: false,
      })
      entryIndex = -1
    }
  }
  // Close any open trade at the last bar.
  if (entryIndex >= 0) {
    const last = close.length - 1
    const grossRet = close[last] / entryPrice - 1 - cost
    trades.push({
      entryIndex,
      exitIndex: last,
      entryTime: candles[entryIndex].time,
      exitTime: candles[last].time,
      entryPrice,
      exitPrice: close[last],
      retPct: grossRet * 100,
      bars: last - entryIndex,
      open: true,
    })
  }

  const n = close.length
  const years = n / periodsPerYear
  const totalReturn = value / 100 - 1
  const cagr = Math.pow(value / 100, 1 / years) - 1

  const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length
  const variance = dailyRets.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyRets.length
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(periodsPerYear) : 0

  let peak = -Infinity
  let maxDD = 0
  for (const p of equity) {
    if (p.value > peak) peak = p.value
    const dd = p.value / peak - 1
    if (dd < maxDD) maxDD = dd
  }

  const wins = trades.filter((t) => t.retPct > 0).length

  return {
    equity,
    trades,
    metrics: {
      cagr: cagr * 100,
      sharpe,
      maxDD: maxDD * 100,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
      trades: trades.length,
      exposure: (daysIn / (n - 1)) * 100,
      totalReturn: totalReturn * 100,
    },
  }
}

// Plain-English description of exactly what the current config tests.
export function describeConfig(cfg: BacktestConfig, symbol: string, bars: number, unit = 'trading days'): string {
  const tail = ` Tested over the last ${bars} ${unit}, with ${cfg.costBps} bps of round-trip cost.`
  if (cfg.template === 'ma')
    return `Buy ${symbol} when its ${cfg.fast}-day average rises above the ${cfg.slow}-day average, and move to cash when it falls back below.${tail}`
  if (cfg.template === 'rsi')
    return `Buy ${symbol} when RSI(${cfg.fast}) drops below 30 (oversold), and sell when it climbs back above 55.${tail}`
  return `Go long ${symbol} when price breaks above its ${cfg.slow}-day high, and exit when it breaks the ${cfg.slow}-day low.${tail}`
}

// ---- DSL helpers: labels, validation, plain-English rendering -------------

export function operandLabel(op: Operand): string {
  switch (op.kind) {
    case 'price':
      return 'price'
    case 'const':
      return `${op.value}`
    case 'sma':
      return `${op.n}-day average`
    case 'ema':
      return `${op.n}-day EMA`
    case 'rsi':
      return `RSI(${op.n})`
    case 'roc':
      return `${op.n}-day % change`
    case 'atr':
      return `ATR(${op.n})`
    case 'adx':
      return `ADX(${op.n})`
    case 'stoch':
      return `Stochastic %K(${op.n})`
    case 'high':
      return `${op.n}-day high`
    case 'low':
      return `${op.n}-day low`
    case 'prevhigh':
      return "yesterday's high"
    case 'prevlow':
      return "yesterday's low"
    case 'macd': {
      const which = op.line === 'macd' ? 'line' : op.line === 'signal' ? 'signal' : 'histogram'
      return `MACD ${which}(${op.fast}/${op.slow}/${op.signal})`
    }
    case 'boll':
      return `${op.n}-day Bollinger ${op.band} (${op.k}σ)`
  }
}

const OP_WORDS: Record<Op, string> = {
  gt: 'is above',
  lt: 'is below',
  cross_above: 'crosses above',
  cross_below: 'crosses below',
  rises_for: 'rises for',
  falls_for: 'falls for',
  stays_above: 'stays above',
  stays_below: 'stays below',
  within_pct: 'is within',
}

export function conditionLabel(c: Condition): string {
  const bars = c.bars ?? 2
  switch (c.op) {
    case 'rises_for':
      return `${operandLabel(c.left)} rises for ${bars} bars`
    case 'falls_for':
      return `${operandLabel(c.left)} falls for ${bars} bars`
    case 'stays_above':
      return `${operandLabel(c.left)} stays above ${operandLabel(c.right)} for ${bars} bars`
    case 'stays_below':
      return `${operandLabel(c.left)} stays below ${operandLabel(c.right)} for ${bars} bars`
    case 'within_pct':
      return `${operandLabel(c.left)} is within ${c.pct ?? 1}% of ${operandLabel(c.right)}`
    default:
      return `${operandLabel(c.left)} ${OP_WORDS[c.op]} ${operandLabel(c.right)}`
  }
}

export function nodeLabel(n: Node): string {
  if (!isGroup(n)) return conditionLabel(n)
  const join = n.op === 'all' ? ' AND ' : ' OR '
  return `(${n.conds.map(conditionLabel).join(join)})`
}

// Longest lookback any operand needs — used to warn when the window is too short.
function operandWarmup(op: Operand): number {
  switch (op.kind) {
    case 'sma':
    case 'ema':
    case 'rsi':
    case 'roc':
    case 'atr':
    case 'stoch':
    case 'high':
    case 'low':
      return op.n
    case 'adx':
      return 2 * op.n
    case 'macd':
      return op.slow + op.signal
    case 'boll':
      return op.n
    default:
      return 0
  }
}

function conditionWarmup(c: Condition): number {
  const extra = c.op === 'rises_for' || c.op === 'falls_for' || c.op === 'stays_above' || c.op === 'stays_below' ? (c.bars ?? 2) : 0
  return Math.max(operandWarmup(c.left), operandWarmup(c.right)) + extra
}

function nodeConds(n: Node): Condition[] {
  return isGroup(n) ? n.conds : [n]
}

export function rulesWarmup(dsl: StrategyDSL): number {
  let w = 0
  for (const n of [...dsl.entry, ...dsl.exit]) for (const c of nodeConds(n)) w = Math.max(w, conditionWarmup(c))
  return w
}

// Validate a DSL before running. Returns an error string, or null if OK.
export function validateRules(dsl: StrategyDSL): string | null {
  if (dsl.entry.length === 0) return 'Add at least one entry (buy) condition.'
  if (dsl.exit.length === 0) return 'Add at least one exit (sell) condition.'
  if (dsl.entry.length > 6 || dsl.exit.length > 6) return 'Keep each side to 6 conditions or groups.'

  const checkOperand = (o: Operand): string | null => {
    if ('n' in o && (!Number.isFinite(o.n) || o.n < 2 || o.n > 400)) return 'Indicator lengths must be between 2 and 400.'
    if (o.kind === 'const' && !Number.isFinite(o.value)) return 'Threshold values must be numbers.'
    if (o.kind === 'macd') {
      if (!(o.fast < o.slow)) return 'MACD fast length must be below the slow length.'
      for (const x of [o.fast, o.slow, o.signal]) if (!Number.isFinite(x) || x < 2 || x > 400) return 'MACD lengths must be between 2 and 400.'
    }
    if (o.kind === 'boll' && (!Number.isFinite(o.k) || o.k < 0.5 || o.k > 5)) return 'Bollinger width must be between 0.5 and 5σ.'
    return null
  }
  const checkCond = (c: Condition): string | null => {
    const e = checkOperand(c.left) ?? checkOperand(c.right)
    if (e) return e
    if ((c.op === 'rises_for' || c.op === 'falls_for' || c.op === 'stays_above' || c.op === 'stays_below') && (!Number.isFinite(c.bars) || (c.bars ?? 0) < 2 || (c.bars ?? 0) > 100))
      return 'The "for N bars" count must be between 2 and 100.'
    if (c.op === 'within_pct' && (!Number.isFinite(c.pct) || (c.pct ?? -1) < 0 || (c.pct ?? -1) > 100)) return 'The "within %" value must be between 0 and 100.'
    return null
  }
  for (const n of [...dsl.entry, ...dsl.exit]) {
    if (isGroup(n)) {
      if (n.conds.length < 2) return 'A group needs at least 2 conditions (or make it a single condition).'
      if (n.conds.length > 6) return 'Keep each group to 6 conditions.'
    }
    for (const c of nodeConds(n)) {
      const e = checkCond(c)
      if (e) return e
    }
  }
  const r = dsl.risk
  if (r) {
    for (const [k, v] of Object.entries(r)) {
      if (v == null) continue
      if (!Number.isFinite(v)) return 'Risk-exit values must be numbers.'
      if (k === 'maxHoldBars') {
        if (v < 1 || v > 2000) return 'Max-hold bars must be between 1 and 2000.'
      } else if (v <= 0 || v > 100) {
        return 'Stop / target / trail percents must be between 0 and 100.'
      }
    }
  }
  return null
}

function riskLabel(r?: RiskExits): string {
  if (!r) return ''
  const parts: string[] = []
  if (r.stopLossPct != null) parts.push(`stop-loss ${r.stopLossPct}%`)
  if (r.takeProfitPct != null) parts.push(`take-profit ${r.takeProfitPct}%`)
  if (r.trailPct != null) parts.push(`${r.trailPct}% trailing stop`)
  if (r.maxHoldBars != null) parts.push(`max hold ${r.maxHoldBars} bars`)
  return parts.length ? ` Risk exits: ${parts.join(', ')}.` : ''
}

export function describeRules(dsl: StrategyDSL, symbol: string, bars: number, unit = 'trading days'): string {
  const entry = dsl.entry.map(nodeLabel).join(' AND ')
  const exit = dsl.exit.map(nodeLabel).join(' OR ')
  return `Buy ${symbol} when ${entry}. Sell when ${exit}.${riskLabel(dsl.risk)} Tested over the last ${bars} ${unit}.`
}

export type Review = { tone: 'good' | 'warn' | 'bad' | 'info'; title: string; body: string }

// Heuristic "AI review" — concrete, tailored to the computed stats.
// Phase 2 upgrades this to a real LLM critique grounded in out-of-sample tests.
export function reviewBacktest(m: Metrics, cfg: BacktestConfig): Review[] {
  const out: Review[] = []

  if (m.trades === 0) {
    out.push({ tone: 'warn', title: 'No trades triggered', body: 'This rule never fired in the window. Try a shorter average, a different instrument, or a longer history.' })
    return out
  }

  if (m.sharpe >= 1) out.push({ tone: 'good', title: 'Risk-adjusted return looks solid', body: `A Sharpe near ${m.sharpe.toFixed(2)} is respectable — but confirm it survives real costs and out-of-sample data.` })
  else if (m.sharpe >= 0.4) out.push({ tone: 'warn', title: 'Middling risk-adjusted return', body: `Sharpe ${m.sharpe.toFixed(2)} is modest. Look for a cleaner entry filter or steadier position sizing before trusting it.` })
  else out.push({ tone: 'bad', title: 'The edge is weak', body: `Sharpe ${m.sharpe.toFixed(2)} is hard to distinguish from noise. This configuration probably has no durable edge.` })

  if (m.maxDD <= -25) out.push({ tone: 'warn', title: 'Drawdown is punishing', body: `A ${m.maxDD.toFixed(0)}% drawdown is very hard to sit through. Add volatility targeting or cut exposure when volatility spikes.` })

  if (m.trades > 25) out.push({ tone: 'warn', title: 'High turnover', body: `${m.trades} trades means costs and slippage dominate. Re-run with higher fees and consider longer holds.` })

  if (cfg.mode === 'rules') out.push({ tone: 'info', title: "It's your rule — now stress it", body: "Custom rules are easy to overfit to one chart. Re-run on a different instrument and a longer window; an edge that only shows up here probably isn't real." })
  else if (cfg.template === 'rsi') out.push({ tone: 'info', title: 'Mean-reversion needs a regime filter', body: 'RSI dip-buying bleeds in strong downtrends. Gate it with a longer-term trend filter so you only fade inside a range.' })
  else if (cfg.template === 'breakout') out.push({ tone: 'info', title: 'Breakouts whipsaw in ranges', body: 'Require a volatility expansion (or an ATR-based stop) so you skip false breaks in quiet markets.' })
  else out.push({ tone: 'info', title: 'Trend crossovers lag turns', body: 'MA crossovers give back profit at reversals. A volatility filter or faster exit can soften the give-back.' })

  if (m.winRate > 0 && m.winRate < 45 && m.cagr > 0) out.push({ tone: 'info', title: "Don't over-fix the win rate", body: `A ${m.winRate.toFixed(0)}% win rate is normal for trend systems — the fat right tail carries returns. Tightening exits often makes it worse.` })

  out.push({ tone: 'warn', title: 'Validate before you trust it', body: 'These are in-sample results on one simulated path. Real confidence needs walk-forward, purged K-fold CV, and a Deflated Sharpe check.' })

  return out.slice(0, 5)
}
