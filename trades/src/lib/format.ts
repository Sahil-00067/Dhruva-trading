// Indian-locale number & money formatting helpers.

export function compactINR(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return `${Math.round(n)}`
}

export function inr(n: number, opts?: { compact?: boolean; decimals?: number }): string {
  if (opts?.compact) return `₹${compactINR(n)}`
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  })}`
}

export function num(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function pct(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

export function signed(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${num(n, decimals)}`
}
