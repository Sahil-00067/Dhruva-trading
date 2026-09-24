# Strategy Catalog — Research Synthesis (India / NSE-BSE)

> **Honesty first.** None of these guarantee profit. Each is a documented *edge* that works in some regimes and fails in others, and every one is sensitive to transaction costs — which in India (STT, stamp duty, GST, impact, circuit limits, intraday-only cash shorting) are often the deciding factor. This catalog is the raw material for the app's strategy library; the backtester's job is to test whether any of these actually survive *out-of-sample* on real Indian data with real costs.
>
> *Sourcing note:* live web search was unavailable during research, so this is grounded in established quant literature (model knowledge to Jan 2026) plus fetched pages from AQR, Quantpedia, Hudson & Thames, davidhbailey.com, QuantConnect and Zerodha. URLs in Sources are canonical locations; those not fetch-verified are marked.

**How to read each entry:** *Mechanism* · *Works / Fails* · *India note* · *Complexity*.

---

## A. Trend & Momentum

- **Time-Series (Absolute) Momentum** — Long if own past ~12-mo return > 0, else flat/short; size inverse to volatility; rebalance monthly. *Works:* sustained trends, "crisis alpha"; ~1.3 Sharpe diversified across 58 futures back to 1880. *Fails:* choppy/V-shaped reversals → whipsaw. *India:* best on NIFTY/BANKNIFTY & liquid stock **futures** (low STT, shortable, deep liquidity). *Easy.*
- **Cross-Sectional Momentum (12–1)** — Rank universe by past 12-mo return skipping last month; long winners / short losers, hold 1–6 mo. *Works:* calm trending markets (~1%/mo spread). *Fails:* sharp market rebounds (crash risk). *India:* positive but turnover-heavy → STT/impact drag; practical vehicle = long-only tilt or **Nifty200 Momentum 30** ETF. *Medium.*
- **Dual Momentum (Antonacci GEM)** — Relative momentum picks stronger equity sleeve; absolute momentum switches to bonds/cash when trend negative. *Works:* raises return, cuts drawdown; sidesteps bear markets. *Fails:* fast reversals around monthly signal. *India:* NIFTY/global-equity ETF vs gilt fund; very low turnover. *Very easy.*
- **Managed Futures / CTA Trend** — TSM across equity/bond/FX/commodity futures, vol-targeted. *Works:* century of equity-uncorrelated returns, long-vol crisis hedge. *Fails:* range-bound low-dispersion years; crowding. *India:* MCX + index/bond futures, but narrower universe, CTT. *Hard.*
- **Donchian Breakout / Turtle** — Buy N-day high / sell N-day low (e.g. 20/55); ATR stops & sizing. *Works:* mechanical trend capture. *Fails:* false breakouts in ranges (low hit-rate, fat right tail). *India:* circuit freezes can block stop exits; F&O ban-period blocks entries. *Easy.*
- **Volatility-Scaled / Risk-Managed Momentum** — Scale exposure by inverse realized variance to a constant vol target. *Works:* ~doubles Sharpe, cuts crash kurtosis vs plain momentum. *Fails:* de-risks into a rally if vol spikes without reversal. *India:* near-essential given BANKNIFTY vol clustering. *Low-Medium.*
- **Momentum Crash Management** — Forecast momentum's own beta/vol; cut/hedge in post-crash "panic" rebound states. *Works:* avoids the rare severe left-tail losses that define momentum crashes. *India:* crashes = sharp rebounds after selloffs (e.g. post-Mar-2020). *Medium.*
- **Refinements** — 52-week-high proximity (George–Hwang, low turnover); residual/idiosyncratic momentum (Blitz–Huij–Martens, lower crash risk, needs an India factor model); factor momentum.

## B. Mean-Reversion & Statistical Arbitrage

- **Cointegration Pairs (Engle-Granger / Johansen)** — Trade z-score of a stationary spread between cointegrated names. *Works:* stable-correlation, range-bound regimes. *Fails:* structural breaks; edge decayed post-2002 (crowding/HFT). *India:* same-sector F&O large-caps (HDFCBANK/ICICIBANK, TCS/INFY); short leg via **futures** (cash shorting intraday-only); circuit bands can trap the spread. *Medium.*
- **OU Mean-Reversion: half-life & optimal thresholds** — Model spread as Ornstein-Uhlenbeck; half-life = ln2/θ; set bands from θ,σ (Bertram/Leung-Li optimal levels). *Works:* filters fast-reverting (tradable) vs trending (untradable) spreads. *India:* half-life filter is critical — reject pairs reverting slower than round-trip STT+impact can recover. *Medium.*
- **PCA / Factor Stat-Arb Baskets** — Trade mean-reversion of each stock's idiosyncratic residual ("s-score"); market/sector-neutral book. *Works:* Avellaneda-Lee high Sharpe 1997–2007. *Fails:* sharp decay post-2007 (crowding), crisis factor blowups. *India:* NIFTY100/200; residual shorting needs single-stock futures. *Hard.*
- **Kalman-Filter Dynamic Hedge Ratio** — Re-estimate β as a latent state each bar; adaptive spread, no fixed lookback. *Works:* slowly drifting relationships. *Fails:* abrupt breaks; Q/R tuning risk. *India:* bank pairs whose beta drifts with rate cycle. *Medium-Hard.*
- **ETF / Index Arbitrage** — ETF vs NAV/basket, or index futures vs cash basket (cash-and-carry); premium mean-reverts. *Works:* high-capacity; premiums widen in stress. *Fails:* creation halts, illiquid basket. *India:* NIFTY/BANKNIFTY futures world-class liquid → clean index-arb, but STT+stamp+financing widen the no-arb band. *Hard.*
- **Cross-Sectional Short-Term Reversal** — Long past-week/month losers, short winners (over-reaction/liquidity provision). *Works:* best when volatility/VIX high (Nagel). *Fails:* near-zero net normally; brutal turnover. *India:* largely uninvestable at retail cost (STT, intraday-only shorting). *Easy-Medium (but costly).*
- **Other** — Copula pairs (nonlinear dependence beyond cointegration); index-reconstitution reversion around NIFTY/SENSEX rebalances (forced-flow, India-relevant).

