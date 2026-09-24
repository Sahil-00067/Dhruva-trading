"""Real NSE/BSE market data via yfinance, with a simple on-disk daily cache.

EOD (end-of-day) data is free and unauthenticated through Yahoo Finance. We cache
each ticker's full history to CSV and refresh once per calendar day.
"""
from __future__ import annotations

import calendar
import os
import time as _time
from datetime import date, datetime

import pandas as pd
import yfinance as yf

# App symbol -> Yahoo ticker. Indices use ^ tickers; NSE stocks use the .NS suffix.
SYMBOL_MAP: dict[str, str] = {
    # --- Indices ---
    "NIFTY 50": "^NSEI",
    "NIFTY BANK": "^NSEBANK",
    "SENSEX": "^BSESN",
    "NIFTY IT": "^CNXIT",
    "NIFTY PHARMA": "^CNXPHARMA",
    "NIFTY AUTO": "^CNXAUTO",
    "NIFTY FIN SERVICE": "^NSEFIN",
    "NIFTY METAL": "^CNXMETAL",
    "NIFTY FMCG": "^CNXFMCG",
    "NIFTY MEDIA": "^CNXMEDIA",
    "NIFTY PSU BANK": "^NSEPSUBANK",
    "NIFTY PRIVATE BANK": "^NSEPBANK",
    "NIFTY NEXT 50": "^NSENXT50",
    "NIFTY 500": "^NSE500",
    "NIFTY MIDCAP 100": "^CNXMID100",
    "NIFTY SMALLCAP 50": "^CNXSMALL50",
    "NIFTY 100": "^NSE100",
    "NIFTY 200": "^NSE200",
    "INDIA VIX": "^VIX",

    # --- NIFTY 50 Stocks ---
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "INFY": "INFY.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBIN": "SBIN.NS",
    "ITC": "ITC.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "LT": "LT.NS",
    "AXISBANK": "AXISBANK.NS",
    "HCLTECH": "HCLTECH.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "MARUTI": "MARUTI.NS",
    "ASIANPAINT": "ASIANPAINT.NS",
    "TITAN": "TITAN.NS",
    "SUNPHARMA": "SUNPHARMA.NS",
    "TATAMOTORS": "TATAMOTORS.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "WIPRO": "WIPRO.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS",
    "NESTLEIND": "NESTLEIND.NS",
    "POWERGRID": "POWERGRID.NS",
    "NTPC": "NTPC.NS",
    "ONGC": "ONGC.NS",
    "JSWSTEEL": "JSWSTEEL.NS",
    "M&M": "M&M.NS",
    "HAL": "HAL.NS",
    "ADANIENT": "ADANIENT.NS",
    "ADANIPORTS": "ADANIPORTS.NS",
    "BPCL": "BPCL.NS",
    "IOC": "IOC.NS",
    "COALINDIA": "COALINDIA.NS",
    "GRASIM": "GRASIM.NS",
    "HEROMOTOCO": "HEROMOTOCO.NS",
    "HINDALCO": "HINDALCO.NS",
    "HINDUNILVR": "HINDUNILVR.NS",
    "INDUSINDBK": "INDUSINDBK.NS",
    "DRREDDY": "DRREDDY.NS",
    "CIPLA": "CIPLA.NS",
    "DABUR": "DABUR.NS",
    "GAIL": "GAIL.NS",
    "HAVELLS": "HAVELLS.NS",
    "IRCTC": "IRCTC.NS",
    "EICHERMOT": "EICHERMOT.NS",
    "VEDL": "VEDL.NS",
    "TATACONSUM": "TATACONSUM.NS",
    "BANKINDIA": "BANKINDIA.NS",
    "BANKBARODA": "BANKBARODA.NS",
    "CANBK": "CANBK.NS",
    "PUNJABNATION": "PNB.NS",
    "IDFCFIRSTB": "IDFCFIRSTB.NS",
    "RBLBANK": "RBLBANK.NS",
    "FEDERALBNK": "FEDERALBNK.NS",

    # --- Major Mid & Large Caps ---
    "DIVISLAB": "DIVISLAB.NS",
    "BRITANNIA": "BRITANNIA.NS",
    "DIXON": "DIXON.NS",
    "APOLLOHOSP": "APOLLOHOSP.NS",
    "MAXHEALTH": "MAXHEALTH.NS",
    "LAURUSLABS": "LAURUSLABS.NS",
    "POLYCAB": "POLYCAB.NS",
    "PAGEIND": "PAGEIND.NS",
    "TRENT": "TRENT.NS",
    "ZEEL": "ZEEL.NS",
    "ZOMATO": "ZOMATO.NS",
    "NYKAA": "NYKAA.NS",
    "NAUKRI": "NAUKRI.NS",
    "PERSISTENT": "PERSISTENT.NS",
    "CYIENT": "CYIENT.NS",
    "TECHM": "TECHM.NS",
    "SUZLON": "SUZLON.NS",
    "ADANIENSOL": "ADANIENSOL.NS",
    "ADANIGREEN": "ADANIGREEN.NS",
    "ADANITRANS": "ADANITRANS.NS",
    "GODREJPROP": "GODREJPROP.NS",
    "SOBHA": "SOBHA.NS",
    "PRESTIGE": "PRESTIGE.NS",
    "DLF": "DLF.NS",
    "GPIL": "GPIL.NS",
    "JIOSTAR": "JIOSTAR.NS",
    "RELXPOWER": "RELXPOWER.NS",
    "KEI": "KEI.NS",
    "SRF": "SRF.NS",
    "BALKRISIND": "BALKRISIND.NS",
    "AARTIIND": "AARTIIND.NS",
    "ALKEM": "ALKEM.NS",
    "AUROPHARMA": "AUROPHARMA.NS",
    "BLUESTARCO": "BLUESTARCO.NS",
    "BIOCON": "BIOCON.NS",
    "GLENMARK": "GLENMARK.NS",
    "ZYDUSLIFE": "ZYDUSLIFE.NS",
    "LUPIN": "LUPIN.NS",
    "CIPLA": "CIPLA.NS",
    "SANOFI": "SANOFI.NS",
    "USGIND": "USGIND.NS",
    "MANYAVAR": "MANYAVAR.NS",
    "RELAXO": "RELAXO.NS",
    "ABFRL": "ABFRL.NS",
    "RAYMOND": "RAYMOND.NS",
    "MOTHERSON": "MOTHERSON.NS",
    "BOSCHLTD": "BOSCHLTD.NS",
    "HAVELLS": "HAVELLS.NS",
    "VOLTAS": "VOLTAS.NS",
    "WHIRLPOOL": "WHIRLPOOL.NS",
    "CROMPTON": "CROMPTON.NS",
    "EBELT": "EBELT.NS",
    "NHPC": "NHPC.NS",
    "POWERINDIA": "POWERINDIA.NS",
    "CUMMINSIND": "CUMMINSIND.NS",
    "SCHNEIDER": "SCHNEIDER.NS",
    "SCHNEIDER": "SCHNEIDER.NS",
    "MCDOWELL-N": "MCDOWELL-N.NS",
    "UNITDSPR": "UNITDSPR.NS",
    "MUTHOOTFIN": "MUTHOOTFIN.NS",
    "SHRIRAMFIN": "SHRIRAMFIN.NS",
    "BAJAJFINSV": "BAJAJFINSV.NS",
    "BAJAJHLDNG": "BAJAJHLDNG.NS",
    "SBILIFE": "SBILIFE.NS",
    "HDFCLIFE": "HDFCLIFE.NS",
    "ICICIPRULI": "ICICIPRULI.NS",
    "LICHSGRE": "LICHSGRE.NS",
    "SBICARD": "SBICARD.NS",
    "CHOLAFIN": "CHOLAFIN.NS",
    "MANAPPURAM": "MANAPPURAM.NS",
    "PNBGILDS": "PNBGILDS.NS",
    "CHERANPGTN": "CHERANPGTN.NS",
    "ESCORTS": "ESCORTS.NS",
    "MAZDOCK": "MAZDOCK.NS",
    "COCHINSHIP": "COCHINSHIP.NS",
    "COREWOOD": "COREWOOD.NS",
    "COROMANDEL": "COROMANDEL.NS",
    "PIDILITIND": "PIDILITIND.NS",
    "PIIND": "PIIND.NS",
    "BERGEPAINT": "BERGEPAINT.NS",
    "CARBORUNIV": "CARBORUNIV.NS",
    "JKCEMENT": "JKCEMENT.NS",
    "ACC": "ACC.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS",
    "SHREECEM": "SHREECEM.NS",
    "APLAPOLLO": "APLAPOLLO.NS",
    "TATA金属": "TATASTEEL.NS",
    "SAIL": "SAIL.NS",
    "JINDALSTEL": "JINDALSTEL.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "NMDC": "NMDC.NS",
    "VEDL": "VEDL.NS",
    "HINDZINC": "HINDZINC.NS",
    "SAIL": "SAIL.NS",
    "JSL": "JSL.NS",
    "PFC": "PFC.NS",
    "RECLTD": "RECLTD.NS",
    "MGL": "MGL.NS",
    "OIL": "OIL.NS",
    "IOC": "IOC.NS",
    "ONGC": "ONGC.NS",
    "GAIL": "GAIL.NS",
    "BPCL": "BPCL.NS",
    "HPCL": "HPCL.NS",
    "IOCL": "IOCL.NS",
    "NTPC": "NTPC.NS",
    "POWERGRID": "POWERGRID.NS",
    "NHPC": "NHPC.NS",
    "SJVN": "SJVN.NS",
    "RENL": "RENL.NS",
    "CESC": "CESC.NS",
    "TATAPOWER": "TATAPOWER.NS",
    "ADANIPOWER": "ADANIPOWER.NS",
    "TORNTPOWER": "TORNTPOWER.NS",
    "JSWENERGY": "JSWENERGY.NS",
    "JSWSTEEL": "JSWSTEEL.NS",
    "HAL": "HAL.NS",
    "BEL": "BEL.NS",
    "MTARTECH": "MTARTECH.NS",
    "COCHINSHIP": "COCHINSHIP.NS",
    "MAZDOCK": "MAZDOCK.NS",
}

