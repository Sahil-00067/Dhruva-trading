"""Sweep & walk-forward helpers for the backtest engine.

These are pure functions — they take candles and requests, return dicts.
Endpoints in main.py wire them to the HTTP layer.
"""
from __future__ import annotations

from typing import Any

from .engine import run_backtest
from .schemas import BacktestRequest


def sweep(
    candles: list[dict],
    base_req: BacktestRequest,
    fast_range: tuple[int, int, int] | None = None,
    slow_range: tuple[int, int, int] | None = None,
) -> dict:
    """Grid-sweep over fast/slow parameters, return a matrix of metrics.

    fast_range / slow_range are (start, stop, step) like Python range().
    Returns a dict keyed by (fast, slow) → metrics, plus a summary.
    """
    fast_start, fast_stop, fast_step = fast_range or (5, 50, 5)
    slow_start, slow_stop, slow_step = slow_range or (20, 200, 20)

    matrix: list[dict] = []
    best_key: str | None = None
    best_sharpe: float = float("-inf")

    for fast in range(fast_start, fast_stop + 1, fast_step):
        for slow in range(slow_start, slow_stop + 1, slow_step):
            if slow <= fast:
                continue
            data = base_req.dict() if hasattr(base_req, "dict") else base_req.model_dump()
            data["fast"] = fast
            data["slow"] = slow
            sweep_req = BacktestRequest(**data)
            res = run_backtest(candles, sweep_req)
            m = res["metrics"]
            key = f"f{fast}_s{slow}"
            matrix.append({
                "key": key,
                "fast": fast,
                "slow": slow,
                "metrics": m,
            })
            if m["sharpe"] > best_sharpe:
                best_sharpe = m["sharpe"]
                best_key = key

    return {
        "matrix": matrix,
        "best_key": best_key,
        "best_metrics": next((x["metrics"] for x in matrix if x["key"] == best_key), None),
        "params": {
            "fast_range": [fast_start, fast_stop, fast_step],
            "slow_range": [slow_start, slow_stop, slow_step],
        },
    }


def walk_forward(candles: list[dict], req: BacktestRequest, window: int = 100, step: int = 20) -> dict:
    """Walk-forward analysis: run on rolling windows, return per-window metrics.

    This simulates how a strategy would perform if re-optimised every `step` bars
    on a `window`-bar training set and then tested on the next `step` bars.
    """
    n = len(candles)
    if n < window + step:
        raise ValueError(f"Need at least {window + step} bars for walk-forward")

    windows: list[dict] = []
    for start in range(0, n - window, step):
        train_candles = candles[start : start + window]
        test_candles = candles[start + window : start + window + step]
        if len(test_candles) < 5:
            break

        train_req = _copy(req, lookback=len(train_candles))
        test_req = _copy(req, lookback=len(test_candles))

        train_res = run_backtest(train_candles, train_req)
        test_res = run_backtest(test_candles, test_req)

        windows.append({
            "train_start_index": start,
            "train_end_index": start + window,
            "test_start_index": start + window,
            "test_end_index": start + window + len(test_candles),
            "train_metrics": train_res["metrics"],
            "test_metrics": test_res["metrics"],
        })

    if not windows:
        raise ValueError("Walk-forward produced no windows")

    # Aggregate
    all_test_returns = [w["test_metrics"]["totalReturn"] for w in windows]
    all_train_returns = [w["train_metrics"]["totalReturn"] for w in windows]
    all_test_sharpes = [w["test_metrics"]["sharpe"] for w in windows if w["test_metrics"]["trades"] > 0]

    win_count = sum(1 for r in all_test_returns if r > 0)
    overall_win_rate = (win_count / len(all_test_returns)) * 100 if all_test_returns else 0
    avg_test_return = sum(all_test_returns) / len(all_test_returns) if all_test_returns else 0
    avg_train_return = sum(all_train_returns) / len(all_train_returns) if all_train_returns else 0

    return {
        "windows": windows,
        "summary": {
            "num_windows": len(windows),
            "avg_test_return": avg_test_return,
            "avg_train_return": avg_train_return,
            "overall_win_rate": overall_win_rate,
            "avg_test_sharpe": sum(all_test_sharpes) / len(all_test_sharpes) if all_test_sharpes else 0,
        },
    }


def _copy(req: BacktestRequest, lookback: int) -> BacktestRequest:
    data = req.dict() if hasattr(req, "dict") else req.model_dump()
    data["lookback"] = lookback
    return BacktestRequest(**data)
