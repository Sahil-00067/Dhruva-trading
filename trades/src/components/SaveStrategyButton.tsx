import { useState } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '../lib/cn'
import { saveStrategy, type SavedStrategy } from '../lib/storage'
import type { Metrics, Trade } from '../lib/backtest'

export function SaveStrategyButton({ cfg, symbol, interval, metrics, trades, equity }: {
  cfg: { template: import('../lib/backtest').Template; fast: number; slow: number; costBps: number; mode: 'template' | 'rules'; rules?: import('../lib/backtest').StrategyDSL }
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
        'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
        done
          ? 'bg-sage/15 text-sage border border-sage/30'
          : 'border border-paper-3 bg-paper text-ink-text hover:border-jade/40 hover:text-jade dark:border-ink-3 dark:bg-ink dark:text-paper dark:hover:text-jade-soft',
        saving && 'opacity-50 cursor-not-allowed',
      )}
    >
      {done
        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</>
        : <><Sparkles className="h-3.5 w-3.5" /> Save</>
      }
    </button>
  )
}
