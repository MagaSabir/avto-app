import { PackagePlus, ShoppingCart } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { useAddToCart, useCart } from "@/api/cart";
import type { Offer, PartGroup } from "@/api/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normBrand } from "@/lib/brand";
import { useFlash } from "@/features/stock/useFlash";

type Props = {
  supplier: string;
  group: PartGroup;
  offer: Offer;
  onToStock: (group: PartGroup, offer: Offer) => void;
};

// Order offers have no stock of their own: any quantity up to this.
const ORDER_MAX = 999;

export function OfferActions(props: Props) {
  // A «variants» row has no price or term of its own: its delivery options
  // open from here (and each of them goes to the cart).
  if (props.offer.kind === "variants")
    return (
      <div className="flex md:justify-end">
        <Button type="button" disabled className="h-8 px-2">
          варианты поставки ▾
        </Button>
      </div>
    );
  return <CartActions {...props} />;
}

function CartActions({ supplier, group, offer, onToStock }: Props) {
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

  const status = !valid ? (
    <span className="text-destructive">
      {`кратно ${String(offer.multiplicity)}, не больше ${String(max)}`}
    </span>
  ) : add.isError ? (
    <span className="text-destructive">{add.error.message}</span>
  ) : flash !== null ? (
    <span className="text-status-ok">{flash}</span>
  ) : inCart > 0 ? (
    `в корзине ${String(inCart)} шт`
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
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Количество"
        aria-invalid={!valid}
        min={offer.multiplicity}
        step={offer.multiplicity}
        max={max}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          add.reset();
        }}
        className="h-8 w-16 px-2 text-right tabular-nums aria-invalid:border-destructive"
      />
      <Button
        type="submit"
        aria-label="В корзину"
        title="В корзину"
        disabled={offer.stock_id === "" || add.isPending}
        className="h-8 px-2"
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
      </Button>
      <Button
        type="button"
        aria-label="Принять на склад"
        title="Принять на склад"
        className="h-8 px-2"
        onClick={() => {
          onToStock(group, offer);
        }}
      >
        <PackagePlus aria-hidden="true" className="size-4" />
      </Button>
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
