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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normBrand } from "@/lib/brand";
import { useFlash } from "@/features/stock/useFlash";

import { VariantsList } from "./VariantsList";

type Props = {
  supplier: string;
  group: PartGroup;
  offer: Offer;
  onToStock: (group: PartGroup, offer: Offer) => void;
  disabled?: boolean;
};

const ICON_BTN =
  "relative inline-flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-[7px] border bg-card disabled:cursor-default disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";
const STEP_BTN =
  "inline-flex h-8 w-7 cursor-pointer items-center justify-center rounded-[7px] border bg-card text-foreground enabled:hover:bg-selected disabled:cursor-default disabled:opacity-50";

// Order offers have no stock of their own: any quantity up to this.
const ORDER_MAX = 999; // mirrors ORDER_MAX in backend/app/domain/cart.py

export function OfferActions(props: Props) {
  // A «variants» row has no price or term of its own: its delivery options
  // open from here (and each of them goes to the cart).
  if (props.offer.kind === "variants") return <VariantsToggle {...props} />;
  return <CartActions {...props} />;
}

function VariantsToggle({ supplier, group, offer, onToStock }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col md:items-end">
      <Button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="h-8 px-2"
      >
        {open ? "варианты поставки ▴" : "варианты поставки ▾"}
      </Button>
      {open && (
        <VariantsList
          supplier={supplier}
          group={group}
          orderCode={offer.order_code ?? ""}
          onToStock={onToStock}
        />
      )}
    </div>
  );
}

function CartActions({
  supplier,
  group,
  offer,
  onToStock,
  disabled = false,
}: Props) {
  const [value, setValue] = useState(String(offer.multiplicity));
  const [flash, showFlash] = useFlash(2500);
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
        i.stock_id === offer.stock_id,
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

  const status = !valid ? (
    <span className="text-destructive">
      {`кратно ${String(offer.multiplicity)}, не больше ${String(max)}`}
    </span>
  ) : add.isError ? (
    <span className="text-destructive">{add.error.message}</span>
  ) : flash !== null ? (
    <span className="text-status-ok">{flash}</span>
  ) : null;

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!valid || offer.stock_id === "" || add.isPending) return;
    add.mutate(
      {
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
      },
      {
        onSuccess: () => {
          showFlash("Добавлено");
        },
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end"
    >
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
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Количество"
        aria-invalid={!valid}
        min={offer.multiplicity}
        step={offer.multiplicity}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          add.reset();
        }}
        className="h-8 w-14 px-2 text-center tabular-nums aria-invalid:border-destructive"
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
      <button
        type="submit"
        aria-label={
          inCart > 0 ? `В корзину, в корзине ${String(inCart)}` : "В корзину"
        }
        title="В корзину"
        disabled={disabled || offer.stock_id === "" || add.isPending}
        className={`${ICON_BTN} ${
          inCart > 0
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary text-link"
        }`}
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
        {inCart > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full border-2 border-card bg-primary px-1 text-center text-[10.5px] leading-3 text-primary-foreground">
            {inCart}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label="Принять на склад"
        title="Принять на склад"
        disabled={disabled}
        className={`${ICON_BTN} border-primary text-link`}
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
          className="basis-full text-[12px] text-muted-foreground md:text-right"
        >
          {status}
        </div>
      )}
    </form>
  );
}
