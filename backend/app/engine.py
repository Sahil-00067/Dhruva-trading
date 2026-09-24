"""Vectorized long/flat backtest engine — a faithful port of src/lib/backtest.ts.

Kept in pure Python (no pandas/numpy in the hot path) so the numbers match the
client-side engine bit-for-bit: switching from demo data to real NSE data changes
only the *data*, never the calculation. No look-ahead: the position decided using
data through day i earns day i+1's return.
"""
from __future__ import annotations

import math
from typing import Optional

from .schemas import BacktestRequest


# Annualization factor per timeframe. Daily = 252 trading days; intraday scales by the
# number of bars in an NSE session (~375 min: 9:15–15:30). MUST match TIMEFRAMES in
# src/pages/Backtest.tsx so the TS and Python engines annualize CAGR/Sharpe identically.
_SESSION_MINUTES = 375
_INTERVAL_MINUTES = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "60m": 60}


def _periods_per_year(interval: str) -> float:
    if interval == "1d" or interval not in _INTERVAL_MINUTES:
        return 252.0
    return 252.0 * (_SESSION_MINUTES / _INTERVAL_MINUTES[interval])


def _round(n: float) -> float:
    return round(n * 100) / 100


def sma_series(v: list[float], n: int) -> list[Optional[float]]:
    out: list[Optional[float]] = [None] * len(v)
    s = 0.0
    for i in range(len(v)):
        s += v[i]
        if i >= n:
            s -= v[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def rsi_series(v: list[float], n: int) -> list[Optional[float]]:
    out: list[Optional[float]] = [None] * len(v)
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, len(v)):
        ch = v[i] - v[i - 1]
        gain = max(ch, 0.0)
        loss = max(-ch, 0.0)
        if i <= n:
            avg_gain += gain / n
            avg_loss += loss / n
            if i == n:
                out[i] = 100 - 100 / (1 + avg_gain / (avg_loss or 1e-9))
        else:
            avg_gain = (avg_gain * (n - 1) + gain) / n
            avg_loss = (avg_loss * (n - 1) + loss) / n
            out[i] = 100 - 100 / (1 + avg_gain / (avg_loss or 1e-9))
    return out


def high_series(v: list[float], n: int) -> list[Optional[float]]:
    out: list[Optional[float]] = [None] * len(v)
    for i in range(n, len(v)):
        out[i] = max(v[i - n:i])
    return out


def low_series(v: list[float], n: int) -> list[Optional[float]]:
    out: list[Optional[float]] = [None] * len(v)
    for i in range(n, len(v)):
        out[i] = min(v[i - n:i])
    return out


def ema_series(v: list[float], n: int) -> list[Optional[float]]:
    """Wilder-style EMA seeded with an SMA of the first n values (matches backtest.ts)."""
    out: list[Optional[float]] = [None] * len(v)
    if len(v) < n:
        return out
    kf = 2 / (n + 1)
    prev = sum(v[:n]) / n
    out[n - 1] = prev
    for i in range(n, len(v)):
        prev = (v[i] - prev) * kf + prev
        out[i] = prev
    return out


def roc_series(v: list[float], n: int) -> list[Optional[float]]:
    out: list[Optional[float]] = [None] * len(v)
    for i in range(n, len(v)):
        base = v[i - n]
        if base != 0:
            out[i] = (v[i] - base) / base * 100
    return out


def _true_range(high: list[float], low: list[float], close: list[float]) -> list[float]:
    tr = [0.0] * len(close)
    for i in range(len(close)):
        if i == 0:
            tr[i] = high[i] - low[i]
        else:
            tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))
    return tr


def atr_series(high: list[float], low: list[float], close: list[float], n: int) -> list[Optional[float]]:
    length = len(close)
    out: list[Optional[float]] = [None] * length
    if length <= n:
        return out
    tr = _true_range(high, low, close)
    prev = sum(tr[1:n + 1]) / n
    out[n] = prev
    for i in range(n + 1, length):
        prev = (prev * (n - 1) + tr[i]) / n
        out[i] = prev
    return out


