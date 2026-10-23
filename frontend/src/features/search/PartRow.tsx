import { useState } from "react";

import type { Offer, PartGroup } from "@/api/search";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import { formatDelivery, kindLabel, warehouseLabel } from "./format";
import { OfferActions } from "./OfferActions";
import { Tag } from "./Tag";

// Brand · Number · Name · Delivery · Qty · Price · Actions. Shared with the header row.
export const PART_COLS =
  "md:grid-cols-[8rem_9rem_minmax(0,1fr)_13rem_5rem_8rem_13rem] md:gap-x-3";

// On phones the three offer cells share one line.
const OFFER_LINE = "grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3";

type Props = {
  supplier: string;
  onToStock: (group: PartGroup, offer: Offer) => void;
  // Offers already sorted: the first one is the best for the current sort.
  group: PartGroup;
  stockQty: number | undefined;
  now: Date;
};

function OfferCells({
  supplier,
  group,
  offer,
  now,
  first,
  onToStock,
}: {
  supplier: string;
  group: PartGroup;
  offer: Offer;
  now: Date;
  first?: string;
  onToStock: (group: PartGroup, offer: Offer) => void;
}) {
  const where = warehouseLabel(offer);
  return (
    <>
      <div className={cn("min-w-0", first)}>
        <div className="whitespace-nowrap">{formatDelivery(offer, now)}</div>
        <div
          title={where}
          className="truncate text-[12px] text-muted-foreground"
        >
          {where}
        </div>
      </div>
      <div className="text-right tabular-nums">
        <div className="whitespace-nowrap">{offer.qty} шт</div>
        {offer.multiplicity > 1 && (
          <div className="text-[12px] whitespace-nowrap text-muted-foreground">
            по {offer.multiplicity} шт
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="font-semibold whitespace-nowrap tabular-nums">
          {formatPrice(offer.purchase_price)} ₽
        </div>
        {offer.kind !== "normal" && (
          <div className="text-[12px] whitespace-nowrap text-muted-foreground">
            {kindLabel(offer)}
          </div>
        )}
      </div>
      <div className="col-span-3 md:col-span-1">
        <OfferActions
          supplier={supplier}
          group={group}
          offer={offer}
          onToStock={onToStock}
        />
      </div>
    </>
  );
}

export function PartRow({ supplier, group, stockQty, now, onToStock }: Props) {
  const [open, setOpen] = useState(false);
  const best = group.offers.at(0);
  const rest = group.offers.slice(1);

  return (
    <li className="border-b last:border-b-0">
      <div
        className={cn(
          "flex flex-col gap-1 px-2 py-2 hover:bg-muted md:grid md:min-h-9 md:items-start md:gap-y-0.5",
          PART_COLS,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
          <span className="font-semibold [overflow-wrap:anywhere]">
            {group.brand}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-start md:gap-0.5">
            <span className="font-mono font-semibold [overflow-wrap:anywhere]">
              {group.number}
            </span>
            {!group.is_requested && <Tag tone="analog">аналог</Tag>}
            {stockQty !== undefined && stockQty > 0 && (
              <Tag tone="ok">у вас {stockQty} шт</Tag>
            )}
          </div>
        </div>
        <div className="min-w-0 [overflow-wrap:anywhere]">{group.name}</div>
        {best === undefined ? (
          <div className="md:col-start-6 md:text-right">
            <div className="font-semibold">—</div>
            <div className="text-[12px] text-muted-foreground">
              нет в наличии
            </div>
          </div>
        ) : (
          <div className={cn(OFFER_LINE, "md:contents")}>
            <OfferCells
              supplier={supplier}
              group={group}
              offer={best}
              now={now}
              onToStock={onToStock}
            />
            {rest.length > 0 && (
              <div className="col-span-3 md:col-span-2 md:col-start-4 md:text-right">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`Другие склады: ${String(rest.length)}`}
                  onClick={() => {
                    setOpen((v) => !v);
                  }}
                  className="cursor-pointer rounded-sm text-[12px] text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                >
                  {open
                    ? "скрыть"
                    : `показать др. склады (${String(rest.length)})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {open && rest.length > 0 && (
        <ul aria-label="Другие склады">
          {rest.map((o, i) => (
            <li
              key={`${o.warehouse}|${o.delivery_from ?? ""}|${String(i)}`}
              className={cn(
                OFFER_LINE,
                "border-t border-dashed py-1.5 pr-2 pl-6 md:pl-2",
                PART_COLS,
              )}
            >
              <OfferCells
                supplier={supplier}
                group={group}
                offer={o}
                now={now}
                first="md:col-start-4"
                onToStock={onToStock}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
