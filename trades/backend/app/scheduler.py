"""Background scheduler — checks signals periodically and triggers notifications.

This runs as a background task alongside the FastAPI app. It:
1. Polls for price data on configured symbols
2. Computes trend signals
3. Sends notifications when signals change
4. Optionally auto-trades based on signals
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from . import notifications, paper_trading

logger = logging.getLogger(__name__)

# Check interval in seconds (5 minutes)
CHECK_INTERVAL = 300
# Symbols to monitor by default
DEFAULT_SYMBOLS = ["NIFTY 50", "BANKNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "ITC"]


class SignalScheduler:
    def __init__(self, interval: int = CHECK_INTERVAL):
        self.interval = interval
        self.running = False
        self.task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background signal checker."""
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info("Signal scheduler started")

    async def stop(self) -> None:
        """Stop the background signal checker."""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Signal scheduler stopped")

    async def _run_loop(self) -> None:
        """Main polling loop."""
        while self.running:
            try:
                await self._check_signals()
            except Exception as e:
                logger.error(f"Error in signal check: {e}")
            await asyncio.sleep(self.interval)

    async def _check_signals(self) -> None:
        """Check all configured symbols and send notifications."""
        cfg = notifications.load_config()
        if not cfg.get("enabled"):
            return

        symbols = cfg.get("watchlist", DEFAULT_SYMBOLS)
        signals = notifications.check_signals(symbols)

        for signal in signals:
            if signal.get("changed") and signal.get("signal"):
                logger.info(f"Signal changed for {signal['symbol']}: {signal['signal']}")

                # Send notifications
                results = notifications.send_signal(signal)
                for channel, result in results.items():
                    if result.get("ok"):
                        logger.info(f"Sent {channel} notification for {signal['symbol']}")
                    else:
                        logger.warning(f"Failed to send {channel}: {result.get('error')}")

                # Auto-trade if enabled
                if cfg.get("auto_trade"):
                    actions = paper_trading.auto_check_and_trade(
                        [signal["symbol"]],
                        {signal["symbol"]: signal["signal"]}
                    )
                    for action in actions:
                        logger.info(f"Auto-trade: {action['action']} {action['symbol']} at {action.get('price')}")


# Global scheduler instance
_scheduler: SignalScheduler | None = None


def get_scheduler() -> SignalScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = SignalScheduler()
    return _scheduler


async def start_scheduler() -> None:
    """Start the scheduler (call on app startup)."""
    await get_scheduler().start()


async def stop_scheduler() -> None:
    """Stop the scheduler (call on app shutdown)."""
    await get_scheduler().stop()
