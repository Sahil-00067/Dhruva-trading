import { Info } from 'lucide-react'

// Persistent, honest reminder. Shown in the footer and on results.
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-l dark:text-muted-d">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Educational tool with simulated data — not investment advice. No strategy guarantees profit.
      </p>
    )
  }
  return (
    <div className="rounded-2xl border border-brass/25 bg-brass/[0.06] p-4">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
        <p className="text-sm leading-relaxed text-muted-l dark:text-muted-d">
          <span className="font-medium text-ink-text dark:text-paper">Educational, paper-trading only.</span> Figures
          shown are illustrative and use simulated data. Past performance never guarantees future results, and no
          strategy removes the risk of loss. Nothing here is investment advice.
        </p>
      </div>
    </div>
  )
}
