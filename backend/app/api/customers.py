from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.customers import (
    CarIn,
    CarOut,
    CarPatch,
    CustomerBrief,
    CustomerIn,
    CustomerOut,
    CustomerPatch,
    CustomerSaved,
)
from app.schemas.errors import ErrorOut
from app.services import customers as customer_service

router = APIRouter(prefix="/customers")

Session = Annotated[AsyncSession, Depends(get_session)]

_ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorOut},
    422: {"model": ErrorOut},
}


@router.get("", response_model=list[CustomerBrief])
async def list_customers(session: Session, q: str = "") -> list[CustomerBrief]:
    return await customer_service.list_customers(session, q)


@router.post("", status_code=201, response_model=CustomerSaved, responses=_ERRORS)
async def create_customer(data: CustomerIn, session: Session) -> CustomerSaved:
    return await customer_service.create(session, data)


@router.get("/{customer_id}", response_model=CustomerOut, responses=_ERRORS)
async def get_customer(customer_id: int, session: Session) -> CustomerOut:
    return await customer_service.get(session, customer_id)


@router.patch("/{customer_id}", response_model=CustomerSaved, responses=_ERRORS)
async def update_customer(customer_id: int, data: CustomerPatch, session: Session) -> CustomerSaved:
    return await customer_service.update(session, customer_id, data)


@router.delete("/{customer_id}", status_code=204, responses=_ERRORS)
async def delete_customer(customer_id: int, session: Session) -> None:
    await customer_service.delete(session, customer_id)


@router.post("/{customer_id}/cars", status_code=201, response_model=CarOut, responses=_ERRORS)
async def create_car(customer_id: int, data: CarIn, session: Session) -> CarOut:
    return await customer_service.add_car(session, customer_id, data)


@router.patch("/{customer_id}/cars/{car_id}", response_model=CarOut, responses=_ERRORS)
async def update_car(customer_id: int, car_id: int, data: CarPatch, session: Session) -> CarOut:
    return await customer_service.update_car(session, customer_id, car_id, data)


@router.delete("/{customer_id}/cars/{car_id}", status_code=204, responses=_ERRORS)
async def delete_car(customer_id: int, car_id: int, session: Session) -> None:
    await customer_service.delete_car(session, customer_id, car_id)
