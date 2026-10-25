import {
  GitCompareArrows,
  Minus,
  PackagePlus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { useAddToCart, useCart } from "@/api/cart";
import type { Offer, PartGroup } from "@/api/search";
import { normBrand } from "@/lib/brand";

type Props = {
  supplier: string;
  group: PartGroup;
  offer: Offer;
  onToStock: (group: PartGroup, offer: Offer) => void;
  disabled?: boolean;
};

const ICON_BTN =
  "relative inline-flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-[7px] border bg-card disabled:cursor-default disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";
const FILLED_BTN =
  "relative inline-flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-[7px] bg-primary text-primary-foreground enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";
const STEP_BTN =
  "inline-flex h-8 w-7 cursor-pointer items-center justify-center bg-card text-foreground enabled:hover:bg-selected disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50";

// Order offers have no stock of their own: any quantity up to this.
const ORDER_MAX = 999; // mirrors ORDER_MAX in backend/app/domain/cart.py

export function OfferActions({
  supplier,
  group,
  offer,
  onToStock,
  disabled = false,
}: Props) {
  const [value, setValue] = useState(String(offer.multiplicity));
  const cart = useCart();
  const add = useAddToCart();

  const qty = Number(value);
  const max = offer.kind === "order" ? ORDER_MAX : offer.qty;
  const valid =
    /^\d+$/.test(value) &&
    qty > 0 &&
    qty % offer.multiplicity === 0 &&
    qty <= max;

  const inCart = (cart.data?.items ?? [])
    .filter(
      (i) =>
        i.supplier === supplier &&
        i.number_norm === group.number_norm &&
        normBrand(i.brand) === normBrand(group.brand) &&
        i.stock_id === offer.stock_id &&
        // Mikado variants may share a stock id: tell them apart.
        i.warehouse === offer.warehouse &&
        sameMoment(i.delivery_from, offer.delivery_from),
    )
    .reduce((sum, i) => sum + i.qty, 0);

  const m = offer.multiplicity;
  const top = Math.floor(max / m) * m;
  const cur = /^\d+$/.test(value) ? qty : null;
  const upDisabled = cur === null ? top < m : cur + m > top;
  const downDisabled = cur !== null && cur - m < m;

  function step(delta: 1 | -1) {
    const base = cur ?? m;
    const aligned =
      delta > 0 ? Math.floor(base / m) * m + m : Math.ceil(base / m) * m - m;
    setValue(String(Math.min(Math.max(aligned, m), top)));
    add.reset();
  }

  const status = disabled ? null : !valid ? (
    <span className="text-destructive">
      {`кратно ${String(offer.multiplicity)}, не больше ${String(max)}`}
    </span>
  ) : add.isError ? (
    <span className="text-destructive">{add.error.message}</span>
  ) : null;

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!valid || offer.stock_id === "" || add.isPending) return;
    add.mutate({
      supplier,
      stock_id: offer.stock_id,
      brand: group.brand,
      number: group.number,
      name: group.name,
      warehouse: offer.warehouse,
      multiplicity: offer.multiplicity,
      available: offer.qty,
      delivery_days: offer.delivery_days,
      delivery_from: offer.delivery_from,
      delivery_to: offer.delivery_to,
      kind: offer.kind,
      kind_code: offer.kind_code,
      price: offer.purchase_price,
      qty,
      order_code: offer.order_code ?? null,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end"
    >
      <div className="inline-flex h-8 items-stretch overflow-hidden rounded-[7px] border bg-card focus-within:ring-[3px] focus-within:ring-ring has-[input[aria-invalid=true]]:border-destructive">
        <button
          type="button"
          aria-label="Уменьшить"
          disabled={disabled || downDisabled}
          onClick={() => {
            step(-1);
          }}
          className={STEP_BTN}
        >
          <Minus aria-hidden="true" className="size-3.5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Количество"
          aria-invalid={!disabled && !valid}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            add.reset();
          }}
          className="h-full w-[2.5em] min-w-0 bg-card px-0 text-center tabular-nums outline-none disabled:opacity-50 aria-invalid:text-destructive"
        />
        <button
          type="button"
          aria-label="Увеличить"
          disabled={disabled || upDisabled}
          onClick={() => {
            step(1);
          }}
          className={STEP_BTN}
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <button
        type="submit"
        aria-label={
          inCart > 0 ? `В корзину, в корзине ${String(inCart)}` : "В корзину"
        }
        title="В корзину"
        disabled={disabled || offer.stock_id === "" || add.isPending}
        className={FILLED_BTN}
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
        {inCart > 0 && (
          <span className="absolute -top-2 -right-1.5 text-[12px] leading-none font-semibold text-foreground">
            {inCart}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label="Принять на склад"
        title="Принять на склад"
        disabled={disabled}
        className={FILLED_BTN}
        onClick={() => {
          onToStock(group, offer);
        }}
      >
        <PackagePlus aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label="В сравнение"
        title="Сравнение — позже"
        disabled
        className={`${ICON_BTN} text-soft-foreground`}
      >
        <GitCompareArrows aria-hidden="true" className="size-4" />
      </button>
      {status !== null && (
        <div
          role="status"
          className="absolute right-0 top-full z-10 mt-0.5 whitespace-nowrap text-[12px] leading-4 text-muted-foreground"
        >
          {status}
        </div>
      )}
    </form>
  );
}

// The cart stores times in UTC, the supplier answers with its own offset.
function sameMoment(a: string | null, b: string | null): boolean {
  return a === null || b === null ? a === b : Date.parse(a) === Date.parse(b);
}
