"""Out-of-sample backtest — split training and test windows, run both.

Returns per-window metrics plus a stability verdict. This is the single highest-
trust signal a paying user checks before crediting any strategy.
"""
from __future__ import annotations

from .schemas import BacktestRequest
from .engine import run_backtest


def run_backtest_oos(candles: list[dict], req: BacktestRequest) -> dict:
    """Run the same config on train and test halves, return both sets of metrics."""
    n = len(candles)
    if n < 60:
        raise ValueError("Need at least 60 bars for an OOS split")

    split = int(n * 0.7)
    train_candles = candles[:split]
    test_candles = candles[split:]

    train_req = _copy_request(req, lookback=len(train_candles))
    test_req = _copy_request(req, lookback=len(test_candles))

    train_res = run_backtest(train_candles, train_req)
    test_res = run_backtest(test_candles, test_req)

    train_m = train_res["metrics"]
    test_m = test_res["metrics"]

    stability = _assess_stability(train_m, test_m)

    return {
        "train": {
            "metrics": train_m,
            "trades": train_res["trades"],
            "equity": train_res["equity"],
            "bars": len(train_candles),
        },
        "test": {
            "metrics": test_m,
            "trades": test_res["trades"],
            "equity": test_res["equity"],
            "bars": len(test_candles),
        },
        "stability": stability,
        "split": split,
        "total_bars": n,
    }


def _copy_request(req: BacktestRequest, lookback: int) -> BacktestRequest:
    """Return a copy with a new lookback value."""
    # Build a fresh dict from the original, override lookback, reconstruct.
    data = req.dict() if hasattr(req, "dict") else req.model_dump()
    data["lookback"] = lookback
    return BacktestRequest(**data)


def _assess_stability(train: dict, test: dict) -> dict:
    """Return a human-readable stability verdict."""
    issues: list[str] = []

    # CAGR direction
    if train["cagr"] > 5 and test["cagr"] < -5:
        issues.append("CAGR reversed sign between train and test")
    elif abs(train["cagr"] - test["cagr"]) > 15:
        issues.append("CAGR drifted more than 15pp between train and test")

    # Sharpe
    if train["sharpe"] > 0.5 and test["sharpe"] < 0:
        issues.append("Sharpe went negative in test")
    elif abs(train["sharpe"] - test["sharpe"]) > 1.0:
        issues.append("Sharpe drifted more than 1.0 between train and test")

    # MaxDD
    if abs(train["maxDD"] - test["maxDD"]) > 15:
        issues.append(f"Max drawdown drifted {abs(train['maxDD']-test['maxDD']):.0f}pp")

    # Win rate
    if abs(train["winRate"] - test["winRate"]) > 20:
        issues.append(f"Win rate drifted {abs(train['winRate']-test['winRate']):.0f}pp")

    # Trade count sanity
    if test["trades"] == 0 and train["trades"] > 0:
        issues.append("No trades in test window — likely overfitted")
    elif train["trades"] > 0 and test["trades"] / train["trades"] < 0.2:
        issues.append("Test trade count is very low compared to train")

    if not issues:
        return {
            "grade": "stable",
            "label": "Stable across train/test split",
            "details": "Both windows show similar risk-adjusted returns.",
        }

    severity = "critical" if len(issues) >= 3 else ("warning" if len(issues) >= 2 else "mild")
    return {
        "grade": severity,
        "label": f"{severity.title()} stability concerns",
        "details": "; ".join(issues),
    }
