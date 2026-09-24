import { useEffect, useRef, useState } from 'react'
import { getQuote, nextTick } from './demoData'
import { fetchQuote } from './api'

export type LiveTick = {
  price: number
  change: number
  changePct: number
  prevClose: number
  live: boolean // true = real (delayed) NSE data; false = simulated fallback
}

// Real NSE prices via the backend /api/quote (Yahoo-delayed ~15 min) — no broker needed.
// Polls periodically; if the backend is unreachable it degrades to the simulated ticker
// so the page always feels alive offline. Between polls we apply tiny cosmetic nudges.
export function useLiveTick(symbol: string, ms = 15000): LiveTick {
  const base = getQuote(symbol)
  const [tick, setTick] = useState<LiveTick>({
    price: base.price,
    change: base.change,
    changePct: base.changePct,
    prevClose: base.prevClose,
    live: false,
  })
  const prevCloseRef = useRef(base.prevClose)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    // Reset to this symbol's simulated baseline immediately on symbol change.
    const b = getQuote(symbol)
    prevCloseRef.current = b.prevClose
    setTick({ price: b.price, change: b.change, changePct: b.changePct, prevClose: b.prevClose, live: false })

    const poll = async () => {
      try {
        const q = await fetchQuote(symbol, controller.signal)
        if (cancelled) return
        prevCloseRef.current = q.prevClose
        setTick({ price: q.price, change: q.change, changePct: q.changePct, prevClose: q.prevClose, live: true })
      } catch {
        // Backend down / offline — keep the simulated feed nudging along.
        if (cancelled) return
        setTick((t) => {
          if (t.live) return t // had real data; don't overwrite with sim
          const price = nextTick(t.price)
          const prev = prevCloseRef.current
          return { price, prevClose: prev, change: price - prev, changePct: ((price - prev) / prev) * 100, live: false }
        })
      }
    }

    poll()
    const id = setInterval(poll, ms)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(id)
    }
  }, [symbol, ms])

  return tick
}
