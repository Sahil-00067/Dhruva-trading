import { useId } from 'react'

// Lightweight inline SVG sparkline — no dependency, scales to its container.
export function Sparkline({
  data,
  width = 120,
  height = 36,
  strokeWidth = 1.6,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
}) {
  const id = useId()
  if (data.length < 2) return <svg width={width} height={height} className={className} />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const dx = width / (data.length - 1)
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / span) * (height - 2) - 1] as const)

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const up = data[data.length - 1] >= data[0]
  const stroke = up ? '#3FB0A0' : '#C77F76'

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
