import { Trash2 } from "lucide-react";
import { Fragment } from "react";
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

// Wraps only after "/" (CITROEN/ PEUGEOT), never inside a word.
function Brand({ name }: { name: string }) {
  const parts = name.split("/");
  return parts.map((part, i) => (
    <Fragment key={`${part}|${String(i)}`}>
      {i > 0 && <wbr />}
      {i < parts.length - 1 ? `${part}/` : part}
    </Fragment>
  ));
}

function Price({
  item,
  info,
  className,
}: {
  item: CartItem;
  info: CartRefreshItem | undefined;
  className?: string;
}) {
  const changed =
    info?.state === "ok" &&
    info.previous_price !== null &&
    info.previous_price !== info.price;
  return (
    <div className={cn("text-right tabular-nums", className)}>
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
      <div className="flex items-baseline gap-x-2 md:contents">
        <span className="font-semibold md:order-1">
          <Brand name={item.brand} />
        </span>
        <Link
          to={`/?q=${encodeURIComponent(item.number)}`}
          className="font-mono font-semibold text-primary [overflow-wrap:anywhere] hover:underline md:order-2"
        >
          {item.number}
        </Link>
      </div>
      <div className="min-w-0 [overflow-wrap:anywhere] md:order-3">
        {item.name}
        {gone && (
          <div className="text-[12px] font-medium text-status-out">
            нет в наличии
          </div>
        )}
        {short && (
          <div className="text-[12px] font-medium text-status-low">
            {`в наличии ${String(info.available)} шт`}
          </div>
        )}
      </div>
      <div className="min-w-0 md:order-4">
        <div className="whitespace-nowrap">{formatDelivery(item, now)}</div>
        <div
          title={where}
          className="truncate text-[12px] text-muted-foreground"
        >
          {where}
        </div>
      </div>
      <div className="flex items-start gap-x-2 md:contents">
        <div className="md:order-6">
          <CartQtyField key={item.qty} item={item} />
        </div>
        <span aria-hidden="true" className="pt-2 md:hidden">
          ×
        </span>
        <Price item={item} info={info} className="pt-1 md:order-5 md:pt-0" />
        <span aria-hidden="true" className="pt-2 md:hidden">
          =
        </span>
        <div className="pt-1 text-right font-semibold whitespace-nowrap tabular-nums md:order-7 md:pt-0">
          {formatPrice(item.sum)} ₽
        </div>
        <div className="ml-auto flex flex-col items-end md:order-8 md:ml-0 md:items-start">
          <button
            type="button"
            aria-label="Удалить"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(item.id);
            }}
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-selected hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
          {remove.isError && (
            <p role="alert" className="text-[12px] text-destructive">
              {remove.error.message}
            </p>
          )}
        </div>
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
