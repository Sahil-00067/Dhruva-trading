import { useState } from 'react'
import { Shield, ChevronDown, Lightbulb } from 'lucide-react'
import { cn } from '../lib/cn'
import type { StrategyDSL, RiskExits } from '../lib/backtest'

// Preset strategies — each one compiles to a valid StrategyDSL internally.
// Users see friendly names, descriptions, and 1–2 adjustable parameters.
const PRESETS: {
  id: string
  name: string
  blurb: string
  category: 'trend' | 'mean' | 'momentum' | 'breakout'
  icon: string
  defaultParams: Record<string, number>
  paramLabels: Record<string, string>
  example: string
  build: (params: Record<string, number>) => StrategyDSL
}[] = [
  {
    id: 'ma_cross',
    name: 'MA Crossover',
    blurb: 'Buy when fast MA crosses above slow MA',
    category: 'trend',
    icon: '📈',
    defaultParams: { fast: 20, slow: 50 },
    paramLabels: { fast: 'Fast MA', slow: 'Slow MA' },
    example: 'Buy NIFTY when 20-day MA rises above 50-day MA, sell when it falls below.',
    build: (p) => ({
      entry: [{ left: { kind: 'sma', n: p.fast }, op: 'cross_above', right: { kind: 'sma', n: p.slow } }],
      exit: [{ left: { kind: 'sma', n: p.fast }, op: 'cross_below', right: { kind: 'sma', n: p.slow } }],
    }),
  },
  {
    id: 'rsi',
    name: 'RSI Mean Reversion',
    blurb: 'Buy oversold, sell overbought',
    category: 'mean',
    icon: '🔄',
    defaultParams: { oversold: 30, overbought: 70, rsiLength: 14 },
    paramLabels: { oversold: 'Oversold', overbought: 'Overbought' },
    example: 'Buy when RSI drops below 30, sell when it climbs above 70.',
    build: (p) => ({
      entry: [{ left: { kind: 'rsi', n: p.rsiLength }, op: 'lt', right: { kind: 'const', value: p.oversold } }],
      exit: [{ left: { kind: 'rsi', n: p.rsiLength }, op: 'gt', right: { kind: 'const', value: p.overbought } }],
    }),
  },
  {
    id: 'macd',
    name: 'MACD Signal',
    blurb: 'MACD line crosses signal line',
    category: 'momentum',
    icon: '📊',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramLabels: { fast: 'Fast', slow: 'Slow' },
    example: 'Buy when MACD crosses above signal line, sell when it crosses below.',
    build: (p) => ({
      entry: [{ left: { kind: 'macd', fast: p.fast, slow: p.slow, signal: p.signal, line: 'macd' }, op: 'cross_above', right: { kind: 'macd', fast: p.fast, slow: p.slow, signal: p.signal, line: 'signal' } }],
      exit: [{ left: { kind: 'macd', fast: p.fast, slow: p.slow, signal: p.signal, line: 'macd' }, op: 'cross_below', right: { kind: 'macd', fast: p.fast, slow: p.slow, signal: p.signal, line: 'signal' } }],
    }),
  },
  {
    id: 'breakout',
    name: 'Donchian Breakout',
    blurb: 'Buy new highs, sell new lows',
    category: 'breakout',
    icon: '🚀',
    defaultParams: { channel: 20 },
    paramLabels: { channel: 'Channel' },
    example: 'Buy when price breaks above 20-day high, sell when it breaks below 20-day low.',
    build: (p) => ({
      entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'high', n: p.channel } }],
      exit: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'low', n: p.channel } }],
    }),
  },
  {
    id: 'adx_trend',
    name: 'ADX Trend Filter',
    blurb: 'Only trade when trend is strong',
    category: 'trend',
    icon: '💪',
    defaultParams: { adxLength: 14, adxThreshold: 25, maLength: 20 },
    paramLabels: { adxLength: 'ADX Length', adxThreshold: 'Trend Strength' },
    example: 'Buy when price is above MA and ADX shows strong trend, sell when ADX drops.',
    build: (p) => ({
      entry: [
        { left: { kind: 'price' }, op: 'gt', right: { kind: 'sma', n: p.maLength } },
        { left: { kind: 'adx', n: p.adxLength }, op: 'gt', right: { kind: 'const', value: p.adxThreshold } },
      ],
      exit: [{ left: { kind: 'adx', n: p.adxLength }, op: 'lt', right: { kind: 'const', value: p.adxThreshold * 0.6 } }],
    }),
  },
  {
    id: 'vol_breakout',
    name: 'Volatility Breakout',
    blurb: 'Breakout with volume confirmation',
    category: 'breakout',
    icon: '⚡',
    defaultParams: { lookback: 20 },
    paramLabels: { lookback: 'Lookback' },
    example: 'Buy when price breaks above N-day high with expanding volatility.',
    build: (p) => ({
      entry: [{ left: { kind: 'price' }, op: 'gt', right: { kind: 'high', n: p.lookback } }],
      exit: [{ left: { kind: 'price' }, op: 'lt', right: { kind: 'low', n: p.lookback } }],
    }),
  },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  trend: { bg: 'bg-sage/10', text: 'text-sage', border: 'border-sage/30' },
  mean: { bg: 'bg-brass/10', text: 'text-brass', border: 'border-brass/30' },
  momentum: { bg: 'bg-jade/10', text: 'text-jade', border: 'border-jade/30' },
  breakout: { bg: 'bg-clay/10', text: 'text-clay', border: 'border-clay/30' },
}

