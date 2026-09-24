"""Request/response models — the validated boundary for the backtest engine.

Security: the API only ever accepts this whitelisted, bounded schema. There is no
path by which model- or user-supplied *code* reaches an interpreter. When Phase 2's
natural-language parser lands, it must emit one of these validated objects — never
executable code.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Template = Literal["ma", "rsi", "breakout"]
Tone = Literal["good", "warn", "bad", "info"]
# Backtest timeframe. "1d" uses cached EOD history; the rest use live intraday bars.
Interval = Literal["1m", "5m", "15m", "30m", "60m", "1d"]

# ---- Custom-strategy DSL (whitelisted, bounded — never executable code) ----
OperandKind = Literal[
    "price", "const", "sma", "ema", "rsi", "roc", "atr", "adx", "stoch",
    "high", "low", "prevhigh", "prevlow", "macd", "boll",
]
Op = Literal[
    "gt", "lt", "cross_above", "cross_below",
    "rises_for", "falls_for", "stays_above", "stays_below", "within_pct",
]
MacdLine = Literal["macd", "signal", "hist"]
BollBand = Literal["upper", "lower", "mid"]

_BARS_OPS = {"rises_for", "falls_for", "stays_above", "stays_below"}


class Operand(BaseModel):
    kind: OperandKind
    n: int = Field(14, ge=2, le=400)  # lookback for sma/ema/rsi/roc/atr/adx/stoch/high/low/boll
    value: float = Field(0, ge=-1e9, le=1e9)  # threshold for const
    # macd params
    fast: int = Field(12, ge=2, le=400)
    slow: int = Field(26, ge=2, le=400)
    signal: int = Field(9, ge=2, le=400)
    line: MacdLine = "macd"
    # bollinger params
    k: float = Field(2.0, ge=0.5, le=5)
    band: BollBand = "upper"

    @model_validator(mode="after")
    def _check_macd(self):
        if self.kind == "macd" and not (self.fast < self.slow):
            raise ValueError("MACD fast length must be below the slow length")
        return self


class Condition(BaseModel):
    left: Operand
    op: Op
    right: Operand
    bars: int = Field(3, ge=2, le=100)  # for rises_for/falls_for/stays_above/stays_below
    pct: float = Field(1.0, ge=0, le=100)  # for within_pct


class Group(BaseModel):
    op: Literal["all", "any"]
    conds: list[Condition] = Field(..., min_length=2, max_length=6)


# A node is a single condition or one level of grouping.
Node = Condition | Group


class RiskExits(BaseModel):
    stopLossPct: Optional[float] = Field(None, gt=0, le=100)
    takeProfitPct: Optional[float] = Field(None, gt=0, le=100)
    trailPct: Optional[float] = Field(None, gt=0, le=100)
    maxHoldBars: Optional[int] = Field(None, ge=1, le=2000)


class StrategyDSL(BaseModel):
    entry: list[Node] = Field(default_factory=list, max_length=6)
    exit: list[Node] = Field(default_factory=list, max_length=6)
    risk: Optional[RiskExits] = None


class BacktestRequest(BaseModel):
    template: Template = "ma"
    symbol: str = Field(..., max_length=32)
    fast: int = Field(20, ge=2, le=400)
    slow: int = Field(50, ge=3, le=400)
    costBps: float = Field(20, ge=0, le=200)
    lookback: int = Field(250, ge=30, le=2500)
    interval: Interval = "1d"  # "1d" = cached EOD; intraday timeframes pull live bars
    mode: Literal["template", "rules"] = "template"
    rules: Optional[StrategyDSL] = None

    @model_validator(mode="after")
    def _require_rules(self):
        if self.mode == "rules":
            if self.rules is None or not self.rules.entry or not self.rules.exit:
                raise ValueError("rules mode needs at least one entry and one exit condition")
        return self


class Candle(BaseModel):
    # 'yyyy-mm-dd' for daily bars; a unix timestamp (IST wall-clock) for intraday.
    time: str | int
    open: float
    high: float
    low: float
    close: float


class EquityPoint(BaseModel):
    time: str | int
    value: float


class Trade(BaseModel):
    entryIndex: int
    exitIndex: int
    entryTime: str | int
    exitTime: str | int
    entryPrice: float
    exitPrice: float
    retPct: float
    bars: int
    open: bool


class Metrics(BaseModel):
    cagr: float
    sharpe: float
    maxDD: float
    winRate: float
    trades: int
    exposure: float
    totalReturn: float


class Review(BaseModel):
    tone: Tone
    title: str
    body: str


class BacktestResponse(BaseModel):
    candles: list[Candle]
    equity: list[EquityPoint]
    trades: list[Trade]
    metrics: Metrics
    reviews: list[Review]
    source: str
    symbol: str
    ticker: str
    interval: str
    intraday: bool
    start: str | int
    end: str | int


class Instrument(BaseModel):
    symbol: str
    ticker: str


class SearchResult(BaseModel):
    symbol: str
    name: str
    kind: Literal["index", "stock"]


class Quote(BaseModel):
    ticker: str
    price: float
    prevClose: float
    change: float
    changePct: float


class Bar(BaseModel):
    # time is a 'yyyy-mm-dd' string for daily bars, or a unix timestamp for intraday.
    time: str | int
    open: float
    high: float
    low: float
    close: float


class Bars(BaseModel):
    ticker: str
    interval: str
    intraday: bool
    bars: list[Bar]


class DhanCreds(BaseModel):
    """Written once from Settings, then never returned raw — see dhan.status()."""
    clientId: str = Field(..., min_length=1, max_length=64)
    accessToken: str = Field(..., min_length=8, max_length=4096)