# Merge sector-index tickers if available
try:
    from .universe import INDEX_TICKERS
    SYMBOL_MAP.update(INDEX_TICKERS)
except Exception:
    pass

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")


def ticker_for(symbol: str) -> str:
    if symbol in SYMBOL_MAP:
        return SYMBOL_MAP[symbol]
    if symbol.startswith("^") or "." in symbol:
        return symbol
    return f"{symbol}.NS"


def _cache_path(ticker: str) -> str:
    safe = ticker.replace("^", "_idx_").replace(".", "_")
    return os.path.join(CACHE_DIR, f"{safe}.csv")


def _fresh_today(path: str) -> bool:
    if not os.path.exists(path):
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(path)).date()
    return mtime == date.today()


def _download(ticker: str) -> pd.DataFrame:
    hist = yf.Ticker(ticker).history(period="8y", interval="1d", auto_adjust=True)
    if hist is None or hist.empty:
        raise ValueError(f"No data returned for {ticker}")
    hist = hist[["Open", "High", "Low", "Close"]].dropna()
    return hist


def _load(ticker: str) -> pd.DataFrame:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = _cache_path(ticker)
    if _fresh_today(path):
        return pd.read_csv(path, index_col=0, parse_dates=True)
    df = _download(ticker)
    df.to_csv(path)
    return df


