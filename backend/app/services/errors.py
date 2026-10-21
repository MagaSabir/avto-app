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
