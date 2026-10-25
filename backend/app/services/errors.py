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


class TooManyNumbers(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Слишком много номеров")


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


class OrdersNotSupported(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Поставщик не поддерживает заказы")


class OrdersQueryRequired(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Укажите период или номер заказа")


class OrdersQueryConflict(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Укажите либо период, либо номер заказа")


class CartItemNotFound(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Строка корзины не найдена")


class InvalidCartQty(DomainError):
    status_code = 422

    def __init__(self, multiplicity: int, available: int) -> None:
        super().__init__(f"Количество должно быть кратно {multiplicity} и не больше {available}")


class VariantNotChosen(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Выберите вариант поставки")


class UnknownSupplier(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Неизвестный поставщик")


class VariantsNotSupported(DomainError):
    status_code = 404

    def __init__(self) -> None:
        super().__init__("Поставщик не поддерживает варианты поставки")


class EmptyOrderCode(DomainError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__("Укажите код заказа")
