// Client for the local backtest engine (backend/app/main.py), proxied at /api.
import type { Candle } from './demoData'
import type { Metrics, Trade, Review, Template, StrategyDSL } from './backtest'

// Use env var in production, fall back to /api for local dev (Vite proxy)
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export type LiveRequest = {
  template: Template
  symbol: string
  fast: number
  slow: number
  costBps: number
  lookback: number
  interval?: Interval
  mode?: 'template' | 'rules'
  rules?: StrategyDSL
}

export type LiveResult = {
  candles: Candle[]
  // Intraday times are unix timestamps (IST wall-clock); daily times are 'yyyy-mm-dd'.
  equity: { time: string | number; value: number }[]
  trades: Trade[]
  metrics: Metrics
  reviews: Review[]
  source: string
  symbol: string
  ticker: string
  interval: string
  intraday: boolean
  start: string | number
  end: string | number
}

export type OOSWindow = {
  metrics: Metrics
  trades: Trade[]
  equity: { time: string | number; value: number }[]
  bars: number
}

export type OOSResult = {
  train: OOSWindow
  test: OOSWindow
  stability: { grade: 'stable' | 'mild' | 'warning' | 'critical'; label: string; details: string }
  split: number
  total_bars: number
  symbol: string
  ticker: string
  interval: string
  intraday: boolean
  start: string | number
  end: string | number
}

export type SearchResult = {
  symbol: string
  name: string
  kind: 'index' | 'stock'
}

// Groww-style instrument search. Throws on any non-ok / network error so the caller
// can fall back to the bundled offline list.
export async function searchInstruments(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&limit=200`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchBacktest(req: LiveRequest, signal?: AbortSignal): Promise<LiveResult> {
  const res = await fetch(`${API_BASE}/api/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch {
      /* keep the status-code message */
    }
    throw new Error(detail)
  }
  return res.json()
}

// ---- Dhan broker link. The token lives server-side; the UI only ever sees a mask. ----
export type DhanStatus = { configured: boolean; clientId?: string; tokenMask?: string }
export type DhanProfile = {
  clientId?: string
  tokenValidity?: string
  activeSegment?: string
  dataPlan?: string
  dataValidity?: string
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch {
      /* keep status-code message */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function getDhanStatus(): Promise<DhanStatus> {
  return jsonOrThrow(await fetch(`${API_BASE}/api/settings/dhan`))
}

export async function saveDhanCreds(clientId: string, accessToken: string): Promise<DhanStatus> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/api/settings/dhan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, accessToken }),
    }),
  )
}

export async function clearDhanCreds(): Promise<DhanStatus> {
  return jsonOrThrow(await fetch('/api/settings/dhan', { method: 'DELETE' }))
}

export async function testDhanConnection(): Promise<{ ok: boolean; profile: DhanProfile }> {
  return jsonOrThrow(await fetch(`${API_BASE}/api/settings/dhan/test`, { method: 'POST' }))
}

export async function fetchBacktestOOS(req: LiveRequest, signal?: AbortSignal): Promise<OOSResult> {
  const res = await fetch('/api/backtest/oos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch { /* keep status-code message */ }
    throw new Error(detail)
  }
  return res.json()
}

// ---- Parameter sweep -------------------------------------------------------
export type SweepCell = {
  key: string
  fast: number
  slow: number
  metrics: Metrics
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

export async function fetchBacktestSweep(req: LiveRequest, signal?: AbortSignal): Promise<SweepResult> {
  const res = await fetch('/api/backtest/sweep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch { /* keep status-code message */ }
    throw new Error(detail)
  }
  return res.json()
}

// ---- Walk-forward ----------------------------------------------------------
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

export type WalkForwardResult = {
  windows: WFWindow[]
  summary: WFSummary
  symbol: string
  ticker: string
  interval: string
  intraday: boolean
}

export async function fetchWalkForward(req: LiveRequest, window: number, step: number, signal?: AbortSignal): Promise<WalkForwardResult> {
  const res = await fetch(`/api/backtest/walkforward?window=${window}&step=${step}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch { /* keep status-code message */ }
    throw new Error(detail)
  }
  return res.json()
}

// ---- AI Review -------------------------------------------------------------
export type AIReviewResult = {
  reviews: Review[]
  source: 'heuristic' | 'openai' | 'anthropic'
  message: string
  metrics: Metrics
}

export async function fetchAIReview(req: LiveRequest, signal?: AbortSignal): Promise<AIReviewResult> {
  const res = await fetch('/api/ai/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch { /* keep status-code message */ }
    throw new Error(detail)
  }
  return res.json()
}

// ---- Real (Yahoo-delayed, ~15 min) quote for the Live tab. No broker needed. ----
export type Quote = {
  ticker: string
  price: number
  prevClose: number
  change: number
  changePct: number
}

export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  return jsonOrThrow(await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { signal }))
}

// ---- Real OHLC bars at a chosen timeframe for the Live chart. ----
// Daily bars carry a 'yyyy-mm-dd' string; intraday bars carry a unix timestamp (IST wall-clock).
export type Bar = { time: string | number; open: number; high: number; low: number; close: number }
export type BarsResponse = { ticker: string; interval: string; intraday: boolean; bars: Bar[] }
export type Interval = '1m' | '5m' | '15m' | '30m' | '60m' | '1d'

export async function fetchBars(symbol: string, interval: Interval, signal?: AbortSignal): Promise<BarsResponse> {
  return jsonOrThrow(
    await fetch(`/api/bars?symbol=${encodeURIComponent(symbol)}&interval=${interval}`, { signal }),
  )
}