def adx_series(high: list[float], low: list[float], close: list[float], n: int) -> list[Optional[float]]:
    length = len(close)
    out: list[Optional[float]] = [None] * length
    if length <= 2 * n:
        return out
    tr = [0.0] * length
    plus_dm = [0.0] * length
    minus_dm = [0.0] * length
    for i in range(1, length):
        up = high[i] - high[i - 1]
        down = low[i - 1] - low[i]
        plus_dm[i] = up if (up > down and up > 0) else 0.0
        minus_dm[i] = down if (down > up and down > 0) else 0.0
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))

    tr_s = sum(tr[1:n + 1])
    p_s = sum(plus_dm[1:n + 1])
    m_s = sum(minus_dm[1:n + 1])
    dx = [None] * length

    def dx_at(i):
        p_di = 0.0 if tr_s == 0 else 100 * p_s / tr_s
        m_di = 0.0 if tr_s == 0 else 100 * m_s / tr_s
        denom = p_di + m_di
        dx[i] = 0.0 if denom == 0 else 100 * abs(p_di - m_di) / denom

    dx_at(n)
    for i in range(n + 1, length):
        tr_s = tr_s - tr_s / n + tr[i]
        p_s = p_s - p_s / n + plus_dm[i]
        m_s = m_s - m_s / n + minus_dm[i]
        dx_at(i)

    dx_sum = sum(dx[n:2 * n])  # n DX values, indices n..2n-1
    prev = dx_sum / n
    out[2 * n - 1] = prev
    for i in range(2 * n, length):
        prev = (prev * (n - 1) + dx[i]) / n
        out[i] = prev
    return out


def stoch_series(high: list[float], low: list[float], close: list[float], n: int) -> list[Optional[float]]:
    length = len(close)
    out: list[Optional[float]] = [None] * length
    for i in range(n - 1, length):
        hi = max(high[i - n + 1:i + 1])
        lo = min(low[i - n + 1:i + 1])
        rng = hi - lo
        out[i] = 0.0 if rng == 0 else (close[i] - lo) / rng * 100
    return out


def macd_series(close: list[float], fast: int, slow: int, signal: int):
    ef = ema_series(close, fast)
    es = ema_series(close, slow)
    line: list[Optional[float]] = [None if (ef[i] is None or es[i] is None) else ef[i] - es[i] for i in range(len(close))]
    starts_at = next((i for i, x in enumerate(line) if x is not None), -1)
    sig: list[Optional[float]] = [None] * len(close)
    if starts_at >= 0 and len(close) - starts_at >= signal:
        seg = [x for x in line[starts_at:]]  # all defined
        es2 = ema_series(seg, signal)
        for i, val in enumerate(es2):
            sig[starts_at + i] = val
    hist: list[Optional[float]] = [None if (line[i] is None or sig[i] is None) else line[i] - sig[i] for i in range(len(close))]
    return {"macd": line, "signal": sig, "hist": hist}


def stdev_series(v: list[float], n: int) -> list[Optional[float]]:
    length = len(v)
    out: list[Optional[float]] = [None] * length
    for i in range(n - 1, length):
        window = v[i - n + 1:i + 1]
        mean = sum(window) / n
        acc = sum((x - mean) ** 2 for x in window)
        out[i] = math.sqrt(acc / n)
    return out


def boll_series(close: list[float], n: int, k: float, band: str) -> list[Optional[float]]:
    mid = sma_series(close, n)
    if band == "mid":
        return mid
    sd = stdev_series(close, n)
    out: list[Optional[float]] = [None] * len(close)
    for i in range(len(close)):
        if mid[i] is None or sd[i] is None:
            continue
        out[i] = mid[i] + k * sd[i] if band == "upper" else mid[i] - k * sd[i]
    return out


def _operand_series(op, high: list[float], low: list[float], close: list[float]) -> list[Optional[float]]:
    kind = op.kind
    if kind == "price":
        return list(close)
    if kind == "const":
        return [op.value] * len(close)
    if kind == "sma":
        return sma_series(close, op.n)
    if kind == "ema":
        return ema_series(close, op.n)
    if kind == "rsi":
        return rsi_series(close, op.n)
    if kind == "roc":
        return roc_series(close, op.n)
    if kind == "atr":
        return atr_series(high, low, close, op.n)
    if kind == "adx":
        return adx_series(high, low, close, op.n)
    if kind == "stoch":
        return stoch_series(high, low, close, op.n)
    if kind == "high":
        return high_series(close, op.n)
    if kind == "low":
        return low_series(close, op.n)
    if kind == "prevhigh":
        return [None if i == 0 else high[i - 1] for i in range(len(close))]
    if kind == "prevlow":
        return [None if i == 0 else low[i - 1] for i in range(len(close))]
    if kind == "macd":
        return macd_series(close, op.fast, op.slow, op.signal)[op.line]
    if kind == "boll":
        return boll_series(close, op.n, op.k, op.band)
    return [None] * len(close)


