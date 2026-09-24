import { useState, useEffect } from 'react'
import { Bell, BellOff, Mail, Send, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '../lib/cn'

type Channel = 'telegram' | 'email' | 'browser'

interface ChannelConfig {
  enabled: boolean
  token?: string
  chatId?: string
  sender?: string
  password?: string
  recipient?: string
  phone?: string
}

interface NotificationState {
  enabled: boolean
  channels: Channel[]
  watchlist: string[]
}

const CHANNELS: { id: Channel; label: string; icon: typeof Bell; desc: string }[] = [
  { id: 'telegram', label: 'Telegram', icon: Send, desc: 'Bot messages to your chat' },
  { id: 'email', label: 'Email', icon: Mail, desc: 'Gmail alerts to your inbox' },
  { id: 'browser', label: 'Browser', icon: Bell, desc: 'Native browser notifications (no setup)' },
]

export function NotificationsPanel() {
  const [state, setState] = useState<NotificationState>({
    enabled: false,
    channels: [],
    watchlist: ['NIFTY 50', 'RELIANCE', 'TCS', 'HDFCBANK'],
  })
  const [channels, setChannels] = useState<Record<Channel, ChannelConfig>>({
    telegram: { enabled: false },
    email: { enabled: false },
    browser: { enabled: false },
  })
  const [testing, setTesting] = useState<Channel | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/notifications/status')
      .then(r => r.json())
      .then(data => setState(data))
      .catch(() => {})
  }, [])

  const toggleEnabled = async () => {
    const newEnabled = !state.enabled
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, enabled: newEnabled, channels }),
      })
      if (res.ok) setState(await res.json())
    } catch (e) {
      setError(String(e))
    }
  }

  const updateChannel = (id: Channel, updates: Partial<ChannelConfig>) => {
    setChannels(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates, enabled: updates.enabled ?? prev[id].enabled },
    }))
  }

  const saveConfig = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, enabled: true, channels }),
      })
      if (res.ok) setState(await res.json())
      else setError('Failed to save')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const testChannel = async (id: Channel) => {
    setTesting(id)
    setTestResult(null)
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_channel: id }),
      })
      const data = await res.json()
      setTestResult({ ok: data?.[id]?.ok ?? false, msg: data?.[id]?.error || 'Sent' })
    } catch {
      setTestResult({ ok: false, msg: 'Failed' })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className={cn('h-5 w-5', state.enabled ? 'text-jade' : 'text-muted-l dark:text-muted-d')} />
          <h2 className="font-display text-lg text-ink-text dark:text-paper">Notifications</h2>
        </div>
        <button
          onClick={toggleEnabled}
          className={cn(
            'flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
            state.enabled
              ? 'bg-jade/12 text-jade-deep hover:bg-jade/20 dark:text-jade-soft'
              : 'bg-paper-3 text-muted-l hover:text-ink-text dark:bg-ink-3 dark:text-muted-d dark:hover:text-paper',
          )}
        >
          {state.enabled ? <CheckCircle2 className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {state.enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-clay/30 bg-clay/5 p-3 text-xs text-clay">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Watchlist */}
      <div className="rounded-sm border border-paper-3 bg-paper-2 p-4 dark:border-ink-3 dark:bg-ink-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">Watchlist</h3>
        <p className="mt-1 text-xs text-muted-l dark:text-muted-d">Symbols to monitor for signals.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.watchlist.map(sym => (
            <span key={sym} className="inline-flex items-center gap-1 rounded-sm bg-jade/10 px-2 py-1 text-xs text-jade-deep dark:text-jade-soft">
              {sym}
              <button className="hover:text-clay" onClick={() => {
                const next = state.watchlist.filter(s => s !== sym)
                setState({ ...state, watchlist: next })
              }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            className="inline-flex items-center gap-1 rounded-sm border border-dashed border-paper-3 px-2 py-1 text-xs text-muted-l hover:border-jade/40 hover:text-jade dark:border-ink-3 dark:hover:text-jade-soft"
            onClick={() => {
              const sym = prompt('Add symbol:')
              if (sym && !state.watchlist.includes(sym.toUpperCase())) {
                setState({ ...state, watchlist: [...state.watchlist, sym.toUpperCase()] })
              }
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">Channels</h3>
        {CHANNELS.map(({ id, label, icon: Icon, desc }) => (
          <ChannelCard
            key={id}
            id={id}
            label={label}
            icon={Icon}
            desc={desc}
            config={channels[id]}
            onChange={(updates) => updateChannel(id, updates)}
            onTest={() => testChannel(id)}
            testing={testing === id}
            testResult={testResult}
          />
        ))}
      </div>

      {/* Save */}
      <button
        onClick={saveConfig}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-sm bg-jade px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-jade-deep disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save & Enable'}
      </button>
    </div>
  )
}

function ChannelCard({
  id, label, icon: Icon, desc, config, onChange, onTest, testing, testResult,
}: {
  id: Channel
  label: string
  icon: typeof Bell
  desc: string
  config: ChannelConfig
  onChange: (updates: Partial<ChannelConfig>) => void
  onTest: () => void
  testing: boolean
  testResult: { ok: boolean; msg: string } | null
}) {
  return (
    <div className={cn(
      'rounded-sm border p-4 transition-colors',
      config.enabled
        ? 'border-jade/30 bg-jade/5 dark:border-jade/30'
        : 'border-paper-3 bg-paper-2 dark:border-ink-3 dark:bg-ink-2',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.enabled ? 'text-jade' : 'text-muted-l dark:text-muted-d')} />
          <div>
            <div className="text-sm font-medium text-ink-text dark:text-paper">{label}</div>
            <div className="text-xs text-muted-l dark:text-muted-d">{desc}</div>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="sr-only"
          />
          <div className={cn(
            'w-9 h-5 rounded-full transition-colors',
            config.enabled ? 'bg-jade' : 'bg-paper-3 dark:bg-ink-3',
          )}>
            <div className={cn(
              'w-3 h-3 rounded-full bg-paper transition-transform',
              config.enabled ? 'translate-x-5' : 'translate-x-1',
            )} />
          </div>
        </label>
      </div>

      {config.enabled && (
        <div className="mt-3 space-y-2">
          {id === 'telegram' && (
            <>
              <input
                type="text"
                placeholder="Bot token (from @BotFather)"
                value={config.token || ''}
                onChange={(e) => onChange({ token: e.target.value })}
                className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
              />
              <input
                type="text"
                placeholder="Chat ID (from @userinfobot)"
                value={config.chatId || ''}
                onChange={(e) => onChange({ chatId: e.target.value })}
                className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
              />
            </>
          )}
          {id === 'email' && (
            <>
              <input
                type="email"
                placeholder="Your Gmail address"
                value={config.sender || ''}
                onChange={(e) => onChange({ sender: e.target.value })}
                className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
              />
              <input
                type="password"
                placeholder="App password"
                value={config.password || ''}
                onChange={(e) => onChange({ password: e.target.value })}
                className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
              />
              <input
                type="email"
                placeholder="Recipient email"
                value={config.recipient || ''}
                onChange={(e) => onChange({ recipient: e.target.value })}
                className="w-full rounded-sm border border-paper-3 bg-paper px-3 py-1.5 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
              />
            </>
          )}
          {id === 'browser' && (
            <div className="flex items-center gap-2 text-xs text-muted-l">
              <CheckCircle2 className="h-4 w-4 text-sage" />
              <span>Browser notifications enabled automatically when allowed</span>
            </div>
          )}
          <button
            onClick={onTest}
            disabled={testing}
            className="text-xs text-jade hover:underline disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Send test message'}
          </button>
          {testResult && (
            <span className={cn('text-xs', testResult.ok ? 'text-sage' : 'text-clay')}>
              {testResult.ok ? '✓ Sent' : testResult.msg}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
