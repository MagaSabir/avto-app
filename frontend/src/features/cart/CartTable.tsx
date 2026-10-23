import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import {
  useRemoveCartItem,
  type CartItem,
  type CartRefreshItem,
} from "@/api/cart";
import {
  formatDelivery,
  kindLabel,
  warehouseLabel,
} from "@/features/search/format";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import { CartQtyField } from "./CartQtyField";

const COLS =
  "md:grid-cols-[6rem_9rem_minmax(0,1fr)_12rem_8rem_5.5rem_7rem_2.5rem] md:gap-x-3";

const HEADERS = [
  { key: "brand", label: "Бренд" },
  { key: "number", label: "Номер" },
  { key: "name", label: "Название" },
  { key: "where", label: "Склад и срок" },
  { key: "price", label: "Цена", right: true },
  { key: "qty", label: "Кол-во", right: true },
  { key: "sum", label: "Сумма", right: true },
  { key: "remove", label: "" },
];

function Price({
  item,
  info,
}: {
  item: CartItem;
  info: CartRefreshItem | undefined;
}) {
  const changed =
    info?.state === "ok" &&
    info.previous_price !== null &&
    info.previous_price !== info.price;
  return (
    <div className="text-right tabular-nums">
      {changed && info.previous_price !== null && (
        <s className="mr-1.5 text-[12px] text-muted-foreground">
          {formatPrice(info.previous_price)}
        </s>
      )}
      <span className="font-semibold whitespace-nowrap">
        {formatPrice(changed ? info.price : item.price)} ₽
      </span>
      {item.kind !== "normal" && (
        <div className="text-[12px] whitespace-nowrap text-muted-foreground">
          {kindLabel(item)}
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  info,
  now,
}: {
  item: CartItem;
  info: CartRefreshItem | undefined;
  now: Date;
}) {
  const remove = useRemoveCartItem();
  const where = warehouseLabel(item);
  const gone = info?.state === "gone";
  const short = info?.state === "ok" && item.qty > info.available;
  return (
    <li
      className={cn(
        "flex flex-col gap-1 border-b px-2 py-2 last:border-b-0 hover:bg-muted md:grid md:items-start md:gap-y-0.5",
        COLS,
      )}
    >
      <span className="font-semibold [overflow-wrap:anywhere]">
        {item.brand}
      </span>
      <Link
        to={`/?q=${encodeURIComponent(item.number)}`}
        className="font-mono font-semibold text-primary [overflow-wrap:anywhere] hover:underline"
      >
        {item.number}
      </Link>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        {item.name}
        {gone && (
          <div className="text-[12px] font-medium text-status-none">
            нет в наличии
          </div>
        )}
        {short && (
          <div className="text-[12px] font-medium text-status-low">
            {`в наличии ${String(info.available)} шт`}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="whitespace-nowrap">{formatDelivery(item, now)}</div>
        <div
          title={where}
          className="truncate text-[12px] text-muted-foreground"
        >
          {where}
        </div>
      </div>
      <Price item={item} info={info} />
      <div className="flex items-center justify-between gap-3 md:contents">
        <CartQtyField key={item.qty} item={item} />
        <div className="text-right font-semibold whitespace-nowrap tabular-nums">
          {formatPrice(item.sum)} ₽
        </div>
      </div>
      <div className="flex flex-col items-end md:items-start">
        <button
          type="button"
          aria-label="Удалить"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(item.id);
          }}
          className="flex size-9 cursor-pointer items-center justify-center self-end rounded-lg text-muted-foreground hover:bg-selected hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:self-start"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
        {remove.isError && (
          <p role="alert" className="text-[12px] text-destructive">
            {remove.error.message}
          </p>
        )}
      </div>
    </li>
  );
}

export function CartTable({
  items,
  refreshed,
  now,
}: {
  items: CartItem[];
  refreshed: Map<number, CartRefreshItem> | undefined;
  now: Date;
}) {
  return (
    <div>
      <div
        aria-hidden="true"
        className={cn(
          "hidden border-b px-2 py-1.5 text-[12px] font-medium text-muted-foreground md:grid",
          COLS,
        )}
      >
        {HEADERS.map((h) => (
          <span key={h.key} className={h.right ? "text-right" : ""}>
            {h.label}
          </span>
        ))}
      </div>
      <ul>
        {items.map((it) => (
          <Row key={it.id} item={it} info={refreshed?.get(it.id)} now={now} />
        ))}
      </ul>
    </div>
  );
}