def get_candles(symbol: str, lookback: int) -> tuple[str, list[dict]]:
    ticker = ticker_for(symbol)
    df = _load(ticker).tail(lookback)
    candles: list[dict] = []
    for ts, row in df.iterrows():
        candles.append({
            "time": pd.Timestamp(ts).strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
        })
    return ticker, candles


_INTERVAL_PERIOD = {
    "1m": "5d",
    "5m": "5d",
    "15m": "5d",
    "30m": "1mo",
    "60m": "3mo",
    "1d": "1y",
}
_MAX_BARS = 800
_bar_cache: dict[tuple[str, str], tuple[float, pd.DataFrame]] = {}
_BAR_TTL = 120


def _fetch_ohlc(ticker: str, interval: str, period: str) -> pd.DataFrame:
    key = (ticker, interval)
    now = _time.time()
    hit = _bar_cache.get(key)
    if hit is not None and now - hit[0] < _BAR_TTL:
        return hit[1]
    df = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=True)
    if df is None or df.empty:
        raise ValueError(f"No {interval} data for {ticker}")
    df = df[["Open", "High", "Low", "Close"]].dropna()
    _bar_cache[key] = (now, df)
    return df


def _bars_from_df(df: pd.DataFrame, intraday: bool) -> list[dict]:
    bars: list[dict] = []
    for ts, row in zip(df.index, df.itertuples(index=False)):
        if intraday:
            p = pd.Timestamp(ts)
            p = p.tz_localize("UTC") if p.tz is None else p
            t = calendar.timegm(p.tz_convert("Asia/Kolkata").timetuple())
        else:
            t = pd.Timestamp(ts).strftime("%Y-%m-%d")
        bars.append({
            "time": t,
            "open": round(float(row.Open), 2),
            "high": round(float(row.High), 2),
            "low": round(float(row.Low), 2),
            "close": round(float(row.Close), 2),
        })
    return bars


