import time
from collections import defaultdict
from collections.abc import Callable
from datetime import timedelta


class LoginLimiter:
    """In-memory failed-login counter per IP; resets on restart, fine for a single process."""

    def __init__(
        self,
        max_failures: int = 10,
        window: timedelta = timedelta(minutes=15),
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_failures = max_failures
        self._window = window.total_seconds()
        self._clock = clock
        self._failures: dict[str, list[float]] = defaultdict(list)

    def _recent(self, ip: str) -> list[float]:
        cutoff = self._clock() - self._window
        recent = [t for t in self._failures[ip] if t > cutoff]
        if recent:
            self._failures[ip] = recent
        else:
            self._failures.pop(ip, None)
        return recent

    def is_blocked(self, ip: str) -> bool:
        return len(self._recent(ip)) >= self._max_failures

    def try_acquire(self, ip: str) -> bool:
        """Atomically (no await) check the limit and record an attempt; False if blocked."""
        recent = self._recent(ip)
        if len(recent) >= self._max_failures:
            return False
        recent.append(self._clock())
        self._failures[ip] = recent
        return True

    def forgive(self, ip: str) -> None:
        """Drop the most recent attempt (called after a successful login)."""
        recent = self._recent(ip)
        if recent:
            recent.pop()
            if recent:
                self._failures[ip] = recent
            else:
                self._failures.pop(ip, None)

    def record_failure(self, ip: str) -> None:
        recent = self._recent(ip)
        recent.append(self._clock())
        self._failures[ip] = recent