def _eval_condition(cond, high: list[float], low: list[float], close: list[float]) -> list[bool]:
    length = len(close)
    L = _operand_series(cond.left, high, low, close)
    R = _operand_series(cond.right, high, low, close)
    out = [False] * length
    bars = max(2, min(100, cond.bars))
    op = cond.op

    for i in range(length):
        l, r = L[i], R[i]
        if op == "gt":
            if l is not None and r is not None:
                out[i] = l > r
        elif op == "lt":
            if l is not None and r is not None:
                out[i] = l < r
        elif op == "within_pct":
            if l is not None and r is not None:
                tol = abs(r) * cond.pct / 100
                out[i] = abs(l - r) <= tol
        elif op in ("cross_above", "cross_below"):
            lp = L[i - 1] if i > 0 else None
            rp = R[i - 1] if i > 0 else None
            if l is None or r is None or lp is None or rp is None:
                continue
            out[i] = (lp <= rp and l > r) if op == "cross_above" else (lp >= rp and l < r)
        elif op in ("rises_for", "falls_for"):
            if i < bars:
                continue
            ok = True
            for j in range(i - bars + 1, i + 1):
                a, b = L[j], L[j - 1]
                if a is None or b is None or (a <= b if op == "rises_for" else a >= b):
                    ok = False
                    break
            out[i] = ok
        elif op in ("stays_above", "stays_below"):
            if i < bars - 1:
                continue
            ok = True
            for j in range(i - bars + 1, i + 1):
                a, b = L[j], R[j]
                if a is None or b is None or (a <= b if op == "stays_above" else a >= b):
                    ok = False
                    break
            out[i] = ok
    return out


def _eval_node(node, high: list[float], low: list[float], close: list[float]) -> list[bool]:
    # A Group has `conds`; a Condition has `left`.
    conds = getattr(node, "conds", None)
    if conds is None:
        return _eval_condition(node, high, low, close)
    evals = [_eval_condition(c, high, low, close) for c in conds]
    length = len(close)
    if not evals:
        return [False] * length
    if node.op == "all":
        return [all(e[i] for e in evals) for i in range(length)]
    return [any(e[i] for e in evals) for i in range(length)]


def _rules_positions(candles: list[dict], dsl) -> list[int]:
    high = [c["high"] for c in candles]
    low = [c["low"] for c in candles]
    close = [c["close"] for c in candles]
    pos = [0] * len(close)
    entry_evals = [_eval_node(n, high, low, close) for n in dsl.entry]
    exit_evals = [_eval_node(n, high, low, close) for n in dsl.exit]
    risk = dsl.risk
    in_pos = 0
    entry_price = 0.0
    peak = 0.0
    held_bars = 0

    for i in range(len(close)):
        entry = bool(entry_evals) and all(e[i] for e in entry_evals)
        rule_exit = bool(exit_evals) and any(e[i] for e in exit_evals)

        if in_pos == 1:
            peak = max(peak, close[i])
            held_bars += 1
            risk_exit = False
            if risk is not None:
                if risk.stopLossPct is not None and close[i] <= entry_price * (1 - risk.stopLossPct / 100):
                    risk_exit = True
                elif risk.takeProfitPct is not None and close[i] >= entry_price * (1 + risk.takeProfitPct / 100):
                    risk_exit = True
                elif risk.trailPct is not None and close[i] <= peak * (1 - risk.trailPct / 100):
                    risk_exit = True
                elif risk.maxHoldBars is not None and held_bars >= risk.maxHoldBars:
                    risk_exit = True
            if risk_exit or rule_exit:
                in_pos = 0
        elif entry:
            in_pos = 1
            entry_price = close[i]
            peak = close[i]
            held_bars = 0
        pos[i] = in_pos
    return pos


