import { useState } from 'react'
import { Wand2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/cn'
import type { StrategyDSL } from '../lib/backtest'

type Props = {
  onParsed: (dsl: StrategyDSL) => void
}

// ---- helpers ----
function allNums(s: string): number[] {
  return [...s.matchAll(/(\d+\.?\d*)/g)].map(([, n]) => parseFloat(n))
}

function numOr(m: RegExpMatchArray | null, fallback: number): number {
  if (!m) return fallback
  const n = parseFloat(m[1])
  return isNaN(n) ? fallback : n
}

// Strip the placeholder hint text that leaks into the DOM value
function cleanText(input: string): string {
  return input
    .replace(/^e\.g\.,?\s*/i, '')           // strip leading "e.g."
    .replace(/(?:EMA|SMA|ATR|RSI)\s*\(?\d+\)?/gi, '') // strip "(14)" etc
    .replace(/\s{2,}/g, ' ')                // normalize whitespace
    .trim()
}

// Canonicalize: lowercase, remove punctuation, collapse spaces
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function condKey(c: { left: any; op: string; right: any; bars?: number }): string {
  return `${c.left.kind}|${JSON.stringify(c.left)}|${c.op}|${JSON.stringify(c.right)}|${c.bars ?? ''}`
}

function dedupeConds<T extends { left: any; op: string; right: any; bars?: number }>(conds: T[]): T[] {
  const seen = new Set<string>()
  return conds.filter(c => {
    const k = condKey(c)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---- pattern matchers ----
// Return undefined if pattern doesn't match (not empty object).
type Matcher = (input: string) => Partial<StrategyDSL> | undefined

const matchers: Matcher[] = []

// 1. EMA cross above/below N
matchers.push((input) => {
  const m = input.match(/(\d+)\s*ema\s+cross(?:es)?\s+(?:above|below)\s+(\d+)\s*ema/i)
  if (!m) return undefined
  const n1 = Number(m[1]), n2 = Number(m[2])
  const above = /above/i.test(input)
  return {
    entry: [{ left: { kind: 'ema', n: n1 }, op: above ? 'cross_above' : 'cross_below', right: { kind: 'ema', n: n2 } }],
    exit:  [{ left: { kind: 'ema', n: n1 }, op: above ? 'cross_below' : 'cross_above', right: { kind: 'ema', n: n2 } }],
  }
})

// 2. SMA cross above/below N
matchers.push((input) => {
  const m = input.match(/(\d+)\s*sma\s+cross(?:es)?\s+(?:above|below)\s+(\d+)\s*sma/i)
  if (!m) return undefined
  const n1 = Number(m[1]), n2 = Number(m[2])
  const above = /above/i.test(input)
  return {
    entry: [{ left: { kind: 'sma', n: n1 }, op: above ? 'cross_above' : 'cross_below', right: { kind: 'sma', n: n2 } }],
    exit:  [{ left: { kind: 'sma', n: n1 }, op: above ? 'cross_below' : 'cross_above', right: { kind: 'sma', n: n2 } }],
  }
})

// 3. Moving average cross (generic, but NOT ema/sma which have dedicated matchers)
matchers.push((input) => {
  if (/ema\s+(?:cross|crossover|crosses)/i.test(input) || /sma\s+(?:cross|crossover|crosses)/i.test(input)) return undefined
  if (!/ma\s+(?:cross|crossover|crosses)/i.test(input)) return undefined
  const nums = allNums(input)
  const n1 = nums[0] || 20, n2 = nums[1] || 50
  return {
    entry: [{ left: { kind: 'sma', n: n1 }, op: 'cross_above', right: { kind: 'sma', n: n2 } }],
    exit:  [{ left: { kind: 'sma', n: n1 }, op: 'cross_below', right: { kind: 'sma', n: n2 } }],
  }
})

// 4. "day average" cross
matchers.push((input) => {
  const m = input.match(/(\d+)\s*day\s+(?:average|avg)\s+cross(?:es)?\s+(?:above|below)\s+(\d+)\s*day\s+(?:average|avg)/i)
  if (!m) return undefined
  const n1 = Number(m[1]), n2 = Number(m[2])
  const above = /above/i.test(input)
  return {
    entry: [{ left: { kind: 'sma', n: n1 }, op: above ? 'cross_above' : 'cross_below', right: { kind: 'sma', n: n2 } }],
    exit:  [{ left: { kind: 'sma', n: n1 }, op: above ? 'cross_below' : 'cross_above', right: { kind: 'sma', n: n2 } }],
  }
})

// 5. EMA/SMA simple comparison (A above B, no cross)
matchers.push((input) => {
  const m = input.match(/(\d+)\s*(?:ema|sma)\s+(?:is\s+)?above\s+(\d+)\s*(?:ema|sma)/i)
  if (!m) return undefined
  const n1 = Number(m[1]), n2 = Number(m[2])
  return {
    entry: [{ left: { kind: 'ema', n: n1 }, op: 'gt', right: { kind: 'ema', n: n2 } }],
    exit:  [{ left: { kind: 'ema', n: n1 }, op: 'lt', right: { kind: 'ema', n: n2 } }],
  }
})

// 6. RSI below/above N
matchers.push((input) => {
  const m = input.match(/rsi\s+(?:drops?\s+)?below\s+(\d+)/i)
  if (!m) return undefined
  const val = numOr(m, 30)
  return {
    entry: [{ left: { kind: 'rsi', n: 14 }, op: 'lt', right: { kind: 'const', value: val } }],
    exit:  [{ left: { kind: 'rsi', n: 14 }, op: 'gt', right: { kind: 'const', value: val + 40 } }],
  }
})

matchers.push((input) => {
  const m = input.match(/rsi\s+(?:is\s+)?above\s+(\d+)/i)
  if (!m) return undefined
  const val = numOr(m, 70)
  return {
    entry: [{ left: { kind: 'rsi', n: 14 }, op: 'gt', right: { kind: 'const', value: val } }],
    exit:  [{ left: { kind: 'rsi', n: 14 }, op: 'lt', right: { kind: 'const', value: val - 40 } }],
  }
})

// 7. MACD cross
matchers.push((input) => {
  if (!/macd\s+cross/i.test(input)) return undefined
  return {
    entry: [{ left: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' }, op: 'cross_above', right: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'signal' } }],
    exit:  [{ left: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' }, op: 'cross_below', right: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'signal' } }],
  }
})

// 8. MACD histogram
matchers.push((input) => {
  if (!/macd\s+histogram/i.test(input)) return undefined
  return {
    entry: [{ left: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'hist' }, op: 'gt', right: { kind: 'const', value: 0 } }],
    exit:  [{ left: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'hist' }, op: 'lt', right: { kind: 'const', value: 0 } }],
  }
})

// 9. Breakout above N-day high
matchers.push((input) => {
  const m = input.match(/breakout\s+(?:above|of)\s+(\d+)\s*(?:day|days)?\s*high/i)
  if (!m) return undefined
  const n = Number(m[1])
  return {
    entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'high', n } }],
    exit:  [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'low', n } }],
  }
})

// 10. Generic breakout
matchers.push((input) => {
  if (!/breakout/i.test(input)) return undefined
  const [n = 20] = allNums(input)
  return {
    entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'high', n } }],
    exit:  [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'low', n } }],
  }
})