type Props = {
  rules: StrategyDSL
  onChange: (r: StrategyDSL) => void
}

export function RuleBuilder({ rules, onChange }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    rules.entry.length > 0 && rules.exit.length > 0 ? findMatchingPreset(rules) : null
  )
  const [params, setParams] = useState<Record<string, number>>({})
  const [showCustom, setShowCustom] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState(false)

  // Find which preset matches current rules (if any)
  function findMatchingPreset(r: StrategyDSL): string | null {
    for (const preset of PRESETS) {
      const built = preset.build(preset.defaultParams)
      if (JSON.stringify(built.entry) === JSON.stringify(r.entry) &&
          JSON.stringify(built.exit) === JSON.stringify(r.exit)) {
        return preset.id
      }
    }
    return null
  }

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setSelectedPreset(presetId)
    setParams({ ...preset.defaultParams })
    onChange(preset.build(preset.defaultParams))
  }

  const updateParam = (key: string, value: number) => {
    const newParams = { ...params, [key]: value }
    setParams(newParams)
    const preset = PRESETS.find((p) => p.id === selectedPreset)
    if (preset) {
      onChange(preset.build(newParams))
    }
  }

  const currentPreset = PRESETS.find((p) => p.id === selectedPreset)
  const categoryStyle = currentPreset ? CATEGORY_COLORS[currentPreset.category] : null

  return (
    <div className="space-y-4">
      {/* Preset selector */}
      {!showCustom ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">
            <Lightbulb className="h-3.5 w-3.5" />
            Choose a strategy preset
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => {
              const style = CATEGORY_COLORS[preset.category]
              const isSelected = selectedPreset === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    'relative rounded-xl border p-3 text-left transition-all',
                    isSelected
                      ? cn('border-jade/50 bg-jade/[0.08] shadow-glow-jade')
                      : cn('border-paper-3 hover:border-jade/30 dark:border-ink-3', style.bg, 'hover:opacity-90'),
                  )}
                >
                  {isSelected && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-jade text-paper">
                      <span className="text-xs">✓</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{preset.icon}</span>
                    <div className="min-w-0">
                      <div className={cn('truncate text-sm font-medium', isSelected ? 'text-jade-deep dark:text-jade' : 'text-ink-text dark:text-paper')}>
                        {preset.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-l dark:text-muted-d">{preset.blurb}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Custom mode toggle */}
          <button
            onClick={() => setShowCustom(true)}
            className="w-full rounded-lg border border-dashed border-paper-3 py-2 text-xs font-medium text-muted-l transition-colors hover:border-jade/40 hover:text-jade dark:border-ink-3 dark:text-muted-d"
          >
            Or build custom rules →
          </button>
        </div>
      ) : (
        /* Selected preset with params */
        <div className="space-y-4">
          {currentPreset && (
            <>
              {/* Preset header */}
              <div className={cn('rounded-xl border p-4', categoryStyle?.border, categoryStyle?.bg)}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{currentPreset.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium', categoryStyle?.text)}>{currentPreset.name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', categoryStyle?.bg, categoryStyle?.text)}>
                        {currentPreset.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-l dark:text-muted-d">{currentPreset.example}</p>
                  </div>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="text-xs text-muted-l hover:text-ink-text dark:text-muted-d dark:hover:text-paper"
                  >
                    ← Back
                  </button>
                </div>

                {/* Param knobs */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Object.entries(currentPreset.paramLabels).map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">
                        <span>{label}</span>
                        <span className="num text-jade">{params[key] ?? currentPreset.defaultParams[key]}</span>
                      </label>
                      <input
                        type="range"
                        min={key === 'channel' || key === 'lookback' ? 5 : 2}
                        max={key === 'channel' || key === 'lookback' ? 50 : 100}
                        step={1}
                        value={params[key] ?? currentPreset.defaultParams[key]}
                        onChange={(e) => updateParam(key, Number(e.target.value))}
                        className="w-full accent-jade"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Entry/Exit preview */}
              <div className="rounded-xl border border-paper-3 bg-paper/50 p-3 dark:border-ink-3 dark:bg-ink/30">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d mb-2">
                  Strategy Logic
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-sage" />
                    <span className="text-ink-text dark:text-paper">
                      <strong>Enter:</strong> {currentPreset.example.split(',')[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-clay" />
                    <span className="text-ink-text dark:text-paper">
                      <strong>Exit:</strong> {currentPreset.example.split(',').slice(1).join(',')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Risk management */}
          <div className="rounded-xl border border-paper-3 dark:border-ink-3">
            <button
              onClick={() => setExpandedRisk(!expandedRisk)}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-brass" />
                <span className="text-sm font-medium text-ink-text dark:text-paper">Risk Management</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">Optional</span>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-muted-l transition-transform dark:text-muted-d', expandedRisk && 'rotate-180')} />
            </button>

            {expandedRisk && (
              <div className="border-t border-paper-3 p-3 dark:border-ink-3">
                <RiskManager rules={rules} onChange={onChange} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RiskManager({ rules, onChange }: { rules: StrategyDSL; onChange: (r: StrategyDSL) => void }) {
  const setRisk = (patch: Partial<RiskExits>) => {
    const next: RiskExits = { ...rules.risk, ...patch }
    for (const k of Object.keys(next) as (keyof RiskExits)[]) if (next[k] == null) delete next[k]
    onChange({ ...rules, risk: Object.keys(next).length ? next : undefined })
  }

  return (
    <div className="space-y-3">
      <RiskKnob
        label="Stop-Loss"
        value={rules.risk?.stopLossPct}
        onChange={(v) => setRisk({ stopLossPct: v })}
        unit="%"
        min={0.5}
        max={20}
        step={0.5}
      />
      <RiskKnob
        label="Take-Profit"
        value={rules.risk?.takeProfitPct}
        onChange={(v) => setRisk({ takeProfitPct: v })}
        unit="%"
        min={1}
        max={50}
        step={1}
      />
      <RiskKnob
        label="Trailing Stop"
        value={rules.risk?.trailPct}
        onChange={(v) => setRisk({ trailPct: v })}
        unit="%"
        min={1}
        max={20}
        step={0.5}
      />
    </div>
  )
}

function RiskKnob({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
}: {
  label: string
  value?: number
  onChange: (v: number | undefined) => void
  unit: string
  min: number
  max: number
  step: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-l dark:text-muted-d">{label}</span>
        <span className="num text-xs text-ink-text dark:text-paper">
          {value != null ? `${value}${unit}` : 'Off'}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(v >= min ? v : undefined)
        }}
        className="w-full accent-brass"
      />
    </div>
  )
}
