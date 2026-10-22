class DomainError(Exception):
    status_code: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ItemNotFound(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Позиция не найдена")


class InsufficientStock(DomainError):
    status_code = 409

    def __init__(self, qty: int) -> None:
        super().__init__(f"Недостаточно на складе: остаток {qty}")


class NothingChanged(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Остаток не изменился")


class EmptyNumber(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Введите номер")


class SupplierNotFound(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Поставщик не найден")


class InvalidCredentials(DomainError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("Неверный логин или пароль")


class NotAuthenticated(DomainError):
    status_code = 401

    def __init__(self) -> None:
        super().__init__("Требуется вход")


class TooManyLoginAttempts(DomainError):
    status_code = 429

    def __init__(self) -> None:
        super().__init__("Слишком много попыток входа, подождите несколько минут")


class SettlementsNotSupported(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Поставщик не поддерживает взаиморасчёты")


class IncompletePeriod(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Укажите обе даты периода")


class InvertedPeriod(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Начало периода позже конца")