// 11. Donchian
matchers.push((input) => {
  if (!/donchian/i.test(input)) return undefined
  const [n = 20] = allNums(input)
  return {
    entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'high', n } }],
    exit:  [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'low', n } }],
  }
})

// 12. Bollinger bands
matchers.push((input) => {
  if (!/boll(?:inger)?\s*band/i.test(input) && !/boll(?:inger)?\s*(?:upper|lower)/i.test(input)) return undefined
  const m = input.match(/(\d+)/)
  const n = m ? Number(m[1]) : 20
  if (/upper/i.test(input)) {
    return {
      entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'boll', n, k: 2, band: 'upper' } }],
      exit:  [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'boll', n, k: 2, band: 'lower' } }],
    }
  }
  if (/lower/i.test(input)) {
    return {
      entry: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'boll', n, k: 2, band: 'lower' } }],
      exit:  [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'boll', n, k: 2, band: 'upper' } }],
    }
  }
  return {
    entry: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'boll', n, k: 2, band: 'lower' } }],
    exit:  [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'boll', n, k: 2, band: 'upper' } }],
  }
})

// 13. Stochastic
matchers.push((input) => {
  const m = input.match(/stoch(?:astic)?\s+(?:below|under)\s+(\d+)/i)
  if (m) {
    const val = numOr(m, 20)
    return {
      entry: [{ left: { kind: 'stoch', n: 14 }, op: 'lt', right: { kind: 'const', value: val } }],
      exit:  [{ left: { kind: 'stoch', n: 14 }, op: 'gt', right: { kind: 'const', value: val + 30 } }],
    }
  }
  if (/stoch(?:astic)?\s+cross/i.test(input)) {
    return {
      entry: [{ left: { kind: 'stoch', n: 14 }, op: 'cross_above', right: { kind: 'const', value: 20 } }],
      exit:  [{ left: { kind: 'stoch', n: 14 }, op: 'cross_below', right: { kind: 'const', value: 80 } }],
    }
  }
  if (/stoch(?:astic)?/i.test(input)) {
    return {
      entry: [{ left: { kind: 'stoch', n: 14 }, op: 'lt', right: { kind: 'const', value: 20 } }],
      exit:  [{ left: { kind: 'stoch', n: 14 }, op: 'gt', right: { kind: 'const', value: 80 } }],
    }
  }
  return undefined
})

