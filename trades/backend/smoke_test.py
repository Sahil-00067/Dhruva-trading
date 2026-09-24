"""Quick smoke test: engine math offline, then a live yfinance fetch.

Run:  .venv/Scripts/python.exe smoke_test.py
"""
from app.engine import run_backtest
from app.schemas import BacktestRequest


def synthetic():
    # A clean up-then-down ramp so an MA cross must take exactly one round trip.
    closes = [100 + i for i in range(40)] + [140 - i for i in range(40)]
    candles = [{"time": f"2026-01-{i+1:02d}", "open": c, "high": c, "low": c, "close": c}
               for i, c in enumerate(closes)]
    req = BacktestRequest(template="ma", symbol="TEST", fast=5, slow=10, costBps=20, lookback=80)
    res = run_backtest(candles, req)
    print("[offline] metrics:", {k: round(v, 3) if isinstance(v, float) else v for k, v in res["metrics"].items()})
    print("[offline] trades:", len(res["trades"]))
    for t in res["trades"]:
        print("   ", t["entryTime"], "->", t["exitTime"], f"{t['retPct']:.2f}%", "open" if t["open"] else "")


def live():
    from app import data
    ticker, candles = data.get_candles("NIFTY 50", 250)
    print(f"[live] {ticker}: {len(candles)} sessions, {candles[0]['time']} -> {candles[-1]['time']}, last close {candles[-1]['close']}")
    req = BacktestRequest(template="ma", symbol="NIFTY 50", fast=20, slow=50, costBps=20, lookback=250)
    res = run_backtest(candles, req)
    print("[live] metrics:", {k: round(v, 3) if isinstance(v, float) else v for k, v in res["metrics"].items()})


if __name__ == "__main__":
    synthetic()
    try:
        live()
    except Exception as e:
        print("[live] FAILED (offline is fine, user's machine will have net):", repr(e))
