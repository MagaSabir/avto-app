from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.customers import normalize_phone, normalize_plate, normalize_vin
from app.models.customers import Customer, CustomerCar
from app.repositories import customers as repo
from app.schemas.customers import (
    CarBrief,
    CarIn,
    CarOut,
    CarPatch,
    CustomerBrief,
    CustomerIn,
    CustomerOut,
    CustomerPatch,
    CustomerSaved,
)
from app.services.errors import (
    CarNeedsIdentity,
    CarNotFound,
    CustomerNotFound,
    EmptyCustomerName,
    InvalidPhone,
    InvalidVin,
    InvalidYear,
)

MIN_YEAR = 1950
MAX_YEAR = 2100


def format_phone(phone: str) -> str:
    if len(phone) == 11 and phone[0] == "7":
        return f"+7 {phone[1:4]} {phone[4:7]}-{phone[7:9]}-{phone[9:]}"
    return phone


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def _name(value: str) -> str:
    name = value.strip()
    if not name:
        raise EmptyCustomerName()
    return name


def _phones(raw: list[str]) -> list[str]:
    phones: list[str] = []
    for item in raw:
        phone = normalize_phone(item)
        if phone is None:
            raise InvalidPhone()
        if phone not in phones:
            phones.append(phone)
    return phones


def _car_fields(data: CarIn | CarPatch) -> dict[str, object]:
    """Normalized values for the car fields present in the request."""
    fields: dict[str, object] = {}
    for key in data.model_fields_set:
        value = getattr(data, key)
        if key == "year":
            if value is not None and not MIN_YEAR <= value <= MAX_YEAR:
                raise InvalidYear()
            fields[key] = value
        elif key == "vin":
            try:
                fields[key] = None if value is None else normalize_vin(value)
            except ValueError:
                raise InvalidVin() from None
        elif key == "plate":
            fields[key] = None if value is None else normalize_plate(value)
        else:
            fields[key] = _clean(value)
    return fields


def _require_identity(fields: dict[str, object]) -> None:
    if not any(fields.get(k) for k in ("make", "vin", "plate")):
        raise CarNeedsIdentity()


async def _get(session: AsyncSession, customer_id: int) -> Customer:
    customer = await repo.get(session, customer_id)
    if customer is None:
        raise CustomerNotFound()
    return customer


async def _out(session: AsyncSession, customer: Customer) -> CustomerOut:
    phones = await repo.phones_by_customer(session, [customer.id])
    cars = await repo.cars_by_customer(session, [customer.id])
    return CustomerOut(
        id=customer.id,
        name=customer.name,
        comment=customer.comment,
        phones=phones.get(customer.id, []),
        cars=[CarOut.model_validate(c) for c in cars.get(customer.id, [])],
        created_at=customer.created_at,
    )


async def _saved(session: AsyncSession, customer: Customer, new_phones: list[str]) -> CustomerSaved:
    owners = await repo.phone_owners(session, new_phones, customer.id)
    warnings = [
        f"Телефон {format_phone(phone)} уже есть у клиента «{name}»" for phone, name in owners
    ]
    out = await _out(session, customer)
    return CustomerSaved(**out.model_dump(), warnings=warnings)


async def list_customers(session: AsyncSession, q: str) -> list[CustomerBrief]:
    customers = await repo.search(session, q)
    ids = [c.id for c in customers]
    phones = await repo.phones_by_customer(session, ids)
    cars = await repo.cars_by_customer(session, ids)
    return [
        CustomerBrief(
            id=c.id,
            name=c.name,
            phones=phones.get(c.id, []),
            cars=[CarBrief.model_validate(car) for car in cars.get(c.id, [])],
        )
        for c in customers
    ]


async def create(session: AsyncSession, data: CustomerIn) -> CustomerSaved:
    name = _name(data.name)
    phones = _phones(data.phones)
    customer = await repo.add(session, name, _clean(data.comment))
    await repo.replace_phones(session, customer.id, phones)
    result = await _saved(session, customer, phones)
    await session.commit()
    return result


async def get(session: AsyncSession, customer_id: int) -> CustomerOut:
    return await _out(session, await _get(session, customer_id))


async def update(session: AsyncSession, customer_id: int, data: CustomerPatch) -> CustomerSaved:
    customer = await _get(session, customer_id)
    sent = data.model_fields_set
    new_name = _name(data.name) if "name" in sent and data.name is not None else None
    new_phones = _phones(data.phones) if data.phones is not None else None
    if new_name is not None:
        customer.name = new_name
    if "comment" in sent:
        customer.comment = _clean(data.comment)
    if new_phones is not None:
        await repo.replace_phones(session, customer.id, new_phones)
    await repo.touch(session, customer)
    result = await _saved(session, customer, new_phones or [])
    await session.commit()
    return result


async def delete(session: AsyncSession, customer_id: int) -> None:
    customer = await _get(session, customer_id)
    await repo.delete_customer(session, customer)
    await session.commit()


async def add_car(session: AsyncSession, customer_id: int, data: CarIn) -> CarOut:
    customer = await _get(session, customer_id)
    fields = _car_fields(data)
    _require_identity(fields)
    car = await repo.add_car(session, customer.id, **fields)
    await repo.touch(session, customer)
    await session.commit()
    return CarOut.model_validate(car)


async def _get_car(
    session: AsyncSession, customer_id: int, car_id: int
) -> tuple[Customer, CustomerCar]:
    customer = await _get(session, customer_id)
    car = await repo.get_car(session, customer_id, car_id)
    if car is None:
        raise CarNotFound()
    return customer, car


async def update_car(
    session: AsyncSession, customer_id: int, car_id: int, data: CarPatch
) -> CarOut:
    customer, car = await _get_car(session, customer_id, car_id)
    fields = _car_fields(data)
    merged = {k: getattr(car, k) for k in ("make", "vin", "plate")} | fields
    _require_identity(merged)
    for key, value in fields.items():
        setattr(car, key, value)
    await session.flush()
    await repo.touch(session, customer)
    result = CarOut.model_validate(car)
    await session.commit()
    return result


async def delete_car(session: AsyncSession, customer_id: int, car_id: int) -> None:
    customer, car = await _get_car(session, customer_id, car_id)
    await repo.delete_car(session, car)
    await repo.touch(session, customer)
    await session.commit()
