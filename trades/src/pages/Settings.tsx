import { useEffect, useState } from 'react'
import { Sun, Moon, TrendingUp, Wallet, Database, ShieldCheck, Link2, KeyRound, CheckCircle2, AlertTriangle, Loader2, Bell, Bot } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { useMode } from '../state/ModeProvider'
import { cn } from '../lib/cn'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { PaperPortfolio } from '../components/PaperPortfolio'
import {
  getDhanStatus,
  saveDhanCreds,
  clearDhanCreds,
  testDhanConnection,
  type DhanStatus,
  type DhanProfile,
} from '../lib/api'

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { mode, setMode } = useMode()
  const [activeSection, setActiveSection] = useState<'appearance' | 'default' | 'data' | 'dhan' | 'notifications' | 'paper'>('appearance')

  return (
    <div className="animate-fade-up max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-text dark:text-paper">Settings</h1>
        <p className="mt-1 text-sm text-muted-l dark:text-muted-d">Appearance, defaults, and what's under the hood.</p>
      </div>

      <section className="card p-5">
        <h2 className="font-display text-lg text-ink-text dark:text-paper">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-l dark:text-muted-d">Choose a theme. It's remembered on this device.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Segment active={theme === 'light'} onClick={() => setTheme('light')} icon={Sun} label="Light" />
          <Segment active={theme === 'dark'} onClick={() => setTheme('dark')} icon={Moon} label="Dark" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg text-ink-text dark:text-paper">Default view</h2>
        <p className="mt-0.5 text-sm text-muted-l dark:text-muted-d">Which best-strategy view opens first.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Segment active={mode === 'trading'} onClick={() => setMode('trading')} icon={TrendingUp} label="Trading" />
          <Segment active={mode === 'investing'} onClick={() => setMode('investing')} icon={Wallet} label="Investing" />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-jade" />
          <h2 className="font-display text-lg text-ink-text dark:text-paper">Data source</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-l dark:text-muted-d">
          Backtests run on real NSE end-of-day data (yfinance <span className="num">.NS</span>). Connect Dhan below for a
          live intraday feed.
        </p>
      </section>

      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'paper', label: 'Paper Trading', icon: Wallet },
          { id: 'dhan', label: 'Broker', icon: Link2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as any)}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors',
              activeSection === id
                ? 'bg-jade/12 text-jade-deep border border-jade/30 dark:text-jade-soft'
                : 'bg-paper-3 text-muted-l hover:text-ink-text border border-paper-3 dark:bg-ink-3 dark:text-muted-d dark:hover:text-paper',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'notifications' && (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-jade" />
            <h2 className="font-display text-lg text-ink-text dark:text-paper">Notifications</h2>
          </div>
          <p className="mt-1 text-sm text-muted-l dark:text-muted-d">
            Get alerts when signals trigger. Supports Telegram, Email, and WhatsApp.
          </p>
          <div className="mt-4">
            <NotificationsPanel />
          </div>
        </section>
      )}

      {activeSection === 'paper' && (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-jade" />
            <h2 className="font-display text-lg text-ink-text dark:text-paper">Paper Trading</h2>
          </div>
          <p className="mt-1 text-sm text-muted-l dark:text-muted-d">
            Simulate trades with real-time prices. Connect your Dhan account for live execution.
          </p>
          <div className="mt-4">
            <PaperPortfolio />
          </div>
        </section>
      )}

      {activeSection === 'dhan' && <DhanSection />}

      <section className="card border-brass/25 bg-brass/[0.05] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brass" />
          <h2 className="font-display text-lg text-ink-text dark:text-paper">The honest part</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-l dark:text-muted-d">
          Dhruva is an educational, paper-trading tool. No strategy guarantees profit, past performance doesn't predict
          the future, and nothing here is investment advice. We'd rather show you a rigorous, cost-aware backtest than a
          seductive one.
        </p>
        <p className="mt-3 text-xs text-muted-l dark:text-muted-d">Dhruva · Phase 1 preview</p>
      </section>
    </div>
  )
}