// 14. ADX
matchers.push((input) => {
  const m = input.match(/adx\s+(?:above|below|>\s*=?|<\s*=?)\s*(\d+)/i)
  if (m) {
    const val = numOr(m, 25)
    const above = /above|>/i.test(input)
    return above
      ? { entry: [{ left: { kind: 'adx', n: 14 }, op: 'gt', right: { kind: 'const', value: val } }] }
      : { exit: [{ left: { kind: 'adx', n: 14 }, op: 'lt', right: { kind: 'const', value: val } }] }
  }
  if (/adx/i.test(input)) return { entry: [{ left: { kind: 'adx', n: 14 }, op: 'gt', right: { kind: 'const', value: 25 } }] }
  return undefined
})

// 15. ROC
matchers.push((input) => {
  const m = input.match(/roc\s+(?:above|below|>\s*=?|<\s*=?)\s*(\d+)/i)
  if (m) {
    const val = numOr(m, 0)
    const above = /above|>/i.test(input)
    return above
      ? { entry: [{ left: { kind: 'roc', n: 14 }, op: 'gt', right: { kind: 'const', value: val } }] }
      : { entry: [{ left: { kind: 'roc', n: 14 }, op: 'lt', right: { kind: 'const', value: val } }] }
  }
  if (/roc\s+(?:rise|grow|up)/i.test(input)) return { entry: [{ left: { kind: 'roc', n: 14 }, op: 'gt', right: { kind: 'const', value: 0 } }] }
  if (/roc/i.test(input)) return { entry: [{ left: { kind: 'roc', n: 14 }, op: 'gt', right: { kind: 'const', value: 0 } }] }
  return undefined
})

// 16. Yesterday/previous high-low breakout
matchers.push((input) => {
  if (/yesterday.*high|prev\s*high/i.test(input)) {
    return {
      entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'prevhigh' } }],
      exit:  [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'prevlow' } }],
    }
  }
  if (/yesterday.*low|prev\s*low/i.test(input)) {
    return {
      entry: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'prevlow' } }],
      exit:  [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'prevhigh' } }],
    }
  }
  return undefined
})

