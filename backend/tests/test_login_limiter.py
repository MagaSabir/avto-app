from datetime import timedelta

from app.core.login_limiter import LoginLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_blocks_after_ten_failures() -> None:
    limiter = LoginLimiter(clock=FakeClock())
    for _ in range(9):
        limiter.record_failure("1.1.1.1")
    assert not limiter.is_blocked("1.1.1.1")
    limiter.record_failure("1.1.1.1")
    assert limiter.is_blocked("1.1.1.1")


def test_window_expires() -> None:
    clock = FakeClock()
    limiter = LoginLimiter(clock=clock)
    for _ in range(10):
        limiter.record_failure("1.1.1.1")
    clock.now += timedelta(minutes=15, seconds=1).total_seconds()
    assert not limiter.is_blocked("1.1.1.1")


def test_ips_independent() -> None:
    limiter = LoginLimiter(clock=FakeClock())
    for _ in range(10):
        limiter.record_failure("1.1.1.1")
    assert limiter.is_blocked("1.1.1.1")
    assert not limiter.is_blocked("2.2.2.2")


def test_try_acquire_blocks_after_limit() -> None:
    limiter = LoginLimiter(clock=FakeClock())
    assert all(limiter.try_acquire("1.1.1.1") for _ in range(10))
    assert not limiter.try_acquire("1.1.1.1")
    assert limiter.is_blocked("1.1.1.1")


def test_forgive_removes_last_attempt() -> None:
    limiter = LoginLimiter(clock=FakeClock())
    for _ in range(10):
        limiter.try_acquire("1.1.1.1")
    limiter.forgive("1.1.1.1")
    assert not limiter.is_blocked("1.1.1.1")
    limiter.forgive("2.2.2.2")
