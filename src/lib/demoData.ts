// Real NSE/BSE instrument list for the UI.
// Matches the backend SYMBOL_MAP exactly so search returns real tickers.
// When the backend is running, these override the synthetic fallbacks.

export type Candle = { time: string; open: number; high: number; low: number; close: number }
export type Quote = { price: number; prevClose: number; change: number; changePct: number }

export type Instrument = {
  symbol: string
  name: string
  kind: 'index' | 'stock'
  seed: number
  start: number
  drift: number // annualized
  vol: number // annualized
}

// Master list — indices first, then NIFTY 50, then mid/large caps.
const RAW: { symbol: string; name: string; kind: 'index' | 'stock'; start: number }[] = [
  // Indices
  { symbol: 'NIFTY 50', name: 'NSE Nifty 50', kind: 'index', start: 24850 },
  { symbol: 'NIFTY BANK', name: 'Nifty Bank Index', kind: 'index', start: 51200 },
  { symbol: 'SENSEX', name: 'BSE Sensex', kind: 'index', start: 81300 },
  { symbol: 'NIFTY IT', name: 'Nifty IT Index', kind: 'index', start: 38400 },
  { symbol: 'NIFTY PHARMA', name: 'Nifty Pharma', kind: 'index', start: 19200 },
  { symbol: 'NIFTY AUTO', name: 'Nifty Auto', kind: 'index', start: 21500 },
  { symbol: 'NIFTY FIN SERVICE', name: 'Nifty Financial Services', kind: 'index', start: 22100 },
  { symbol: 'NIFTY METAL', name: 'Nifty Metal', kind: 'index', start: 8200 },
  { symbol: 'NIFTY FMCG', name: 'Nifty FMCG', kind: 'index', start: 22400 },
  { symbol: 'NIFTY MEDIA', name: 'Nifty Media', kind: 'index', start: 16800 },
  { symbol: 'NIFTY PSU BANK', name: 'Nifty PSU Bank', kind: 'index', start: 5800 },
  { symbol: 'NIFTY PRIVATE BANK', name: 'Nifty Private Bank', kind: 'index', start: 52400 },
  { symbol: 'NIFTY NEXT 50', name: 'Nifty Next 50', kind: 'index', start: 52100 },
  { symbol: 'NIFTY 500', name: 'Nifty 500', kind: 'index', start: 24600 },
  { symbol: 'NIFTY MIDCAP 100', name: 'Nifty Midcap 100', kind: 'index', start: 47200 },
  { symbol: 'NIFTY SMALLCAP 50', name: 'Nifty Smallcap 50', kind: 'index', start: 28500 },
  { symbol: 'NIFTY 100', name: 'Nifty 100', kind: 'index', start: 24700 },
  { symbol: 'NIFTY 200', name: 'Nifty 200', kind: 'index', start: 24900 },
  { symbol: 'INDIA VIX', name: 'India VIX', kind: 'index', start: 135 },

  // NIFTY 50 Stocks
  { symbol: 'RELIANCE', name: 'Reliance Industries', kind: 'stock', start: 2950 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', kind: 'stock', start: 4180 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', kind: 'stock', start: 1660 },
  { symbol: 'INFY', name: 'Infosys', kind: 'stock', start: 1820 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', kind: 'stock', start: 1230 },
  { symbol: 'SBIN', name: 'State Bank of India', kind: 'stock', start: 830 },
  { symbol: 'ITC', name: 'ITC Limited', kind: 'stock', start: 465 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', kind: 'stock', start: 1680 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', kind: 'stock', start: 1840 },
  { symbol: 'LT', name: 'Larsen & Toubro', kind: 'stock', start: 3680 },
  { symbol: 'AXISBANK', name: 'Axis Bank', kind: 'stock', start: 1180 },
  { symbol: 'HCLTECH', name: 'HCL Technologies', kind: 'stock', start: 1680 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', kind: 'stock', start: 7200 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', kind: 'stock', start: 11200 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', kind: 'stock', start: 3250 },
  { symbol: 'TITAN', name: 'Titan Company', kind: 'stock', start: 3480 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', kind: 'stock', start: 1720 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', kind: 'stock', start: 1080 },
  { symbol: 'TATASTEEL', name: 'Tata Steel', kind: 'stock', start: 162 },
  { symbol: 'WIPRO', name: 'Wipro', kind: 'stock', start: 560 },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', kind: 'stock', start: 11400 },
  { symbol: 'NESTLEIND', name: 'Nestle India', kind: 'stock', start: 2680 },
  { symbol: 'POWERGRID', name: 'Power Grid Corp', kind: 'stock', start: 320 },
  { symbol: 'NTPC', name: 'NTPC Limited', kind: 'stock', start: 405 },
  { symbol: 'ONGC', name: 'Oil & Natural Gas', kind: 'stock', start: 310 },
  { symbol: 'JSWSTEEL', name: 'JSW Steel', kind: 'stock', start: 980 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', kind: 'stock', start: 2280 },
  { symbol: 'HAL', name: 'Hindustan Aeronautics', kind: 'stock', start: 4850 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', kind: 'stock', start: 3250 },
  { symbol: 'ADANIPORTS', name: 'Adani Ports', kind: 'stock', start: 1380 },
  { symbol: 'BPCL', name: 'Bharat Petroleum', kind: 'stock', start: 680 },
  { symbol: 'IOC', name: 'Indian Oil Corp', kind: 'stock', start: 172 },
  { symbol: 'COALINDIA', name: 'Coal India', kind: 'stock', start: 515 },
  { symbol: 'GRASIM', name: 'Grasim Industries', kind: 'stock', start: 2580 },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', kind: 'stock', start: 5750 },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', kind: 'stock', start: 635 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', kind: 'stock', start: 2780 },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank', kind: 'stock', start: 1620 },
  { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories', kind: 'stock', start: 7650 },
  { symbol: 'CIPLA', name: 'Cipla', kind: 'stock', start: 1620 },
  { symbol: 'DABUR', name: 'Dabur India', kind: 'stock', start: 620 },
  { symbol: 'GAIL', name: 'GAIL India', kind: 'stock', start: 205 },
  { symbol: 'HAVELLS', name: 'Havells India', kind: 'stock', start: 1750 },
  { symbol: 'IRCTC', name: 'IRCTC', kind: 'stock', start: 1080 },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', kind: 'stock', start: 5200 },
  { symbol: 'VEDL', name: 'Vedanta', kind: 'stock', start: 525 },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', kind: 'stock', start: 1180 },
  { symbol: 'BANKINDIA', name: 'Bank of India', kind: 'stock', start: 142 },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', kind: 'stock', start: 118 },
  { symbol: 'CANBK', name: 'Canara Bank', kind: 'stock', start: 115 },
  { symbol: 'PUNJABNATION', name: 'Punjab National Bank', kind: 'stock', start: 110 },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank', kind: 'stock', start: 82 },
  { symbol: 'RBLBANK', name: 'RBL Bank', kind: 'stock', start: 625 },
  { symbol: 'FEDERALBNK', name: 'Federal Bank', kind: 'stock', start: 175 },

  // Major Mid & Large Caps
  { symbol: 'DIVISLAB', name: 'Divis Laboratories', kind: 'stock', start: 5680 },
  { symbol: 'BRITANNIA', name: 'Britannia Industries', kind: 'stock', start: 5850 },
  { symbol: 'DIXON', name: 'Dixon Technologies', kind: 'stock', start: 7200 },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', kind: 'stock', start: 6850 },
  { symbol: 'MAXHEALTH', name: 'Max Healthcare', kind: 'stock', start: 780 },
  { symbol: 'LAURUSLABS', name: 'Laurus Labs', kind: 'stock', start: 565 },
  { symbol: 'POLYCAB', name: 'Polycab India', kind: 'stock', start: 8200 },
  { symbol: 'PAGEIND', name: 'Page Industries', kind: 'stock', start: 38500 },
  { symbol: 'TRENT', name: 'Trent Limited', kind: 'stock', start: 5850 },
  { symbol: 'ZEEL', name: 'Zee Entertainment', kind: 'stock', start: 275 },
  { symbol: 'ZOMATO', name: 'Zomato', kind: 'stock', start: 285 },
  { symbol: 'NYKAA', name: 'FSN E-Commerce (Nykaa)', kind: 'stock', start: 215 },
  { symbol: 'NAUKRI', name: 'Info Edge (Naukri)', kind: 'stock', start: 6200 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems', kind: 'stock', start: 7200 },
  { symbol: 'CYIENT', name: 'Cyient', kind: 'stock', start: 2450 },
  { symbol: 'TECHM', name: 'Tech Mahindra', kind: 'stock', start: 1680 },
  { symbol: 'ADANIENSOL', name: 'Adani Energy Solutions', kind: 'stock', start: 1350 },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy', kind: 'stock', start: 1580 },
  { symbol: 'ADANITRANS', name: 'Adani Transmission', kind: 'stock', start: 985 },
  { symbol: 'GODREJPROP', name: 'Godrej Properties', kind: 'stock', start: 4250 },
  { symbol: 'SOBHA', name: 'Sobha Limited', kind: 'stock', start: 1850 },
  { symbol: 'PRESTIGE', name: 'Prestige Estates', kind: 'stock', start: 1680 },
  { symbol: 'DLF', name: 'DLF Limited', kind: 'stock', start: 820 },
  { symbol: 'KEI', name: 'KEI Industries', kind: 'stock', start: 3850 },
  { symbol: 'SRF', name: 'SRF Limited', kind: 'stock', start: 2750 },
  { symbol: 'BALKRISIND', name: 'Balkrishna Industries', kind: 'stock', start: 3850 },
  { symbol: 'ALKEM', name: 'Alkem Laboratories', kind: 'stock', start: 6200 },
  { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', kind: 'stock', start: 1580 },
  { symbol: 'BLUESTARCO', name: 'Blue Star Limited', kind: 'stock', start: 1950 },
  { symbol: 'BIOCON', name: 'Biocon Limited', kind: 'stock', start: 380 },
  { symbol: 'GLENMARK', name: 'Glenmark Pharmaceuticals', kind: 'stock', start: 1780 },
  { symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences', kind: 'stock', start: 1180 },
  { symbol: 'LUPIN', name: 'Lupin Limited', kind: 'stock', start: 2450 },
  { symbol: 'SANOFI', name: 'Sanofi India', kind: 'stock', start: 2850 },
  { symbol: 'MOTHERSON', name: 'Samvardhana Motherson', kind: 'stock', start: 205 },
  { symbol: 'BOSCHLTD', name: 'Bosch Limited', kind: 'stock', start: 32500 },
  { symbol: 'VOLTAS', name: 'Voltas Limited', kind: 'stock', start: 1780 },
  { symbol: 'WHIRLPOOL', name: 'Whirlpool of India', kind: 'stock', start: 1980 },
  { symbol: 'CROMPTON', name: 'Crompton Greaves', kind: 'stock', start: 485 },
  { symbol: 'SUZLON', name: 'Suzlon Energy', kind: 'stock', start: 52 },
  { symbol: 'NHPC', name: 'NHPC Limited', kind: 'stock', start: 105 },
  { symbol: 'SJVN', name: 'SJVN Limited', kind: 'stock', start: 145 },
  { symbol: 'CESC', name: 'CESC Limited', kind: 'stock', start: 142 },
  { symbol: 'TATAPOWER', name: 'Tata Power', kind: 'stock', start: 495 },
  { symbol: 'ADANIPOWER', name: 'Adani Power', kind: 'stock', start: 585 },
  { symbol: 'TORNTPOWER', name: 'Torrent Power', kind: 'stock', start: 1680 },
  { symbol: 'JSWENERGY', name: 'JSW Energy', kind: 'stock', start: 985 },
  { symbol: 'PFC', name: 'Power Finance Corp', kind: 'stock', start: 585 },
  { symbol: 'RECLTD', name: 'REC Limited', kind: 'stock', start: 680 },
  { symbol: 'MGL', name: 'Mahanagar Gas', kind: 'stock', start: 980 },
  { symbol: 'OIL', name: 'Oil India Limited', kind: 'stock', start: 285 },
  { symbol: 'HPCL', name: 'Hindustan Petroleum', kind: 'stock', start: 680 },
  { symbol: 'IOCL', name: 'Indian Oil Corp', kind: 'stock', start: 172 },
  { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power', kind: 'stock', start: 885 },
  { symbol: 'NMDC', name: 'NMDC Limited', kind: 'stock', start: 265 },
  { symbol: 'HINDZINC', name: 'Hindustan Zinc', kind: 'stock', start: 485 },
  { symbol: 'SAIL', name: 'Steel Authority of India', kind: 'stock', start: 168 },
  { symbol: 'JSL', name: 'Jindal Stainless', kind: 'stock', start: 1280 },
  { symbol: 'ACC', name: 'ACC Limited', kind: 'stock', start: 1680 },
  { symbol: 'SHREECEM', name: 'Shree Cement', kind: 'stock', start: 28500 },
  { symbol: 'APLAPOLLO', name: 'APL Apollo Tubes', kind: 'stock', start: 2280 },
  { symbol: 'JKCEMENT', name: 'JK Cement', kind: 'stock', start: 5850 },
  { symbol: 'COROMANDEL', name: 'Coromandel International', kind: 'stock', start: 1180 },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries', kind: 'stock', start: 2850 },
  { symbol: 'PIIND', name: 'PI Industries', kind: 'stock', start: 3850 },
  { symbol: 'BERGEPAINT', name: 'Berger Paints', kind: 'stock', start: 685 },
  { symbol: 'CARBORUNIV', name: 'Carborundum Universal', kind: 'stock', start: 1580 },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Investment', kind: 'stock', start: 1680 },
  { symbol: 'CUMMINSIND', name: 'Cummins India', kind: 'stock', start: 3850 },
  { symbol: 'ESCORTS', name: 'Escorts Kubota', kind: 'stock', start: 3250 },
  { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance', kind: 'stock', start: 2680 },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance', kind: 'stock', start: 3650 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', kind: 'stock', start: 1680 },
  { symbol: 'BAJAJHLDNG', name: 'Bajaj Holdings', kind: 'stock', start: 7200 },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance', kind: 'stock', start: 1780 },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', kind: 'stock', start: 680 },
  { symbol: 'ICICIPRULI', name: 'ICICI Prudential Life', kind: 'stock', start: 680 },
  { symbol: 'LICHSGRE', name: 'Life Insurance Corp', kind: 'stock', start: 820 },
  { symbol: 'SBICARD', name: 'SBI Card', kind: 'stock', start: 980 },
  { symbol: 'MANAPPURAM', name: 'Manappuram Finance', kind: 'stock', start: 285 },
  { symbol: 'PNBGILDS', name: 'Punjab National Bank Gil', kind: 'stock', start: 1280 },
  { symbol: 'ZEEL', name: 'Zee Entertainment', kind: 'stock', start: 275 },
  { symbol: 'NYKAA', name: 'FSN E-Commerce', kind: 'stock', start: 215 },
  { symbol: 'ZOMATO', name: 'Zomato', kind: 'stock', start: 285 },
  { symbol: 'NAUKRI', name: 'Info Edge', kind: 'stock', start: 6200 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems', kind: 'stock', start: 7200 },
  { symbol: 'ADANIENSOL', name: 'Adani Energy Sol.', kind: 'stock', start: 1350 },
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy', kind: 'stock', start: 1580 },
  { symbol: 'ADANITRANS', name: 'Adani Transmission', kind: 'stock', start: 985 },
  { symbol: 'GODREJPROP', name: 'Godrej Properties', kind: 'stock', start: 4250 },
  { symbol: 'SOBHA', name: 'Sobha Limited', kind: 'stock', start: 1850 },
  { symbol: 'PRESTIGE', name: 'Prestige Estates', kind: 'stock', start: 1680 },
  { symbol: 'DLF', name: 'DLF Limited', kind: 'stock', start: 820 },
  { symbol: 'AARTIIND', name: 'Aarti Industries', kind: 'stock', start: 780 },
  { symbol: 'UNITDSPR', name: 'United Spirits', kind: 'stock', start: 1280 },
  { symbol: 'MCDOWELL-N', name: 'United Spirits', kind: 'stock', start: 1280 },
]

// Deduplicate and derive seed/vol/drift from symbol name
const seen = new Set<string>()
export const INSTRUMENTS: Instrument[] = RAW.filter((r) => {
  if (seen.has(r.symbol)) return false
  seen.add(r.symbol)
  return true
}).map(({ symbol, name, kind, start }) => ({
  symbol,
  name,
  kind,
  start,
  seed: hashSymbol(symbol),
  drift: 0.06 + (hashSymbol(symbol) % 12) / 100,
  vol: 0.18 + ((hashSymbol(symbol) >> 8) % 16) / 100,
}))

function hashSymbol(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number) {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function lastWeekdays(n: number): string[] {
  const out: string[] = []
  const d = new Date(Date.UTC(2026, 8, 4))
  while (out.length < n) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return out.reverse()
}

const candleCache = new Map<string, Candle[]>()

function syntheticInstrument(symbol: string): Instrument {
  const h = hashSymbol(symbol)
  const start = 80 + (h % 3920)
  return {
    symbol,
    name: symbol,
    kind: 'stock',
    seed: h % 100000,
    start,
    drift: 0.06 + ((h >> 8) % 12) / 100,
    vol: 0.18 + ((h >> 16) % 16) / 100,
  }
}

export function getCandles(symbol: string, n = 180): Candle[] {
  const key = `${symbol}:${n}`
  const cached = candleCache.get(key)
  if (cached) return cached

  const inst = INSTRUMENTS.find((i) => i.symbol === symbol) ?? syntheticInstrument(symbol)
  const rand = mulberry32(inst.seed * 9973 + n)
  const dates = lastWeekdays(n)
  const dt = 1 / 252
  const candles: Candle[] = []
  let prevClose = inst.start / Math.exp(inst.drift * (n / 252))
  let volState = 1

  for (let i = 0; i < n; i++) {
    if (rand() > 0.985) volState += 0.8 + rand() * 1.4
    volState = 1 + (volState - 1) * 0.92
    const dayVol = inst.vol * volState
    const z = gaussian(rand)
    let gap = gaussian(rand) * 0.0015
    if (rand() > 0.97) gap += (rand() - 0.5) * 0.03 * volState
    const open = prevClose * (1 + gap)
    const close = open * Math.exp((inst.drift - 0.5 * dayVol ** 2) * dt + dayVol * Math.sqrt(dt) * z)
    const spread = Math.abs(close - open) + open * dayVol * Math.sqrt(dt) * (0.4 + rand() * 0.8)
    const high = Math.max(open, close) + spread * rand()
    const low = Math.min(open, close) - spread * rand()
    candles.push({ time: dates[i], open: round(open), high: round(high), low: round(low), close: round(close) })
    prevClose = close
  }

  const factor = inst.start / candles[n - 1].close
  for (const c of candles) {
    c.open = round(c.open * factor)
    c.high = round(c.high * factor)
    c.low = round(c.low * factor)
    c.close = round(c.close * factor)
  }

  candleCache.set(key, candles)
  return candles
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

export function getQuote(symbol: string): Quote {
  const c = getCandles(symbol)
  const last = c[c.length - 1]
  const prev = c[c.length - 2]
  const change = last.close - prev.close
  return { price: last.close, prevClose: prev.close, change, changePct: (change / prev.close) * 100 }
}

export function sparkline(symbol: string, points = 40): number[] {
  const c = getCandles(symbol)
  return c.slice(-points).map((x) => x.close)
}

export function nextTick(price: number, vol = 0.0006): number {
  const step = (Math.random() - 0.5) * 2 * vol
  return round(price * (1 + step))
}