function DhanSection() {
  const [status, setStatus] = useState<DhanStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<DhanProfile | null>(null)

  useEffect(() => {
    getDhanStatus().then(setStatus).catch(() => setStatus({ configured: false }))
  }, [])

  const save = async () => {
    setBusy('save')
    setError('')
    setProfile(null)
    try {
      const s = await saveDhanCreds(clientId.trim(), token.trim())
      setStatus(s)
      setToken('') // never keep the raw token in component state after it's stored
      setClientId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save credentials.')
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy('test')
    setError('')
    setProfile(null)
    try {
      const { profile } = await testDhanConnection()
      setProfile(profile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection test failed.')
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async () => {
    setBusy('clear')
    setError('')
    setProfile(null)
    try {
      const s = await clearDhanCreds()
      setStatus(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect.')
    } finally {
      setBusy(null)
    }
  }

  const dataActive = profile?.dataPlan && profile.dataPlan.toLowerCase() === 'active'

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-jade" />
        <h2 className="font-display text-lg text-ink-text dark:text-paper">Connect Dhan (live data)</h2>
      </div>
      <p className="mt-0.5 text-sm text-muted-l dark:text-muted-d">
        Link your Dhan account for a real-time feed. Get a token at{' '}
        <span className="text-ink-text dark:text-paper">Dhan Web → My Profile → Access DhanHQ APIs</span>.
      </p>

      {/* Risk notice — this token is powerful. */}
      <div className="mt-3 flex gap-2 rounded-xl border border-brass/30 bg-brass/[0.06] p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
        <p className="text-xs leading-relaxed text-muted-l dark:text-muted-d">
          This access token can place real orders on your funded account. It's stored only on your local backend
          (never in the browser or git) and shown here masked. Dhruva uses it for <span className="font-medium text-ink-text dark:text-paper">data only</span> right now — no orders are ever sent.
        </p>
      </div>

      {status?.configured ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-paper-3 bg-paper/50 px-3 py-2.5 dark:border-ink-3 dark:bg-ink/30">
            <CheckCircle2 className="h-4 w-4 text-sage" />
            <span className="text-sm text-ink-text dark:text-paper">
              Connected as <span className="num">{status.clientId}</span>
            </span>
            <span className="num text-xs text-muted-l dark:text-muted-d">token {status.tokenMask}</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={test}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-jade/12 px-3 py-1.5 text-xs font-medium text-jade-deep transition-colors hover:bg-jade/20 disabled:opacity-50 dark:text-jade-soft"
              >
                {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Test connection
              </button>
              <button
                onClick={disconnect}
                disabled={busy !== null}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-l transition-colors hover:text-clay disabled:opacity-50 dark:text-muted-d"
              >
                Disconnect
              </button>
            </div>
          </div>

          {profile && (
            <div className="rounded-xl border border-paper-3 p-3 dark:border-ink-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sage" />
                <span className="text-sm font-medium text-ink-text dark:text-paper">Token is valid</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <ProfileRow label="Client ID" value={profile.clientId} />
                <ProfileRow label="Active segment" value={profile.activeSegment} />
                <ProfileRow label="Token validity" value={profile.tokenValidity} />
                <ProfileRow
                  label="Data plan"
                  value={profile.dataPlan ?? '—'}
                  tone={dataActive ? 'good' : 'warn'}
                />
                <ProfileRow label="Data validity" value={profile.dataValidity} />
              </dl>
              {!dataActive && (
                <p className="mt-2 text-xs leading-relaxed text-brass">
                  Live quotes need an active Data API plan (a separate paid subscription on Dhan). Trading works without
                  it, but the live feed won't return prices until the data plan is active.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">Client ID</span>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 1000000123"
              autoComplete="off"
              spellCheck={false}
              className="num rounded-lg border border-paper-3 bg-paper px-3 py-2 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">Access token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="JWT access token"
              autoComplete="off"
              spellCheck={false}
              className="rounded-lg border border-paper-3 bg-paper px-3 py-2 text-sm text-ink-text outline-none focus:border-jade/50 dark:border-ink-3 dark:bg-ink dark:text-paper"
            />
          </label>
          <button
            onClick={save}
            disabled={busy !== null || !clientId.trim() || token.trim().length < 8}
            className="inline-flex items-center gap-1.5 rounded-lg bg-jade px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-jade-deep disabled:opacity-50"
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Save &amp; connect
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex gap-2 rounded-xl border border-clay/30 bg-clay/[0.06] p-3 text-xs text-clay">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
    </section>
  )
}

function ProfileRow({ label, value, tone }: { label: string; value?: string; tone?: 'good' | 'warn' }) {
  return (
    <>
      <dt className="text-muted-l dark:text-muted-d">{label}</dt>
      <dd
        className={cn(
          'num text-right',
          tone === 'good' && 'text-sage',
          tone === 'warn' && 'text-brass',
          !tone && 'text-ink-text dark:text-paper',
        )}
      >
        {value || '—'}
      </dd>
    </>
  )
}

function Segment({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Sun
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors',
        active
          ? 'border-jade/50 bg-jade/[0.08] text-jade-deep dark:text-jade-soft'
          : 'border-paper-3 text-muted-l hover:text-ink-text dark:border-ink-3 dark:text-muted-d dark:hover:text-paper',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
