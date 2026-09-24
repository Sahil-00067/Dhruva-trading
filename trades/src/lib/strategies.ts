// The strategy library — sourced from docs/strategy-catalog.md.
// Illustrative stats are for UI demonstration only, NOT backtested results.

export type Category =
  | 'Trend & Momentum'
  | 'Mean-Reversion & Stat-Arb'
  | 'Factor'
  | 'Portfolio & Sizing'
  | 'Machine Learning'

export type Complexity = 'Easy' | 'Medium' | 'Hard' | 'Advanced'
export type Badge = 'Default' | 'Best pick' | 'Market-neutral' | 'Defensive'
export type Mode = 'trading' | 'investing' | 'both'

export type Strategy = {
  id: string
  name: string
  category: Category
  mode: Mode
  complexity: Complexity
  horizon: string
  tagline: string
  mechanism: string
  worksWhen: string
  failsWhen: string
  indiaNote: string
  badges: Badge[]
  // Illustrative only — replaced by real backtests in Phase 2.
  illus: { cagr: number; sharpe: number; maxDD: number; winRate: number }
}

export const CATEGORIES: Category[] = [
  'Trend & Momentum',
  'Mean-Reversion & Stat-Arb',
  'Factor',
  'Portfolio & Sizing',
  'Machine Learning',
]

