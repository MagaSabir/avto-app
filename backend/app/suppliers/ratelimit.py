import time
from collections import deque
from collections.abc import Callable


class RateLimiter:
    """Sliding-window limiter: at most `limit` acquisitions per `window` seconds."""

    def __init__(
        self, limit: int, window: float, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._limit = limit
        self._window = window
        self._clock = clock
        self._stamps: deque[float] = deque()

    def try_acquire(self) -> bool:
        now = self._clock()
        while self._stamps and now - self._stamps[0] > self._window:
            self._stamps.popleft()
        if len(self._stamps) >= self._limit:
            return False
        self._stamps.append(now)
        return True
