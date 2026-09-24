import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, MapPin, FlaskConical } from 'lucide-react'
import { strategyById } from '../lib/strategies'
import { Badge } from '../components/Badge'
import { Disclaimer } from '../components/Disclaimer'
import { num } from '../lib/format'

export function StrategyDetail() {
  const { id } = useParams()
  const s = id ? strategyById(id) : undefined

  if (!s) {
    return (
      <div className="animate-fade-up card p-10 text-center">
        <p className="text-muted-l dark:text-muted-d">That strategy doesn't exist.</p>
        <Link to="/strategies" className="mt-3 inline-block font-medium text-jade-deep hover:underline dark:text-jade-soft">
          Back to library
        </Link>
      </div>
    )
  }

  const stats = [
    { label: 'CAGR', value: `${num(s.illus.cagr, 1)}%` },
    { label: 'Sharpe', value: num(s.illus.sharpe) },
    { label: 'Max DD', value: `${num(s.illus.maxDD, 1)}%` },
    { label: 'Complexity', value: s.complexity },
  ]

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        to="/strategies"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-l transition-colors hover:text-ink-text dark:text-muted-d dark:hover:text-paper"
      >
        <ArrowLeft className="h-4 w-4" />
        Library
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-jade-deep dark:text-jade-soft">
            {s.category}
          </span>
          {s.badges.map((b) => (
            <Badge key={b} kind={b} />
          ))}
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink-text dark:text-paper sm:text-4xl">{s.name}</h1>
        <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-l dark:text-muted-d">{s.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-l dark:text-muted-d">
          <span className="rounded-full bg-paper-3/70 px-2.5 py-1 dark:bg-ink-3/70">Horizon · {s.horizon}</span>
          <span className="rounded-full bg-paper-3/70 px-2.5 py-1 capitalize dark:bg-ink-3/70">{s.mode}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="card p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-l dark:text-muted-d">{st.label}</div>
            <div className="num mt-1 text-xl text-ink-text dark:text-paper">{st.value}</div>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted-l dark:text-muted-d">Stats are illustrative placeholders, not backtested results.</p>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl text-ink-text dark:text-paper">How it works</h2>
        <p className="mt-2 leading-relaxed text-muted-l dark:text-muted-d">{s.mechanism}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card border-sage/25 p-5">
          <div className="flex items-center gap-2 text-sage">
            <Check className="h-4 w-4" />
            <h3 className="font-medium">Works when</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-l dark:text-muted-d">{s.worksWhen}</p>
        </section>
        <section className="card border-clay/25 p-5">
          <div className="flex items-center gap-2 text-clay">
            <X className="h-4 w-4" />
            <h3 className="font-medium">Fails when</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-l dark:text-muted-d">{s.failsWhen}</p>
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-jade-deep dark:text-jade-soft">
          <MapPin className="h-4 w-4" />
          <h3 className="font-medium">In Indian markets</h3>
        </div>
        <p className="mt-2 leading-relaxed text-muted-l dark:text-muted-d">{s.indiaNote}</p>
      </section>

      <Link
        to="/backtest"
        className="card flex items-center justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-float"
      >
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-jade" />
          <div>
            <div className="font-display text-lg text-ink-text dark:text-paper">Test a version of this</div>
            <p className="text-sm text-muted-l dark:text-muted-d">Open the backtester with a comparable rule.</p>
          </div>
        </div>
      </Link>

      <Disclaimer />
    </div>
  )
}