// 17. Consecutive bars
matchers.push((input) => {
  const m = input.match(/rise(?:d|s)?\s+(?:for\s+)?(\d+)\s*(?:consecutive|bars?|days?)/i)
  if (m) return { entry: [{ left: { kind: 'price' }, op: 'rises_for', right: { kind: 'const', value: 0 }, bars: Number(m[1]) }] }
  const fm = input.match(/fall(?:ed|s)?\s+(?:for\s+)?(\d+)\s*(?:consecutive|bars?|days?)/i)
  if (fm) return { entry: [{ left: { kind: 'price' }, op: 'falls_for', right: { kind: 'const', value: 0 }, bars: Number(fm[1]) }] }
  return undefined
})

// 18. Stays above/below for N bars
matchers.push((input) => {
  const m = input.match(/stays?\s+above\s+(\d+)\s*(?:ema|ma)?\s+(?:for\s+)?(\d+)/i)
  if (m) {
    const [n1, bars] = [Number(m[1]), Number(m[2])]
    return { entry: [{ left: { kind: 'ema', n: n1 }, op: 'stays_above', right: { kind: 'const', value: 0 }, bars }] }
  }
  const m2 = input.match(/stays?\s+below\s+(\d+)\s*(?:ema|ma)?\s+(?:for\s+)?(\d+)/i)
  if (m2) {
    const [n1, bars] = [Number(m2[1]), Number(m2[2])]
    return { entry: [{ left: { kind: 'ema', n: n1 }, op: 'stays_below', right: { kind: 'const', value: 0 }, bars }] }
  }
  return undefined
})

// 19. ATR stop loss
matchers.push((input) => {
  const m = input.match(/stop\s+(?:loss|trailing)?\s*(?:at\s+)?(\d+\.?\d*)\s*ATR/i)
  if (m) return { risk: { stopLossPct: parseFloat(m[1]) * 1.5 } }
  return undefined
})

// 20. Percentage stop loss
matchers.push((input) => {
  const m = input.match(/stop\s+(?:loss)?\s*(\d+\.?\d*)\s*%/i)
  if (m) return { risk: { stopLossPct: parseFloat(m[1]) } }
  const sl = input.match(/\bsl\s*(\d+\.?\d*)\s*%/i)
  if (sl) return { risk: { stopLossPct: parseFloat(sl[1]) } }
  return undefined
})

// 21. Trailing stop
matchers.push((input) => {
  const m = input.match(/trail\s+(?:stop)?\s+(?:at\s+)?(\d+\.?\d*)\s*%/i)
  if (m) return { risk: { trailPct: parseFloat(m[1]) } }
  return undefined
})

// 22. Take profit
matchers.push((input) => {
  const m = input.match(/take\s+profit\|tp\|target\s*(?:at\s+)?(\d+\.?\d*)\s*ATR/i)
  if (m) return { risk: { takeProfitPct: parseFloat(m[1]) * 1.5 } }
  const p = input.match(/take\s+profit\|tp\|target\s*(?:at\s+)?(\d+\.?\d*)\s*%/i)
  if (p) return { risk: { takeProfitPct: parseFloat(p[1]) } }
  return undefined
})

// 23. Max hold bars
matchers.push((input) => {
  const m = input.match(/(?:exit|hold)\s+(?:after|max\s+)?(\d+)\s*(?:bars?|days?)/i)
  if (m) return { risk: { maxHoldBars: Number(m[1]) } }
  return undefined
})

