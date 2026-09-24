import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import type { Badge as BadgeKind } from '../lib/strategies'

const STYLES: Record<string, string> = {
  Default: 'bg-jade/12 text-jade-deep dark:text-jade-soft ring-jade/25',
  'Best pick': 'bg-brass/14 text-brass ring-brass/30',
  'Market-neutral': 'bg-muted-l/10 text-muted-l dark:text-muted-d ring-muted-l/20 dark:ring-muted-d/20',
  Defensive: 'bg-sage/14 text-sage ring-sage/30',
}

export function Badge({ kind }: { kind: BadgeKind }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset',
        STYLES[kind] ?? 'bg-paper-3 dark:bg-ink-3 text-muted-l dark:text-muted-d ring-transparent',
      )}
    >
      {kind === 'Best pick' && <span className="mr-1">★</span>}
      {kind}
    </span>
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'jade' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'jade'
          ? 'bg-jade/10 text-jade-deep dark:text-jade-soft'
          : 'bg-paper-3/70 dark:bg-ink-3/70 text-muted-l dark:text-muted-d',
      )}
    >
      {children}
    </span>
  )
}
