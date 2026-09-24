import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Plus, X, Wallet } from 'lucide-react'
import { cn } from '../lib/cn'
import { num, pct } from '../lib/format'

interface Position {
  symbol: string
  quantity: number
  avg_price: number
  current_price?: number
  unrealized_pnl: number
  entry_time: string
}

interface Portfolio {
  positions: Position[]
  open_count: number
  total_unrealized_pnl: number
  total_realized_pnl: number
  trade_count: number
}

interface Trade {
  symbol: string
  entry_price: number
  exit_price: number
  quantity: number
  pnl: number
  entry_time: string
  exit_time: string
}

export function PaperPortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [history, setHistory] = useState<Trade[]>([])
  const [placing, setPlacing] = useState(false)
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPortfolio()
    loadHistory()
    const id = setInterval(loadPortfolio, 15000)
    return () => clearInterval(id)
  }, [])

  async function loadPortfolio() {
    try {
      const res = await fetch('/api/paper/portfolio')
      if (res.ok) setPortfolio(await res.json())
    } catch {}
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/paper/history?limit=20')
      if (res.ok) setHistory(await res.json())
    } catch {}
  }

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol.trim()) return
    setPlacing(true)
    setError('')
    try {
      const res = await fetch('/api/paper/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), side, quantity: qty }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed')
      }
      setSymbol('')
      setQty(1)
      loadPortfolio()
      loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlacing(false)
    }
  }

  async function handleClose(sym: string) {
    try {
      await fetch(`/api/paper/close/${encodeURIComponent(sym)}`, { method: 'POST' })
      loadPortfolio()
      loadHistory()
    } catch {}
  }

  const totalPnl = (portfolio?.total_unrealized_pnl ?? 0) + (portfolio?.total_realized_pnl ?? 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-px bg-paper-3 dark:bg-ink-3 border border-paper-3 dark:border-ink-3">
        <StatTile label="Open Positions" value={portfolio?.open_count ?? 0} />
        <StatTile label="Total P&L" value={num(totalPnl, 0)} tone={totalPnl >= 0 ? 'up' : 'down'} />
        <StatTile label="Unrealized" value={num(portfolio?.total_unrealized_pnl ?? 0, 0)} tone={(portfolio?.total_unrealized_pnl ?? 0) >= 0 ? 'up' : 'down'} />
        <StatTile label="Realized" value={num(portfolio?.total_realized_pnl ?? 0, 0)} tone={(portfolio?.total_realized_pnl ?? 0) >= 0 ? 'up' : 'down'} />
      </div>

      {/* Order form */}
      <form onSubmit={handleOrder} className="rounded-sm border border-paper-3 bg-paper-2 p-4 dark:border-ink-3 dark:bg-ink-2">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-jade" />
          <h3 className="text-sm font-medium text-ink-text dark:text-paper">Place Order</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Symbol (e.g. RELIANCE)"
            className="num flex-1 min-w-24 rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
          />
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
            className="rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text dark:border-ink-3 dark:bg-ink dark:text-paper"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="num w-16 rounded-sm border border-paper-3 bg-paper px-2 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
          />
          <button
            type="submit"
            disabled={placing || !symbol.trim()}
            className={cn(
              'rounded-sm px-4 py-1.5 text-sm font-medium text-paper transition-colors',
              side === 'BUY' ? 'bg-sage hover:bg-sage/80' : 'bg-clay hover:bg-clay/80',
              'disabled:opacity-50',
            )}
          >
            {placing ? '...' : side}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      </form>

      {/* Positions */}
      {portfolio?.positions.length ? (
        <div className="rounded-sm border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
          <div className="flex items-center justify-between border-b border-paper-3 px-4 py-2.5 dark:border-ink-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-jade" />
              <h3 className="text-sm font-medium text-ink-text dark:text-paper">Open Positions</h3>
            </div>
            <span className="text-xs text-muted-l dark:text-muted-d">{portfolio.positions.length} active</span>
          </div>
          <div className="divide-y divide-paper-3 dark:divide-ink-3">
            {portfolio.positions.map(pos => (
              <div key={pos.symbol} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-text dark:text-paper">{pos.symbol}</span>
                    <span className="text-xs text-muted-l dark:text-muted-d">×{pos.quantity}</span>
                  </div>
                  <div className="text-xs text-muted-l dark:text-muted-d">
                    Avg: ₹{num(pos.avg_price, 0)} · Entry: {new Date(pos.entry_time).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-sm text-ink-text dark:text-paper">
                    {pos.current_price ? `₹${num(pos.current_price, 0)}` : '—'}
                  </div>
                  <div className={cn('num text-xs', pos.unrealized_pnl >= 0 ? 'text-sage' : 'text-clay')}>
                    {pos.unrealized_pnl >= 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                    {num(pos.unrealized_pnl, 0)}
                  </div>
                </div>
                <button
                  onClick={() => handleClose(pos.symbol)}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-l hover:bg-clay/10 hover:text-clay dark:text-muted-d"
                  title="Close position"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-paper-3 bg-paper-2 p-8 text-center text-sm text-muted-l dark:border-ink-3 dark:bg-ink-2 dark:text-muted-d">
          No open positions. Place an order to get started.
        </div>
      )}

      {/* Trade history */}
      {history.length > 0 && (
        <div className="rounded-sm border border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2">
          <div className="border-b border-paper-3 px-4 py-2.5 dark:border-ink-3">
            <h3 className="text-sm font-medium text-ink-text dark:text-paper">Recent Trades</h3>
          </div>
          <div className="divide-y divide-paper-3 dark:divide-ink-3">
            {history.slice(0, 10).map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-ink-text dark:text-paper">{t.symbol}</span>
                  <span className="mx-2 text-xs text-muted-l dark:text-muted-d">→</span>
                  <span className="text-xs text-muted-l dark:text-muted-d">
                    {new Date(t.entry_time).toLocaleDateString()} → {new Date(t.exit_time).toLocaleDateString()}
                  </span>
                </div>
                <div className="num text-right">
                  <div className="text-xs text-muted-l dark:text-muted-d">
                    ₹{num(t.entry_price, 0)} → ₹{num(t.exit_price, 0)}
                  </div>
                  <div className={cn('text-sm font-medium', t.pnl >= 0 ? 'text-sage' : 'text-clay')}>
                    {t.pnl >= 0 ? '+' : ''}{num(t.pnl, 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={cn(
      'p-3',
      tone === 'up' ? 'bg-sage/5 border border-sage/20' :
      tone === 'down' ? 'bg-clay/5 border border-clay/20' :
      'bg-paper-2 border border-paper-3 dark:bg-ink-2 dark:border-ink-3',
    )}>
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">{label}</div>
      <div className={cn(
        'num mt-1 text-xl font-semibold',
        tone === 'up' && 'text-sage',
        tone === 'down' && 'text-clay',
        tone === 'neutral' && 'text-ink-text dark:text-paper',
      )}>
        {value}
      </div>
    </div>
  )
}
