import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { Offer, PartGroup } from "@/api/search";
import { useSupplierVariants } from "@/api/search";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import { formatDelivery, plural, qtyLabel, warehouseLabel } from "./format";

type Props = {
  supplier: string;
  group: PartGroup;
  // The part's offers in display order.
  offers: Offer[];
  current: Offer;
  onSelect: (o: Offer) => void;
  now: Date;
};

const COLS = "grid grid-cols-[minmax(0,1.6fr)_1fr_0.6fr_0.8fr] gap-x-2.5";
const LINK =
  "cursor-pointer rounded-sm text-[12.5px] whitespace-nowrap text-link hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none";

// Code_Info answers: an order variant has no warehouse of ours to name.
export const variantLabel = (o: Offer) =>
  o.kind === "order" ? "Под заказ" : warehouseLabel(o);

// The «Склад» cell: the current warehouse and a list of the others (or of
// Mikado's delivery variants, asked only when opened).
export function WarehousePicker({
  supplier,
  offers,
  current,
  onSelect,
  now,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // A variant picked earlier is not one of the part's offers: its list is
  // still the variants of the row it came from.
  const variantsRow =
    current.kind === "variants"
      ? current
      : offers.includes(current)
        ? undefined
        : (offers.find(
            (o) => o.kind === "variants" && o.order_code === current.order_code,
          ) ?? offers.find((o) => o.kind === "variants"));
  const orderCode = variantsRow?.order_code ?? "";
  const q = useSupplierVariants(
    supplier,
    orderCode,
    open && variantsRow !== undefined,
  );
  const variants = useMemo(
    () =>
      (q.data?.offers ?? []).map((v) => ({
        ...v,
        order_code: v.order_code ?? orderCode,
      })),
    [q.data, orderCode],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = offers.length - 1;
  const label =
    variantsRow !== undefined
      ? "варианты поставки ▾"
      : others > 0
        ? `и ещё ${String(others)} ${plural(others, "склад", "склада", "складов")} ▾`
        : null;
  const isSame = (o: Offer) =>
    o === current ||
    (variantsRow !== undefined &&
      current !== variantsRow &&
      // Variants may share a stock id: match the whole offer.
      o.stock_id === current.stock_id &&
      o.delivery_from === current.delivery_from &&
      o.purchase_price === current.purchase_price);
  const pick = (o: Offer) => {
    onSelect(o);
    setOpen(false);
  };

  return (
    // Phones: the list spans the row card (the row is its anchor), so it never
    // leaves the screen; desktop: under the cell.
    <div ref={ref} className="min-w-0 md:relative">
      <span className="text-[13.5px] [overflow-wrap:anywhere]">
        {current.kind !== "variants" && (
          <>
            <span>
              {variantsRow !== undefined
                ? variantLabel(current)
                : warehouseLabel(current)}
            </span>{" "}
          </>
        )}
        {label !== null && (
          <button
            ref={toggle}
            type="button"
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-expanded={open}
            onClick={() => {
              setOpen((v) => !v);
            }}
            className={LINK}
          >
            {label}
          </button>
        )}
      </span>
      {open && (
        <div className="absolute inset-x-2 z-20 mt-1 md:inset-x-auto md:top-full md:left-0 md:w-[min(520px,calc(100vw-2rem))] rounded-[10px] border border-border-active bg-card p-1.5 text-[13px] shadow-xl">
          {variantsRow === undefined ? (
            <>
              <Header last="Остаток" />
              <div id={listId} role="listbox" aria-label="Склады">
                {offers.map((o, i) => (
                  <Option
                    key={`${o.stock_id}|${o.delivery_from ?? ""}|${String(i)}`}
                    selected={isSame(o)}
                    onPick={() => {
                      pick(o);
                    }}
                    cells={[
                      o.kind === "variants"
                        ? "варианты поставки"
                        : warehouseLabel(o),
                      o.kind === "variants" ? "—" : formatDelivery(o, now),
                      o.kind === "variants" ? "—" : qtyLabel(o),
                      `${o.kind === "variants" ? "от " : ""}${formatPrice(o.purchase_price)} ₽`,
                    ]}
                  />
                ))}
              </div>
            </>
          ) : q.isPending ? (
            <p className="px-2.5 py-2 text-muted-foreground">Загрузка…</p>
          ) : q.isError || q.data.status === "error" ? (
            <p role="alert" className="px-2.5 py-2 text-destructive">
              {q.isError
                ? q.error.message
                : (q.data.message ?? "Ошибка поставщика")}
            </p>
          ) : (
            <>
              {q.data.message !== null && (
                <p className="px-2.5 py-1.5 text-muted-foreground [overflow-wrap:anywhere]">
                  {q.data.message}
                </p>
              )}
              <Header last="Рейтинг" />
              <div id={listId} role="listbox" aria-label="Варианты поставки">
                {variants.map((v, i) => (
                  <Option
                    key={`${v.stock_id}|${String(i)}`}
                    selected={isSame(v)}
                    onPick={() => {
                      pick(v);
                    }}
                    cells={[
                      variantLabel(v),
                      formatDelivery(v, now),
                      v.rating === null || v.rating === undefined
                        ? "—"
                        : `${String(v.rating)} %`,
                      `${formatPrice(v.purchase_price)} ₽`,
                    ]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ last }: { last: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(COLS, "px-2.5 py-1.5 text-[12px] text-muted-foreground")}
    >
      <span>Склад</span>
      <span>Срок</span>
      <span>{last}</span>
      <span className="text-right">Цена</span>
    </div>
  );
}

function Option({
  selected,
  onPick,
  cells,
}: {
  selected: boolean;
  onPick: () => void;
  cells: [string, string, string, string];
}) {
  const [where, term, third, price] = cells;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        COLS,
        "w-full cursor-pointer items-center rounded-[7px] px-2.5 py-2 text-left hover:bg-selected focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
        selected && "bg-selected",
      )}
    >
      <span className="[overflow-wrap:anywhere]">{where}</span>
      <span>{term}</span>
      <span className="tabular-nums">{third}</span>
      <span className="text-right font-semibold whitespace-nowrap tabular-nums">
        {price}
      </span>
    </button>
  );
}
