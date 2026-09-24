import { cn } from '../lib/cn'

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'up' | 'down'
}) {
  return (
    <div className={cn(
      'border p-3',
      tone === 'up' ? 'border-sage/40 bg-sage/5' :
      tone === 'down' ? 'border-clay/40 bg-clay/5' :
      'border-paper-3 bg-paper-2',
    )}>
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-l">{label}</div>
      <div
        className={cn(
          'num mt-1 text-xl font-semibold',
          tone === 'up' && 'text-sage',
          tone === 'down' && 'text-clay',
          tone === 'neutral' && 'text-ink-text',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-l">{sub}</div>}
    </div>
  )
}