// 24. Price above/below absolute level
matchers.push((input) => {
  const m = input.match(/price\s+(?:above|>\s*=?|greater\s+than)\s*(\d[\d,.]*)/i)
  if (m) {
    const val = parseFloat(m[1].replace(/,/g, ''))
    return { entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'const', value: val } }] }
  }
  const m2 = input.match(/price\s+(?:below|<\s*=?|less\s+than)\s*(\d[\d,.]*)/i)
  if (m2) {
    const val = parseFloat(m2[1].replace(/,/g, ''))
    return { entry: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'const', value: val } }] }
  }
  return undefined
})

// ---- main builder ----
function buildCombined(input: string): StrategyDSL | null {
  const clean = cleanText(input)
  const entrySet = new Set<string>()
  const exitSet = new Set<string>()
  const entryConditions: { left: any; op: string; right: any; bars?: number }[] = []
  const exitConditions: { left: any; op: string; right: any; bars?: number }[] = []
  let risk: StrategyDSL['risk']

  for (const fn of matchers) {
    const r = fn(clean)
    if (!r) continue
    if (r.entry) {
      for (const c of r.entry as { left: any; op: string; right: any; bars?: number }[]) {
        const k = condKey(c)
        if (!entrySet.has(k)) { entrySet.add(k); entryConditions.push(c) }
      }
    }
    if (r.exit) {
      for (const c of r.exit as { left: any; op: string; right: any; bars?: number }[]) {
        const k = condKey(c)
        if (!exitSet.has(k)) { exitSet.add(k); exitConditions.push(c) }
      }
    }
    if (r.risk) risk = { ...risk, ...r.risk }
  }

  if (entryConditions.length === 0) return null

  return { entry: entryConditions, exit: exitConditions, risk } as StrategyDSL
}

export function NLStrategy({ onParsed }: Props) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<StrategyDSL | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = () => {
    if (!input.trim()) return
    const result = buildCombined(input)
    if (!result || result.entry.length === 0) {
      setParsed(null)
      setError('No strategy rules identified. Try patterns like: "20 EMA crosses above 50 EMA", "RSI below 30", "MACD cross", "breakout 20-day high", "bollinger lower band", "stochastic below 20", "ADX above 25", "stop loss 2%", "take profit 4%"')
      return
    }
    setParsed(result)
    setError(null)
    onParsed(result)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">
        <Wand2 className="h-3.5 w-3.5 text-jade" />
        Describe your strategy
      </div>
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && handleParse()}
          placeholder='e.g., "Buy when 20 EMA crosses above 50 EMA and RSI is below 40. Stop loss 2%. Take profit 4%. Exit when 20 EMA crosses below 50 EMA."'
          rows={4}
          className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-2 text-xs text-ink-text outline-none placeholder:text-muted-l/50 focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper resize-none"
        />
        <button
          onClick={handleParse}
          className="absolute right-2 top-2 rounded-sm bg-jade px-2.5 py-1 text-xs font-medium text-paper hover:bg-jade-deep transition-colors"
        >
          Parse
        </button>
      </div>
      <p className="text-[10px] text-muted-l dark:text-muted-d">
        Press <kbd className="font-mono bg-paper-3 px-1 rounded-sm dark:bg-ink-3">⌘Enter</kbd> to parse
      </p>
      {parsed && !error && (
        <div className="flex items-start gap-2 rounded-sm bg-sage/10 px-3 py-1.5 text-[11px] text-sage">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            Parsed{' '}
            <span className="font-semibold">{parsed.entry.length}</span> entry condition(s),{' '}
            <span className="font-semibold">{parsed.exit.length}</span> exit condition(s)
            {parsed.risk?.stopLossPct && ` · SL ${parsed.risk.stopLossPct}%`}
            {parsed.risk?.takeProfitPct && ` · TP ${parsed.risk.takeProfitPct}%`}
            {parsed.risk?.trailPct && ` · Trail ${parsed.risk.trailPct}%`}
            {parsed.risk?.maxHoldBars && ` · Max ${parsed.risk.maxHoldBars} bars`}
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-sm bg-clay/10 px-3 py-1.5 text-[11px] text-clay">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