def positions(candles: list[dict], req: BacktestRequest) -> list[int]:
    close = [c["close"] for c in candles]
    pos = [0] * len(close)

    if req.mode == "rules" and req.rules is not None:
        return _rules_positions(candles, req.rules)

    if req.template == "ma":
        f = sma_series(close, req.fast)
        s = sma_series(close, req.slow)
        for i in range(len(close)):
            pos[i] = 1 if (s[i] is not None and f[i] is not None and f[i] > s[i]) else 0
    elif req.template == "rsi":
        r = rsi_series(close, req.fast)
        in_pos = 0
        for i in range(len(close)):
            if r[i] is not None:
                if in_pos == 0 and r[i] < 30:
                    in_pos = 1
                elif in_pos == 1 and r[i] > 55:
                    in_pos = 0
            pos[i] = in_pos
    else:  # breakout — Donchian channel, N = slow
        N = req.slow
        in_pos = 0
        for i in range(len(close)):
            if i >= N:
                hi = max(close[i - N:i])
                lo = min(close[i - N:i])
                if in_pos == 0 and close[i] > hi:
                    in_pos = 1
                elif in_pos == 1 and close[i] < lo:
                    in_pos = 0
            pos[i] = in_pos
    return pos


def run_backtest(candles: list[dict], req: BacktestRequest) -> dict:
    close = [c["close"] for c in candles]
    pos = positions(candles, req)
    cost = req.costBps / 10000.0

    equity = [{"time": candles[0]["time"], "value": 100.0}]
    daily_rets: list[float] = []
    trades: list[dict] = []
    value = 100.0
    days_in = 0

    entry_index = -1
    entry_price = 0.0

    for i in range(1, len(close)):
        held = pos[i - 1]  # yesterday's position earns today's return
        changed = pos[i] != pos[i - 1]
        ret = (close[i] / close[i - 1] - 1) if held == 1 else 0.0
        if changed:
            ret -= cost

        value *= 1 + ret
        daily_rets.append(ret)
        if held == 1:
            days_in += 1
        equity.append({"time": candles[i]["time"], "value": value})

        if pos[i] == 1 and pos[i - 1] == 0:
            entry_index = i
            entry_price = close[i]
        elif pos[i] == 0 and pos[i - 1] == 1 and entry_index >= 0:
            gross = close[i] / entry_price - 1 - 2 * cost
            trades.append(_trade(candles, entry_index, i, entry_price, close[i], gross, False))
            entry_index = -1

    if entry_index >= 0:
        last = len(close) - 1
        gross = close[last] / entry_price - 1 - cost
        trades.append(_trade(candles, entry_index, last, entry_price, close[last], gross, True))

    n = len(close)
    ppy = _periods_per_year(req.interval)
    years = n / ppy
    total_return = value / 100 - 1
    cagr = math.pow(value / 100, 1 / years) - 1 if years > 0 else 0.0

    mean = sum(daily_rets) / len(daily_rets) if daily_rets else 0.0
    variance = sum((r - mean) ** 2 for r in daily_rets) / len(daily_rets) if daily_rets else 0.0
    sharpe = (mean / math.sqrt(variance)) * math.sqrt(ppy) if variance > 0 else 0.0

    peak = float("-inf")
    max_dd = 0.0
    for p in equity:
        if p["value"] > peak:
            peak = p["value"]
        dd = p["value"] / peak - 1
        if dd < max_dd:
            max_dd = dd

    wins = sum(1 for t in trades if t["retPct"] > 0)

    metrics = {
        "cagr": cagr * 100,
        "sharpe": sharpe,
        "maxDD": max_dd * 100,
        "winRate": (wins / len(trades) * 100) if trades else 0.0,
        "trades": len(trades),
        "exposure": (days_in / (n - 1) * 100) if n > 1 else 0.0,
        "totalReturn": total_return * 100,
    }
    return {"equity": equity, "trades": trades, "metrics": metrics}


