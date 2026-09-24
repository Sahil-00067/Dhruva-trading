import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { cn } from '../lib/cn'

export type ChartType = 'candles' | 'bars' | 'line' | 'area' | 'baseline'

// A bar's time is a 'yyyy-mm-dd' string (daily) or a unix timestamp (intraday).
export type ChartBar = { time: string | number; open: number; high: number; low: number; close: number }

export type ChartMarker = {
  time: string | number
  position: 'aboveBar' | 'belowBar' | 'inBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
  text?: string
}

type Props = {
  data: ChartBar[]
  type?: ChartType
  height?: number
  markers?: ChartMarker[]
  // Intraday shows HH:MM on the axis; daily shows the date.
  intraday?: boolean
  // When set, pin the visible span to [0, fixedRange] instead of fitting to `data`.
  // Lets the caller reveal bars one-by-one without the x-axis rescaling each frame.
  fixedRange?: number
  // Optional reference line drawn on top of the main series (e.g. a buy & hold
  // benchmark on the equity chart). Memoize it in the caller to avoid churn.
  overlay?: { time: string | number; value: number }[]
  // Show ＋ / − / reset zoom controls in the corner (wheel + pinch always work).
  zoomable?: boolean
}

const UP = '#6FB98F'
const DOWN = '#C77F76'
const ACCENT = '#2E9E8F'
const BENCH = '#B5893C' // buy & hold reference line (muted brass), drawn dashed

const PALETTE = {
  dark: {
    text: '#8CA3A0',
    grid: 'rgba(30,47,52,0.7)',
    border: 'rgba(30,47,52,0.9)',
    crosshair: 'rgba(140,163,160,0.4)',
  },
  light: {
    text: '#5C6B69',
    grid: 'rgba(228,234,232,0.9)',
    border: 'rgba(228,234,232,1)',
    crosshair: 'rgba(92,107,105,0.35)',
  },
}

const isOhlc = (t: ChartType) => t === 'candles' || t === 'bars'

export function PriceChart({ data, type = 'candles', height = 340, markers, intraday, fixedRange, overlay, zoomable }: Props) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area' | 'Baseline'> | null>(null)
  const overlayRef = useRef<ISeriesApi<'Line'> | null>(null)
  const overlayOn = !!(overlay && overlay.length)

  // Create chart + series once per (type, intraday) — switching either rebuilds so the
  // series never mixes OHLC/line shapes or string/number time types.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: !!intraday,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
      // Interactive zoom/pan: mouse wheel, pinch, and drag. The data effect below
      // re-fits on a fresh dataset, so a deliberate reload resets the view.
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    })
    chartRef.current = chart

    if (type === 'candles') {
      seriesRef.current = chart.addCandlestickSeries({
        upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false,
      })
    } else if (type === 'bars') {
      seriesRef.current = chart.addBarSeries({ upColor: UP, downColor: DOWN, thinBars: false })
    } else if (type === 'line') {
      seriesRef.current = chart.addLineSeries({ color: ACCENT, lineWidth: 2 })
    } else if (type === 'baseline') {
      seriesRef.current = chart.addBaselineSeries({
        baseValue: { type: 'price', price: 0 }, // set for real once data arrives
        topLineColor: UP,
        topFillColor1: 'rgba(111,185,143,0.28)',
        topFillColor2: 'rgba(111,185,143,0.02)',
        bottomLineColor: DOWN,
        bottomFillColor1: 'rgba(199,127,118,0.02)',
        bottomFillColor2: 'rgba(199,127,118,0.28)',
        lineWidth: 2,
      })
    } else {
      seriesRef.current = chart.addAreaSeries({
        lineColor: ACCENT,
        topColor: 'rgba(46,158,143,0.3)',
        bottomColor: 'rgba(46,158,143,0.02)',
        lineWidth: 2,
        priceFormat: { type: 'price' },
      })
    }

    // Optional reference line (buy & hold). Kept visually secondary: dashed, no
    // last-value tag, no price line, so it reads as a benchmark not a series.
    if (overlayOn) {
      overlayRef.current = chart.addLineSeries({
        color: BENCH,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      })
    }

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) chart.applyOptions({ width: Math.floor(w) })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      overlayRef.current = null
    }
  }, [type, height, intraday, overlayOn])

  // Theme-driven colours.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const p = PALETTE[theme]
    chart.applyOptions({
      layout: { textColor: p.text },
      grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
      rightPriceScale: { borderColor: p.border },
      timeScale: { borderColor: p.border },
      crosshair: {
        vertLine: { color: p.crosshair, labelBackgroundColor: theme === 'dark' ? '#1E2F34' : '#5C6B69' },
        horzLine: { color: p.crosshair, labelBackgroundColor: theme === 'dark' ? '#1E2F34' : '#5C6B69' },
      },
    })
  }, [theme])

  // Data.
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    if (isOhlc(type)) {
      series.setData(data as never)
    } else {
      // Baseline uses the first close as the zero line (green above / red below).
      if (type === 'baseline' && data.length) {
        series.applyOptions({ baseValue: { type: 'price', price: data[0].close } } as never)
      }
      series.setData(data.map((d) => ({ time: d.time, value: d.close })) as never)
    }
    if (overlayRef.current) {
      overlayRef.current.setData((overlay ?? []) as never)
    }
    const ts = chartRef.current?.timeScale()
    if (ts) {
      if (fixedRange && fixedRange > 1) ts.setVisibleLogicalRange({ from: -1, to: fixedRange })
      else ts.fitContent()
    }
  }, [data, type, fixedRange, overlay])

  // Trade markers (buy/sell arrows).
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    series.setMarkers((markers ?? []) as never)
  }, [markers, type])

  // Zoom helpers — scale the visible span around its centre. Wheel/pinch do this
  // natively; the buttons make it discoverable (and usable without a wheel).
  const zoomBy = (factor: number) => {
    const ts = chartRef.current?.timeScale()
    const r = ts?.getVisibleLogicalRange()
    if (!ts || !r) return
    const center = (r.from + r.to) / 2
    const half = ((r.to - r.from) * factor) / 2
    ts.setVisibleLogicalRange({ from: center - half, to: center + half })
  }
  const resetZoom = () => chartRef.current?.timeScale().fitContent()

  const zoomBtn =
    'flex h-7 w-7 items-center justify-center text-muted-l transition-colors hover:bg-jade/10 hover:text-jade dark:text-muted-d dark:hover:text-jade-soft'

  return (
    <div className="relative w-full">
      <div ref={containerRef} style={{ height }} className="w-full" />
      {zoomable && (
        <div className="absolute right-2 top-2 flex overflow-hidden rounded-lg border border-paper-3 bg-paper/85 backdrop-blur-sm dark:border-ink-3 dark:bg-ink-2/85">
          <button type="button" onClick={() => zoomBy(0.6)} aria-label="Zoom in" className={zoomBtn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => zoomBy(1.65)} aria-label="Zoom out" className={cn(zoomBtn, 'border-x border-paper-3 dark:border-ink-3')}>
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={resetZoom} aria-label="Reset zoom" className={zoomBtn}>
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