## C. Factor Investing

- **Value (HML)** — long cheap / short expensive. Long-run premium; long droughts (2010s), value traps. India: weak/regime-dependent post-2000.
- **Size (SMB)** — small > large. Largely a micro-cap/liquidity artifact in India.
- **Quality / Profitability (RMW; "Quality Minus Junk")** — most robust, defensive. India: strong; **Nifty200 Quality 30**.
- **Investment (CMA)** — low-asset-growth firms. Weakest/least stable; thin India evidence.
- **Momentum factor (WML)** — among the most robust Indian premia (Agarwalla-Jacob-Varma).
- **Low-Volatility anomaly** — low-beta earns higher risk-adjusted returns (Betting-Against-Beta). India: **Nifty Low Volatility 50 / Alpha Low-Vol 30**.
- **Multi-factor blends** — combine low-correlated factors; integrated bottom-up scoring beats mixing sleeves. Watch factor-timing/overfitting/crowding.
- **India factor data:** free IIM-Ahmedabad Fama-French-Momentum dataset (MKT/SMB/HML/WML, 1993–2025) — use to validate factor strategies.

## D. Portfolio Construction & Position Sizing

- **Mean-Variance (Markowitz)** — maximize return/variance. *Caveat:* unstable — small input errors → concentrated error-maximizing weights; 1/N often beats it OOS. Worse in India (fewer liquid names, noisy estimates).
- **Risk Parity** — equalize each asset's risk contribution; no return forecasts. Stable, diversified; rate-shock fragile; levers low-vol assets.
- **Hierarchical Risk Parity (López de Prado)** — cluster assets, recursive bisection; robust, better OOS than MV; good for noisy correlated equity universes.
- **Black-Litterman** — Bayesian blend of market equilibrium + investor views; stable weights; needs view calibration.
- **Kelly / Fractional Kelly** — bet fraction maximizing long-run log-growth; full Kelly wildly volatile → use ½/¼ Kelly, estimate edge conservatively.
- **Volatility Targeting** — scale exposure inverse to forecast vol for constant risk; improves Sharpe/tail given vol clustering; adds turnover.

## E. Machine Learning Approaches

- **Meta-labeling + Triple-Barrier (López de Prado)** — triple-barrier labels events by which barrier (profit/stop/time) hits first; a secondary model *sizes/filters* a primary model's *side* call. Helps precision; overfits on small samples / overlapping-label leakage (needs sample weighting + purging).
- **Feature engineering** — fractional differentiation (stationary but memory-preserving), information-driven bars, structural-break/entropy features. Fixes non-stationarity; risks feature-explosion multiple-testing.
- **Tree ensembles / gradient boosting** — nonlinear feature→return maps; strong on tabular cross-sectional panels (Gu-Kelly-Xiu). Low signal-to-noise → needs purged CV, regularization, deflated Sharpe.
- **Reinforcement learning** — learns execution/allocation policy net of impact/risk. Powerful for execution; sim-to-real gap, unstable, sample-hungry; easy to overstate.
- **NLP / sentiment (FinBERT)** — sentiment from news/filings/transcripts. Orthogonal short-horizon alpha; look-ahead via publication timestamps, fast decay, crowding.

## F. Backtesting Rigor — the rules the engine enforces

These are non-negotiable if the app is to be honest:

