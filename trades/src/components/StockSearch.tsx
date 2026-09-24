import { useEffect, useRef, useState } from 'react'
import { Search, TrendingUp, Layers, Loader2, X } from 'lucide-react'
import { searchInstruments, type SearchResult } from '../lib/api'
import { INSTRUMENTS } from '../lib/demoData'
import { cn } from '../lib/cn'

// Offline fallback list from the ten seeded demo instruments, shaped like SearchResult.
const OFFLINE: SearchResult[] = INSTRUMENTS.map((i) => ({
  symbol: i.symbol,
  name: i.name,
  kind: i.kind,
}))

function offlineSearch(q: string): SearchResult[] {
  const s = q.trim().toLowerCase()
  if (!s) return OFFLINE
  return OFFLINE.filter((i) => i.symbol.toLowerCase().includes(s) || i.name.toLowerCase().includes(s))
}

type Props = {
  value: string
  onSelect: (symbol: string) => void
  className?: string
}

export function StockSearch({ value, onSelect, className }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>(OFFLINE)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search — hits the live universe, falls back to the offline list.
  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      searchInstruments(query, ctrl.signal)
        .then((r) => setResults(r.length ? r : offlineSearch(query)))
        .catch((e) => {
          if (e.name !== 'AbortError') setResults(offlineSearch(query))
        })
        .finally(() => setLoading(false))
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, open])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [results])

  const openPanel = () => {
    setOpen(true)
    setQuery('')
    setResults(OFFLINE)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const choose = (sym: string) => {
    onSelect(sym)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) choose(results[active].symbol)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      {/* Trigger — shows the current selection, opens the search panel */}
      <button
        type="button"
        onClick={openPanel}
        className="flex w-full items-center gap-2.5 rounded-xl border border-paper-3 bg-paper px-3 py-2.5 text-left text-sm text-ink-text outline-none transition-colors hover:border-jade/40 focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-l dark:text-muted-d" />
        <span className="num flex-1 truncate font-medium">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-l dark:text-muted-d">change</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-paper-3 bg-paper shadow-xl shadow-black/5 dark:border-ink-3 dark:bg-ink-2 dark:shadow-black/40">
          <div className="flex items-center gap-2 border-b border-paper-3 px-3 py-2.5 dark:border-ink-3">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-jade" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-l dark:text-muted-d" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search 200+ stocks & indices — try TCS, reliance, bank…"
              className="w-full bg-transparent text-sm text-ink-text outline-none placeholder:text-muted-l/70 dark:text-paper dark:placeholder:text-muted-d/60"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-l hover:text-clay dark:text-muted-d">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="scroll-quiet max-h-72 overflow-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-l dark:text-muted-d">
                No match. You can still type a raw NSE ticker to backtest it.
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.symbol}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.symbol)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                    i === active ? 'bg-jade/[0.09]' : 'hover:bg-paper-2/60 dark:hover:bg-ink/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      r.kind === 'index'
                        ? 'bg-brass/15 text-brass'
                        : 'bg-jade/12 text-jade',
                    )}
                  >
                    {r.kind === 'index' ? <Layers className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="num block truncate text-sm font-medium text-ink-text dark:text-paper">{r.symbol}</span>
                    <span className="block truncate text-xs text-muted-l dark:text-muted-d">{r.name}</span>
                  </span>
                  {r.symbol === value && <span className="text-[10px] font-medium uppercase tracking-wider text-jade">current</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
