"""Heuristic strategy critique — mirrors reviewBacktest() in src/lib/backtest.ts.

Phase 2b will replace this with an LLM critique grounded in out-of-sample tests,
but the honest framing stays: this is one in-sample path, not a promise.
"""
from __future__ import annotations

from .schemas import BacktestRequest


def review_backtest(m: dict, req: BacktestRequest) -> list[dict]:
    out: list[dict] = []

    if m["trades"] == 0:
        out.append({
            "tone": "warn",
            "title": "No trades triggered",
            "body": "This rule never fired in the window. Try a shorter average, a different instrument, or a longer history.",
        })
        return out

    sharpe = m["sharpe"]
    if sharpe >= 1:
        out.append({"tone": "good", "title": "Risk-adjusted return looks solid",
                    "body": f"A Sharpe near {sharpe:.2f} is respectable — but confirm it survives real costs and out-of-sample data."})
    elif sharpe >= 0.4:
        out.append({"tone": "warn", "title": "Middling risk-adjusted return",
                    "body": f"Sharpe {sharpe:.2f} is modest. Look for a cleaner entry filter or steadier position sizing before trusting it."})
    else:
        out.append({"tone": "bad", "title": "The edge is weak",
                    "body": f"Sharpe {sharpe:.2f} is hard to distinguish from noise. This configuration probably has no durable edge."})

    if m["maxDD"] <= -25:
        out.append({"tone": "warn", "title": "Drawdown is punishing",
                    "body": f"A {m['maxDD']:.0f}% drawdown is very hard to sit through. Add volatility targeting or cut exposure when volatility spikes."})

    if m["trades"] > 25:
        out.append({"tone": "warn", "title": "High turnover",
                    "body": f"{m['trades']} trades means costs and slippage dominate. Re-run with higher fees and consider longer holds."})

    if req.mode == "rules":
        out.append({"tone": "info", "title": "It's your rule — now stress it",
                    "body": "Custom rules are easy to overfit to one chart. Re-run on a different instrument and a longer window; an edge that only shows up here probably isn't real."})
    elif req.template == "rsi":
        out.append({"tone": "info", "title": "Mean-reversion needs a regime filter",
                    "body": "RSI dip-buying bleeds in strong downtrends. Gate it with a longer-term trend filter so you only fade inside a range."})
    elif req.template == "breakout":
        out.append({"tone": "info", "title": "Breakouts whipsaw in ranges",
                    "body": "Require a volatility expansion (or an ATR-based stop) so you skip false breaks in quiet markets."})
    else:
        out.append({"tone": "info", "title": "Trend crossovers lag turns",
                    "body": "MA crossovers give back profit at reversals. A volatility filter or faster exit can soften the give-back."})

    if 0 < m["winRate"] < 45 and m["cagr"] > 0:
        out.append({"tone": "info", "title": "Don't over-fix the win rate",
                    "body": f"A {m['winRate']:.0f}% win rate is normal for trend systems — the fat right tail carries returns. Tightening exits often makes it worse."})

    out.append({"tone": "warn", "title": "Validate before you trust it",
                "body": "These are in-sample results on one price path. Real confidence needs walk-forward, purged K-fold CV, and a Deflated Sharpe check."})

    return out[:5]