def _trade(candles, entry_i, exit_i, entry_price, exit_price, gross, is_open) -> dict:
    return {
        "entryIndex": entry_i,
        "exitIndex": exit_i,
        "entryTime": candles[entry_i]["time"],
        "exitTime": candles[exit_i]["time"],
        "entryPrice": _round(entry_price),
        "exitPrice": _round(exit_price),
        "retPct": gross * 100,
        "bars": exit_i - entry_i,
        "open": is_open,
    }


_OP_WORDS = {"gt": "is above", "lt": "is below", "cross_above": "crosses above", "cross_below": "crosses below"}


def _operand_label(op) -> str:
    k = op.kind
    if k == "price":
        return "price"
    if k == "const":
        return f"{op.value:g}"
    if k == "sma":
        return f"{op.n}-day average"
    if k == "ema":
        return f"{op.n}-day EMA"
    if k == "rsi":
        return f"RSI({op.n})"
    if k == "roc":
        return f"{op.n}-day % change"
    if k == "atr":
        return f"ATR({op.n})"
    if k == "adx":
        return f"ADX({op.n})"
    if k == "stoch":
        return f"Stochastic %K({op.n})"
    if k == "high":
        return f"{op.n}-day high"
    if k == "low":
        return f"{op.n}-day low"
    if k == "prevhigh":
        return "yesterday's high"
    if k == "prevlow":
        return "yesterday's low"
    if k == "macd":
        which = "line" if op.line == "macd" else ("signal" if op.line == "signal" else "histogram")
        return f"MACD {which}({op.fast}/{op.slow}/{op.signal})"
    if k == "boll":
        return f"{op.n}-day Bollinger {op.band} ({op.k:g}σ)"
    return "?"


def _condition_label(c) -> str:
    op = c.op
    if op == "rises_for":
        return f"{_operand_label(c.left)} rises for {c.bars} bars"
    if op == "falls_for":
        return f"{_operand_label(c.left)} falls for {c.bars} bars"
    if op == "stays_above":
        return f"{_operand_label(c.left)} stays above {_operand_label(c.right)} for {c.bars} bars"
    if op == "stays_below":
        return f"{_operand_label(c.left)} stays below {_operand_label(c.right)} for {c.bars} bars"
    if op == "within_pct":
        return f"{_operand_label(c.left)} is within {c.pct:g}% of {_operand_label(c.right)}"
    return f"{_operand_label(c.left)} {_OP_WORDS[op]} {_operand_label(c.right)}"


def _node_label(n) -> str:
    conds = getattr(n, "conds", None)
    if conds is None:
        return _condition_label(n)
    join = " AND " if n.op == "all" else " OR "
    return "(" + join.join(_condition_label(c) for c in conds) + ")"


def _risk_label(r) -> str:
    if r is None:
        return ""
    parts = []
    if r.stopLossPct is not None:
        parts.append(f"stop-loss {r.stopLossPct:g}%")
    if r.takeProfitPct is not None:
        parts.append(f"take-profit {r.takeProfitPct:g}%")
    if r.trailPct is not None:
        parts.append(f"{r.trailPct:g}% trailing stop")
    if r.maxHoldBars is not None:
        parts.append(f"max hold {r.maxHoldBars} bars")
    return f" Risk exits: {', '.join(parts)}." if parts else ""


def describe_config(req: BacktestRequest, symbol: str, bars: int) -> str:
    if req.mode == "rules" and req.rules is not None:
        entry = " AND ".join(_node_label(n) for n in req.rules.entry)
        exit_ = " OR ".join(_node_label(n) for n in req.rules.exit)
        risk = _risk_label(req.rules.risk)
        return f"Buy {symbol} when {entry}. Sell when {exit_}.{risk} Tested over the last {bars} trading days."
    tail = f" Tested over {bars} trading days, with {req.costBps:g} bps of round-trip cost."
    if req.template == "ma":
        return (f"Buy {symbol} when its {req.fast}-day average rises above the {req.slow}-day "
                f"average, and move to cash when it falls back below.{tail}")
    if req.template == "rsi":
        return (f"Buy {symbol} when RSI({req.fast}) drops below 30 (oversold), and sell when it "
                f"climbs back above 55.{tail}")
    return (f"Go long {symbol} when price breaks above its {req.slow}-day high, and exit when it "
            f"breaks the {req.slow}-day low.{tail}")
