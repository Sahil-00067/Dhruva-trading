import { useEffect, useMemo, useState } from 'react'
import { Bell, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { useLiveTick } from '../lib/useLiveTick'
import { computeSignal, type Regime } from '../lib/signal'
import { getCandles } from '../lib/demoData'
import { num, pct } from '../lib/format'

const POLL_MS = 60_000

type SignalState = 'idle' | 'checking' | 'triggered' | 'quiet'

// Browser notification helper — asks permission once, then sends native alerts
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

export function LiveSignals() {
  const [state, setState] = useState<SignalState>('idle')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [message, setMessage] = useState<string>('')
  const [tone, setTone] = useState<'good' | 'warn' | 'bad' | 'info'>('info')
  const [notifEnabled, setNotifEnabled] = useState(false)

  const symbol = 'NIFTY 50'
  const tick = useLiveTick(symbol)
  const candles = useMemo(() => getCandles(symbol, 180), [])
  const signal = useMemo(() => computeSignal(candles), [candles])

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission().then(granted => setNotifEnabled(granted))
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setNotifEnabled(true)
    }
  }, [])

  useEffect(() => {
    const poll = async () => {
      setState('checking')
      await new Promise(r => setTimeout(r, 800))

      const now = new Date()
      setLastCheck(now)

      const isTrending = signal.trend === 'positive'
      const hasPosition = signal.position === 'Long'

      if (isTrending && !hasPosition) {
        setState('triggered')
        setTone('good')
        setMessage(`${symbol} — Trend turning positive, signal suggests entry`)
        // Send browser notification
        if (notifEnabled) {
          sendBrowserNotification('📈 Dhruva Alert', `${symbol} trend turning positive — entry signal detected`)
        }
      } else if (!isTrending && hasPosition) {
        setState('triggered')
        setTone('warn')
        setMessage(`${symbol} — Trend negative, consider exiting position`)
        // Send browser notification
        if (notifEnabled) {
          sendBrowserNotification('📉 Dhruva Alert', `${symbol} trend turned negative — exit signal detected`)
        }
      } else {
        setState('quiet')
        setTone('info')
        setMessage(`No new signals · Regime: ${signal.regime}`)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => clearInterval(interval)
  }, [symbol, signal, notifEnabled])

  return (
    <div className={cn(
      'border p-3',
      state === 'triggered' && tone === 'good' ? 'border-sage/40 bg-sage/5' :
      state === 'triggered' && tone === 'warn' ? 'border-brass/40 bg-brass/5' :
      state === 'checking' ? 'border-jade/30 bg-jade/5' :
      'border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2',
    )}>
      <div className="flex items-center gap-2">
        <Bell className={cn('h-3.5 w-3.5', state === 'triggered' ? 'text-jade animate-pulse' : 'text-muted-l dark:text-muted-d')} />
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-l dark:text-muted-d">Live Signals</span>
        {state === 'checking' && <Loader2 className="h-3 w-3 animate-spin text-jade ml-auto" />}
        {lastCheck && (
          <span className="ml-auto text-[10px] text-muted-l dark:text-muted-d">
            {lastCheck.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {notifEnabled && (
          <span className="ml-2 text-[10px] text-sage flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Notifs On
          </span>
        )}
      </div>

      <div className="mt-2 flex items-start gap-2">
        {state === 'triggered' && (
          tone === 'good' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-sage mt-0.5" /> :
          <AlertCircle className="h-4 w-4 shrink-0 text-brass mt-0.5" />
        )}
        {state === 'quiet' && <Bell className="h-4 w-4 shrink-0 text-muted-l dark:text-muted-d mt-0.5" />}
        <p className={cn(
          'text-xs leading-relaxed',
          state === 'triggered' && tone === 'good' ? 'text-sage' :
          state === 'triggered' && tone === 'warn' ? 'text-brass' :
          'text-muted-l dark:text-muted-d',
        )}>
          {message}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-current/10">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-l dark:text-muted-d">Price</div>
          <div className="num text-sm text-ink-text dark:text-paper">{num(tick.price)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-l dark:text-muted-d">Change</div>
          <div className={cn('num text-sm', tick.change >= 0 ? 'text-sage' : 'text-clay')}>
            {pct(tick.changePct)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-l dark:text-muted-d">Regime</div>
          <div className="num text-sm text-ink-text dark:text-paper">{signal.regime}</div>
        </div>
      </div>

      {/* Enable notifications button */}
      {!notifEnabled && 'Notification' in window && (
        <button
          onClick={() => requestNotificationPermission().then(granted => setNotifEnabled(granted))}
          className="mt-3 w-full rounded-sm border border-jade/30 bg-jade/5 px-3 py-2 text-xs font-medium text-jade hover:bg-jade/10 transition-colors"
        >
          Enable Browser Notifications
        </button>
      )}
    </div>
  )
}