| Pitfall | Defense the engine implements |
|---|---|
| **Look-ahead bias** | Point-in-time data; lag every input; signal at *t* fills at *t+1* (never same-bar close). |
| **Survivorship bias** | PIT constituent universes incl. delisted tickers + delisting returns. |
| **Overfitting / multiple testing** | **Deflated Sharpe Ratio** (adjusts for trial count, skew, kurtosis, length) + **PBO via CSCV**. |
| **Data snooping** | Track & report trial count; haircut Sharpe (White's Reality Check / BH). |
| **CV leakage** | **Purged & embargoed K-fold** (and combinatorial purged CV) — not vanilla CV. |
| **Single-path overfit** | Walk-forward as sanity check; CPCV for a distribution of OOS paths; never tune on OOS. |
| **Phantom profit** | Commissions + spread + slippage + nonlinear (√-size) impact + volume caps + delayed fills. |
| **Regime change** | Stationary-memory features, rolling refit, regime detection, out-of-regime stress tests. |

## G. Indian Cost Model (encode per trade — rates as of Sept 2026, verify before relying)

- **Brokerage (Zerodha ref):** delivery ₹0; intraday & futures 0.03% or ₹20/order (lower); options flat ₹20/order.
- **STT/CTT:** delivery 0.1% buy+sell; intraday 0.025% sell; futures 0.05% sell; options 0.15% sell (premium) — hiked Apr 1 2026.
- **Exchange txn (NSE):** delivery/intraday 0.00307%; futures 0.00183%; options 0.03553%.
- **SEBI fee:** ₹10/crore. **Stamp duty (buy only):** delivery 0.015% / intraday 0.003% / futures 0.002% / options 0.003%.
- **GST:** 18% on (brokerage + txn + SEBI). **DP charge:** ~₹13.5+GST per scrip on delivery sell.

---

## Recommended default strategy

**Volatility-targeted 12–1 Time-Series Momentum on NIFTY (long/flat).** Long when trailing 12-month return is positive, otherwise in cash; position scaled to a constant volatility target. Chosen because it is: among the **most robust documented edges**, **simple & low-turnover** (monthly), **long/flat** (sidesteps India's shorting constraints), has **built-in downside control**, and runs on the most liquid Indian instrument. It is the honest "sensible baseline," not a promise.

*Alternatives:* Dual Momentum (GEM) — even simpler, ETF-based, strong drawdown control. Cointegration pairs on bank F&O — market-neutral but more complex (needs futures for the short leg).

---

## Sources (consolidated)

**Momentum/Trend:** Moskowitz-Ooi-Pedersen "Time Series Momentum" (JFE 2012, aqr.com); Jegadeesh-Titman (J.Finance 1993); Antonacci *Dual Momentum* (2014, SSRN 2042750); Hurst-Ooi-Pedersen "A Century of Evidence on Trend-Following" (aqr.com); Faith *Way of the Turtle* (2007); Barroso-Santa-Clara "Momentum Has Its Moments" (SSRN 2041429); Daniel-Moskowitz "Momentum Crashes" (kentdaniel.net); George-Hwang (2004); Blitz-Huij-Martens "Residual Momentum" (2011); NSE Nifty200 Momentum 30 methodology; Quantpedia TSM.
**Stat-arb/Mean-reversion:** Engle-Granger (Econometrica 1987); Gatev-Goetzmann-Rouwenhorst (NBER w7032); Leung-Li *Optimal Mean Reversion Trading* (2016); Bertram (Physica A 2010); Avellaneda-Lee (Quant. Finance 2010); d'Aspremont (arXiv:0708.3048); Chan *Algorithmic Trading* (2013) + Hudson & Thames ArbitrageLab; Petajisto (FAJ 2017); Lehmann (QJE 1990); Nagel "Evaporating Liquidity" (RFS 2012); Krauss survey (J.Econ.Surveys 2017).
**Factors/Portfolio:** Fama-French (1993, 2015) + Ken French data library; AQR "Value and Momentum Everywhere" (2013), "Quality Minus Junk" (2019); Baker-Bradley-Wurgler (2011); Frazzini-Pedersen "Betting Against Beta"; Markowitz (1952); DeMiguel-Garlappi-Uppal (2009); Maillard-Roncalli-Teiletche (2010); López de Prado HRP (JPM 2016, SSRN 2708678); Black-Litterman (FAJ 1992); Thorp Kelly (2006); Moreira-Muir (2017); Harvey et al. (2018); IIM-Ahmedabad India FF-Momentum data (faculty.iima.ac.in/~iffm); niftyindices.com.
**ML/Rigor:** Hudson & Thames meta-labeling & triple-barrier; Gu-Kelly-Xiu (NBER w25398); Hambly-Xu-Yang RL survey (arXiv:2112.04553); Araci FinBERT (arXiv:1908.10063); Bailey-López de Prado "Deflated Sharpe Ratio" (davidhbailey.com); Bailey-Borwein-López de Prado-Zhu "Pseudo-Mathematics and Financial Charlatanism" (davidhbailey.com); López de Prado *Advances in Financial Machine Learning* (Wiley 2018); QuantConnect reality-modeling docs.
**Stack/India:** Zerodha Kite Connect, Upstox, Angel One SmartAPI, Dhan, Fyers, ICICI Breeze docs; yfinance; jugaad-data/nsepython; backtrader.com; vectorbt; backtesting.py; zipline-reloaded; TradingView Lightweight Charts; OWASP LLM Top-10; SEBI Feb-2025 retail-algo circular; zerodha.com/charges.
