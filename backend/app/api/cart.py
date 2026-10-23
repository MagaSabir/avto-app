from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.db import get_session
from app.schemas.cart import CartItemIn, CartItemOut, CartOut, CartQtyIn
from app.schemas.errors import ErrorOut
from app.services import cart as cart_service
from app.suppliers import get_suppliers
from app.suppliers.base import Supplier

router = APIRouter(prefix="/cart")

Session = Annotated[AsyncSession, Depends(get_session)]
Suppliers = Annotated[dict[str, Supplier], Depends(get_suppliers)]

_ERRORS: dict[int | str, dict[str, Any]] = {404: {"model": ErrorOut}, 422: {"model": ErrorOut}}


@router.get("", response_model=CartOut)
async def get_cart(session: Session, user: CurrentUser) -> CartOut:
    return await cart_service.get_cart(session, user.id)


@router.post(
    "/items", status_code=201, response_model=CartItemOut, responses={422: {"model": ErrorOut}}
)
async def add_item(
    data: CartItemIn, session: Session, user: CurrentUser, suppliers: Suppliers
) -> CartItemOut:
    return await cart_service.add_item(session, user.id, data, suppliers)


@router.patch("/items/{item_id}", response_model=CartItemOut, responses=_ERRORS)
async def set_qty(
    item_id: int, data: CartQtyIn, session: Session, user: CurrentUser
) -> CartItemOut:
    return await cart_service.set_qty(session, user.id, item_id, data.qty)


@router.delete("/items/{item_id}", status_code=204, responses={404: {"model": ErrorOut}})
async def remove_item(item_id: int, session: Session, user: CurrentUser) -> None:
    await cart_service.remove_item(session, user.id, item_id)


@router.delete("", status_code=204)
async def clear(session: Session, user: CurrentUser) -> None:
    await cart_service.clear(session, user.id)
