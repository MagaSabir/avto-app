from app.suppliers.ratelimit import RateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_rate_limiter_allows_up_to_limit_then_blocks() -> None:
    limiter = RateLimiter(3, 60, clock=FakeClock())
    assert [limiter.try_acquire() for _ in range(4)] == [True, True, True, False]


def test_rate_limiter_frees_slot_after_window() -> None:
    clock = FakeClock()
    limiter = RateLimiter(3, 60, clock=clock)
    for _ in range(3):
        limiter.try_acquire()
    assert limiter.try_acquire() is False
    clock.now += 60.01
    assert limiter.try_acquire() is True
