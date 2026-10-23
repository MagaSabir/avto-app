import { useState, type ReactNode } from "react";

import type { Offer, PartGroup } from "@/api/search";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import {
  cents,
  isPriced,
  type MergedGroup,
  type SupplierOffers,
} from "./derive";
import {
  formatDelivery,
  kindLabel,
  plural,
  qtyLabel,
  warehouseLabel,
} from "./format";
import { OfferActions } from "./OfferActions";
import { Tag } from "./Tag";
import type { ReceiptPart } from "./ToStockDialog";

// Brand · Number · Name · Delivery · Qty · Price · Actions. Shared with the header row.
export const PART_COLS =
  "md:grid-cols-[8rem_9rem_minmax(0,1fr)_13rem_5rem_8rem_13rem] md:gap-x-3";

// On phones the three offer cells share one line.
const OFFER_LINE = "grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3";

type Props = {
  // Offers already sorted per supplier: the first one is the best for the
  // current sort.
  group: MergedGroup;
  stockQty: number | undefined;
  now: Date;
  // Receipts take the part as shown; the cart keeps the supplier's spelling.
  onToStock: (group: ReceiptPart, offer: Offer, supplierTitle: string) => void;
};

// Kinds already told by the quantity or the actions need no note.
const QUIET_KINDS = new Set<Offer["kind"]>(["normal", "order", "variants"]);

function OfferCells({
  supplier,
  group,
  offer,
  now,
  first,
  aside,
  onToStock,
}: {
  supplier: string;
  group: PartGroup;
  offer: Offer;
  now: Date;
  first?: string;
  // Phone: sits on the right of the actions row; desktop: its own grid cell.
  aside?: ReactNode;
  onToStock: (group: PartGroup, offer: Offer) => void;
}) {
  const where = warehouseLabel(offer);
  const variants = offer.kind === "variants";
  return (
    <>
      <div className={cn("min-w-0", first)}>
        <div className="whitespace-nowrap">
          {variants ? "—" : formatDelivery(offer, now)}
        </div>
        <div
          title={where}
          className="truncate text-[12px] text-muted-foreground"
        >
          {where}
        </div>
      </div>
      <div className="text-right tabular-nums">
        {!variants && (
          <div className="whitespace-nowrap">{qtyLabel(offer)}</div>
        )}
        {offer.multiplicity > 1 && (
          <div className="text-[12px] whitespace-nowrap text-muted-foreground">
            по {offer.multiplicity} шт
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="font-semibold whitespace-nowrap tabular-nums">
          {variants && "от "}
          {formatPrice(offer.purchase_price)} ₽
        </div>
        {!QUIET_KINDS.has(offer.kind) && (
          <div className="text-[12px] whitespace-nowrap text-muted-foreground">
            {kindLabel(offer)}
          </div>
        )}
      </div>
      <div className="col-span-3 flex items-start gap-x-2 md:contents">
        <div className="min-w-0 flex-1 md:col-span-1">
          <OfferActions
            supplier={supplier}
            group={group}
            offer={offer}
            onToStock={onToStock}
          />
        </div>
        {aside}
      </div>
    </>
  );
}

// «Росско · 3 склада · от 513 ₽»
function sectionTitle({ title, offers }: SupplierOffers): string {
  if (offers.length === 0) return `${title} · нет в наличии`;
  const n = offers.length;
  let min: string | null = null;
  for (const o of offers.filter(isPriced))
    if (min === null || cents(o.purchase_price) < cents(min))
      min = o.purchase_price;
  const from = min === null ? "" : ` · от ${formatPrice(min)} ₽`;
  return `${title} · ${String(n)} ${plural(n, "склад", "склада", "складов")}${from}`;
}

function SupplierSection({
  supplier,
  now,
  onToStock,
}: {
  supplier: SupplierOffers;
  now: Date;
  onToStock: (group: PartGroup, offer: Offer) => void;
}) {
  const [open, setOpen] = useState(false);
  const best = supplier.offers.at(0);
  const rest = supplier.offers.slice(1);
  const cells = {
    supplier: supplier.code,
    group: supplier.group,
    now,
    onToStock,
  };
  const row = "py-1.5 pr-2 pl-6 md:pl-2";

  return (
    <div role="group" aria-label={supplier.title}>
      {/* Phone: the header is its own line; desktop: it fills the part
          columns of the best offer's row. */}
      <div className={cn(OFFER_LINE, row, "border-t border-dashed", PART_COLS)}>
        <div className="col-span-3 text-[12.5px] font-medium text-muted-foreground md:pt-0.5">
          {sectionTitle(supplier)}
        </div>
        {best !== undefined && (
          <OfferCells
            {...cells}
            offer={best}
            first="md:col-start-4"
            aside={
              rest.length > 0 && (
                <div className="ml-auto flex h-8 shrink-0 items-center md:col-span-2 md:col-start-4 md:ml-0 md:block md:h-auto md:text-right">
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
              )
            }
          />
        )}
      </div>
      {open && rest.length > 0 && (
        <ul aria-label="Другие склады">
          {rest.map((o, i) => (
            <li
              key={`${o.stock_id}|${o.delivery_from ?? ""}|${String(i)}`}
              className={cn(
                OFFER_LINE,
                row,
                "border-t border-dashed",
                PART_COLS,
              )}
            >
              <OfferCells {...cells} offer={o} first="md:col-start-4" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartRow({ group, stockQty, now, onToStock }: Props) {
  return (
    <li className="border-b last:border-b-0">
      <div
        className={cn(
          "flex flex-col gap-1 px-2 py-2 md:grid md:items-start md:gap-y-0.5",
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
      </div>
      {group.suppliers.map((s) => (
        <SupplierSection
          key={s.code}
          supplier={s}
          now={now}
          onToStock={(_supplierGroup, o) => {
            onToStock(group, o, s.title);
          }}
        />
      ))}
    </li>
  );
}