def get_bars(symbol: str, interval: str) -> dict:
    if interval not in _INTERVAL_PERIOD:
        raise ValueError(f"Unsupported interval {interval!r}")
    ticker = ticker_for(symbol)
    df = _fetch_ohlc(ticker, interval, _INTERVAL_PERIOD[interval]).tail(_MAX_BARS)
    intraday = interval != "1d"
    return {"ticker": ticker, "interval": interval, "intraday": intraday, "bars": _bars_from_df(df, intraday)}


def get_backtest_candles(symbol: str, interval: str, lookback: int) -> tuple[str, list[dict], bool]:
    if interval == "1d":
        ticker, candles = get_candles(symbol, lookback)
        return ticker, candles, False
    b = get_bars(symbol, interval)
    return b["ticker"], b["bars"], b["intraday"]


def get_quote(symbol: str) -> dict:
    ticker = ticker_for(symbol)
    t = yf.Ticker(ticker)
    price = prev_close = None
    try:
        fi = t.fast_info
        price = float(fi["last_price"])
        prev_close = float(fi["previous_close"])
    except Exception:
        pass
    if price is None or prev_close is None:
        df = _load(ticker).tail(2)
        if len(df) >= 2:
            prev_close = float(df["Close"].iloc[-2])
            price = float(df["Close"].iloc[-1])
        elif len(df) == 1:
            price = prev_close = float(df["Close"].iloc[-1])
        else:
            raise ValueError(f"No quote available for {ticker}")
    change = price - prev_close
    return {
        "ticker": ticker,
        "price": round(price, 2),
        "prevClose": round(prev_close, 2),
        "change": round(change, 2),
        "changePct": round((change / prev_close * 100) if prev_close else 0.0, 2),
    }


def get_all_instruments() -> dict[str, str]:
    """Return all app symbols mapped to their Yahoo tickers."""
    return dict(SYMBOL_MAP)