export const STRATEGIES: Strategy[] = [
  {
    id: 'ts-momentum',
    name: 'Time-Series Momentum',
    category: 'Trend & Momentum',
    mode: 'trading',
    complexity: 'Easy',
    horizon: 'Weeks–months',
    tagline: 'Ride the trend, scaled to a steady risk level.',
    mechanism:
      'Go long when the trailing ~12-month return is positive, otherwise move to cash; size the position inverse to recent volatility so risk stays constant.',
    worksWhen: 'Sustained trends and trending crises — historically positive across markets back to 1880.',
    failsWhen: 'Choppy, range-bound tapes and sharp V-shaped reversals cause whipsaw.',
    indiaNote: 'Best on NIFTY & BANK NIFTY futures — deep liquidity, low STT, long/flat avoids shorting limits.',
    badges: ['Default', 'Best pick'],
    illus: { cagr: 16.4, sharpe: 1.28, maxDD: -14.2, winRate: 47 },
  },
  {
    id: 'xs-momentum',
    name: 'Cross-Sectional Momentum',
    category: 'Trend & Momentum',
    mode: 'trading',
    complexity: 'Medium',
    horizon: '1–6 months',
    tagline: 'Hold the strongest names, drop the laggards.',
    mechanism:
      'Rank the universe by past 12-month return (skipping the last month); hold the top names, rebalance monthly.',
    worksWhen: 'Calm, trending markets — the classic ~1%/month winner-minus-loser spread.',
    failsWhen: 'Sharp market rebounds trigger momentum crashes; high turnover bleeds to costs.',
    indiaNote: 'Practical vehicle is a long-only tilt or the Nifty200 Momentum 30 basket.',
    badges: [],
    illus: { cagr: 18.1, sharpe: 1.05, maxDD: -24.6, winRate: 44 },
  },
  {
    id: 'dual-momentum',
    name: 'Dual Momentum (GEM)',
    category: 'Trend & Momentum',
    mode: 'both',
    complexity: 'Easy',
    horizon: 'Monthly',
    tagline: 'Pick the strongest sleeve — and step aside in downtrends.',
    mechanism:
      'Relative momentum chooses the stronger equity sleeve; absolute momentum switches to bonds/cash when the trend turns negative.',
    worksWhen: 'Trending regimes; the absolute filter sidesteps prolonged bear markets.',
    failsWhen: 'Fast reversals around the monthly signal cause late entries/exits.',
    indiaNote: 'Build with a Nifty/global-equity ETF versus a gilt fund — very low turnover.',
    badges: ['Defensive'],
    illus: { cagr: 13.2, sharpe: 1.12, maxDD: -11.8, winRate: 55 },
  },
  {
    id: 'donchian',
    name: 'Donchian Breakout (Turtle)',
    category: 'Trend & Momentum',
    mode: 'trading',
    complexity: 'Easy',
    horizon: 'Weeks',
    tagline: 'Buy new highs, sell new lows, size by volatility.',
    mechanism:
      'Enter on an N-day high (e.g. 20/55), exit on the opposite band; ATR-based stops and position sizing.',
    worksWhen: 'Strong directional moves — fully mechanical trend capture.',
    failsWhen: 'Range-bound markets create many false breakouts; low hit-rate with a fat right tail.',
    indiaNote: 'Circuit freezes can block stop exits; F&O ban periods block fresh entries.',
    badges: [],
    illus: { cagr: 14.0, sharpe: 0.86, maxDD: -22.0, winRate: 41 },
  },
  {
    id: 'cta-trend',
    name: 'Managed Futures / CTA Trend',
    category: 'Trend & Momentum',
    mode: 'both',
    complexity: 'Hard',
    horizon: 'Weeks–months',
    tagline: 'Trend-follow across many markets for crisis alpha.',
    mechanism:
      'Apply time-series momentum across equity, bond, FX and commodity futures, vol-targeted and diversified.',
    worksWhen: 'Sustained multi-asset trends; historically an equity-uncorrelated crisis hedge.',
    failsWhen: 'Range-bound, low-dispersion years; rising cross-asset correlations erode the edge.',
    indiaNote: 'MCX commodities plus index/bond futures — narrower universe, watch far-month liquidity.',
    badges: [],
    illus: { cagr: 11.5, sharpe: 0.95, maxDD: -16.5, winRate: 46 },
  },
  {
    id: 'pairs-coint',
    name: 'Cointegration Pairs',
    category: 'Mean-Reversion & Stat-Arb',
    mode: 'trading',
    complexity: 'Medium',
    horizon: 'Days–weeks',
    tagline: 'Trade the spread between two linked stocks.',
    mechanism:
      'Find cointegrated pairs, then trade the z-score of the stationary spread — short it high, long it low.',
    worksWhen: 'Stable-correlation, range-bound regimes.',
    failsWhen: 'Structural breaks snap the relationship; the edge has thinned with crowding.',
    indiaNote: 'Same-sector F&O large-caps (HDFCBANK/ICICIBANK); short the spread via futures.',
    badges: ['Market-neutral'],
    illus: { cagr: 9.8, sharpe: 1.18, maxDD: -9.4, winRate: 58 },
  },
  {
    id: 'ou-reversion',
    name: 'OU Mean-Reversion',
    category: 'Mean-Reversion & Stat-Arb',
    mode: 'trading',
    complexity: 'Medium',
    horizon: 'Days',
    tagline: 'Only trade spreads that revert fast enough to pay.',
    mechanism:
      'Model the spread as an Ornstein–Uhlenbeck process; use the half-life to set entry/exit bands.',
    worksWhen: 'Spreads with a short half-life that reliably pull back to the mean.',
    failsWhen: 'Regime shifts widen volatility and stretch the reversion time.',
    indiaNote: 'Reject pairs that revert slower than round-trip STT + impact can recover.',
    badges: ['Market-neutral'],
    illus: { cagr: 10.6, sharpe: 1.22, maxDD: -8.1, winRate: 61 },
  },
  {
    id: 'pca-statarb',
    name: 'PCA Stat-Arb Baskets',
    category: 'Mean-Reversion & Stat-Arb',
    mode: 'trading',
    complexity: 'Advanced',
    horizon: 'Days',
    tagline: 'Fade each stock’s move against its peers.',
    mechanism:
      'Extract common factors with PCA; trade the mean-reversion of each stock’s idiosyncratic residual, market-neutral.',
    worksWhen: 'Liquid, mean-reverting cross-sections.',
    failsWhen: 'Trending or crisis factor blow-ups; the edge decayed post-2007 with crowding.',
    indiaNote: 'Feasible on Nifty 100/200; residual shorting needs single-stock futures.',
    badges: ['Market-neutral'],
    illus: { cagr: 12.3, sharpe: 1.1, maxDD: -13.7, winRate: 54 },
  },
  {
    id: 'index-arb',
    name: 'Index / ETF Arbitrage',
    category: 'Mean-Reversion & Stat-Arb',
    mode: 'trading',
    complexity: 'Advanced',
    horizon: 'Intraday',
    tagline: 'Capture the gap between futures and the basket.',
    mechanism:
      'Trade index futures versus the cash basket (cash-and-carry); the premium mean-reverts to fair value.',
    worksWhen: 'High-capacity edge; premiums widen during stress and illiquidity.',
    failsWhen: 'Creation halts or an illiquid basket breaks the arbitrage.',
    indiaNote: 'NIFTY/BANKNIFTY futures are world-class liquid, but STT + stamp widen the no-arb band.',
    badges: ['Market-neutral'],
    illus: { cagr: 7.2, sharpe: 1.35, maxDD: -4.2, winRate: 67 },
  },
  {
    id: 'multi-factor',
    name: 'Multi-Factor (Quality · Low-Vol · Momentum)',
    category: 'Factor',
    mode: 'investing',
    complexity: 'Medium',
    horizon: 'Quarters–years',
    tagline: 'Blend the most robust return drivers into one sleeve.',
    mechanism:
      'Score stocks on quality, low volatility and momentum (optionally value), then hold a diversified basket, rebalanced periodically.',
    worksWhen: 'Over full cycles — low-correlated factors smooth each other’s droughts.',
    failsWhen: 'Single-factor droughts, crowding, and factor-timing overfitting.',
    indiaNote: 'Quality and Low-Vol are the most robust Indian factors; validate on the IIM-A factor dataset.',
    badges: ['Default', 'Best pick'],
    illus: { cagr: 15.1, sharpe: 1.2, maxDD: -18.4, winRate: 56 },
  },
  {
    id: 'low-vol',
    name: 'Low-Volatility',
    category: 'Factor',
    mode: 'investing',
    complexity: 'Easy',
    horizon: 'Quarters–years',
    tagline: 'Own the calm stocks — higher return per unit of risk.',
    mechanism: 'Hold the lowest-volatility / lowest-beta names; leverage constraints leave them underpriced.',
    worksWhen: 'Most regimes on a risk-adjusted basis; defensive in drawdowns.',
    failsWhen: 'Lags in strong bull rallies; sensitive to interest-rate moves.',
    indiaNote: 'Tracked by the Nifty Low Volatility 50 / Alpha Low-Vol 30 indices.',
    badges: ['Defensive'],
    illus: { cagr: 12.8, sharpe: 1.15, maxDD: -15.0, winRate: 58 },
  },
  {
    id: 'quality',
    name: 'Quality / Profitability',
    category: 'Factor',
    mode: 'investing',
    complexity: 'Easy',
    horizon: 'Years',
    tagline: 'Buy durable, profitable, low-leverage businesses.',
    mechanism: 'Tilt toward high, stable profitability, low leverage and steady growth ("Quality minus Junk").',
    worksWhen: 'The most robust, defensive factor; mildly pro-cyclical.',
    failsWhen: 'Rarely — occasional shallow drawdowns in risk-on melt-ups.',
    indiaNote: 'Tracked by the Nifty200 Quality 30 index; strong evidence in India.',
    badges: [],
    illus: { cagr: 14.2, sharpe: 1.14, maxDD: -16.8, winRate: 57 },
  },
  {
    id: 'value',
    name: 'Value',
    category: 'Factor',
    mode: 'investing',
    complexity: 'Easy',
    horizon: 'Years',
    tagline: 'Buy cheap, sell dear — patiently.',
    mechanism: 'Hold stocks cheap on book, earnings or cash-flow yield; short or avoid the expensive.',
    worksWhen: 'Over the long run, especially after value has been out of favour.',
    failsWhen: 'Long droughts (the 2010s) and value traps.',
    indiaNote: 'Documented but weak and regime-dependent in India post-2000.',
    badges: [],
    illus: { cagr: 13.0, sharpe: 0.82, maxDD: -27.5, winRate: 51 },
  },
  {
    id: 'hrp',
    name: 'Hierarchical Risk Parity',
    category: 'Portfolio & Sizing',
    mode: 'investing',
    complexity: 'Hard',
    horizon: 'Allocation',
    tagline: 'Diversify by clustering, not fragile matrix inversion.',
    mechanism:
      'Cluster assets by correlation into a tree, then allocate risk by recursive bisection — no unstable inverse covariance.',
    worksWhen: 'Noisy, correlated universes; more robust out-of-sample than mean-variance.',
    failsWhen: 'Ignores expected returns; sensitive to the clustering choice.',
    indiaNote: 'Good fit for correlated Indian equity baskets where estimates are noisy.',
    badges: [],
    illus: { cagr: 11.9, sharpe: 1.08, maxDD: -13.2, winRate: 0 },
  },
  {
    id: 'risk-parity',
    name: 'Risk Parity',
    category: 'Portfolio & Sizing',
    mode: 'investing',
    complexity: 'Medium',
    horizon: 'Allocation',
    tagline: 'Equalise each asset’s contribution to risk.',
    mechanism: 'Weight assets so each contributes the same risk; no return forecasts required.',
    worksWhen: 'Stable, diversified regimes across asset classes.',
    failsWhen: 'Rate shocks; may need leverage on low-vol assets, which is costly.',
    indiaNote: 'Usable across asset classes; financing/leverage is expensive locally.',
    badges: [],
    illus: { cagr: 10.4, sharpe: 1.02, maxDD: -12.0, winRate: 0 },
  },
  {
    id: 'vol-target',
    name: 'Volatility Targeting',
    category: 'Portfolio & Sizing',
    mode: 'both',
    complexity: 'Easy',
    horizon: 'Overlay',
    tagline: 'Scale exposure to keep risk constant.',
    mechanism: 'Raise exposure when realised volatility is low, cut it when volatility spikes, targeting a fixed risk level.',
    worksWhen: 'Volatility clusters (as it does) — improves Sharpe and tames tails.',
    failsWhen: 'De-risks into a rally if volatility spikes without a reversal.',
    indiaNote: 'Near-essential given BANK NIFTY’s pronounced volatility regimes.',
    badges: [],
    illus: { cagr: 12.0, sharpe: 1.18, maxDD: -10.5, winRate: 0 },
  },
  {
    id: 'meta-label',
    name: 'Meta-Labeling + Triple Barrier',
    category: 'Machine Learning',
    mode: 'both',
    complexity: 'Advanced',
    horizon: 'Varies',
    tagline: 'Let a model decide how much to trust each signal.',
    mechanism:
      'Label events by which barrier (profit / stop / time) hits first, then train a model to size or filter a primary signal.',
    worksWhen: 'Turning a decent signal into better precision and risk-adjusted returns.',
    failsWhen: 'Small samples and overlapping-label leakage — needs purging and sample weights.',
    indiaNote: 'Layer on top of a trend or pairs signal on liquid F&O names.',
    badges: [],
    illus: { cagr: 15.5, sharpe: 1.24, maxDD: -14.9, winRate: 49 },
  },
  {
    id: 'gbm-alpha',
    name: 'Gradient-Boosted Return Model',
    category: 'Machine Learning',
    mode: 'both',
    complexity: 'Advanced',
    horizon: 'Days–weeks',
    tagline: 'Learn nonlinear signals from many features.',
    mechanism:
      'Train gradient-boosted trees on engineered features to predict cross-sectional expected returns.',
    worksWhen: 'Rich tabular panels with real signal; captures nonlinear interactions.',
    failsWhen: 'Low signal-to-noise invites overfitting — needs purged CV and a deflated Sharpe check.',
    indiaNote: 'Feasible on Nifty 500 with the IIM-A factor features as inputs.',
    badges: [],
    illus: { cagr: 17.2, sharpe: 1.16, maxDD: -19.8, winRate: 52 },
  },
]

export function strategyById(id: string) {
  return STRATEGIES.find((s) => s.id === id)
}

export function strategiesForMode(mode: 'trading' | 'investing') {
  return STRATEGIES.filter((s) => s.mode === mode || s.mode === 'both')
}

export function defaultStrategy(mode: 'trading' | 'investing') {
  return STRATEGIES.find((s) => s.badges.includes('Default') && (s.mode === mode || s.mode === 'both'))
}
