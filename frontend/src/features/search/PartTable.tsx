import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import type { Offer, PartGroup, SupplierInfo } from "@/api/search";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import {
  defaultOffer,
  sortGroups,
  sortOffers,
  type Best,
  type SortMode,
} from "./derive";
import { formatDelivery, kindLabel, qtyLabel } from "./format";
import { OfferActions } from "./OfferActions";
import { Tag } from "./Tag";
import type { ReceiptPart } from "./ToStockDialog";
import { WarehousePicker } from "./WarehousePicker";

export type OnToStock = (
  group: ReceiptPart,
  offer: Offer,
  supplierTitle: string,
) => void;

type BestPair = { cheapest: Best | null; fastest: Best | null };

type Props = {
  title: "Оригинал" | "Аналоги";
  groups: PartGroup[];
  supplier: SupplierInfo;
  sort: SortMode;
  best: BestPair;
  stockQty: (key: string) => number;
  now: Date;
  limit?: number;
  onToStock: OnToStock;
};

const STEP = 20;

// Desktop: one grid line per part. Phone: a card — part and price on top,
// warehouse and term below, the actions last.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 [grid-template-areas:'id_price'_'wh_price'_'meta_price'_'act_act'] md:grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_270px] md:gap-y-0 md:[grid-template-areas:'brand_part_wh_term_qty_price_act']";

// Kinds already told by the quantity or the price need no note.
const QUIET_KINDS = new Set<Offer["kind"]>(["normal", "order", "variants"]);

const HEADERS = [
  "Бренд",
  "Номер / название",
  "Склад",
  "Срок",
  "Остаток",
  "Цена",
  "Количество",
];

export function PartTable({
  title,
  groups,
  supplier,
  sort,
  best,
  stockQty,
  now,
  limit,
  onToStock,
}: Props) {
  const id = useId();
  const [shown, setShown] = useState(limit ?? Infinity);
  const sorted = sortGroups(groups, sort, now);
  const visible = sorted.slice(0, shown);
  const heading =
    title === "Аналоги" ? `Аналоги · ${String(groups.length)}` : title;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-[16px] font-semibold">
        {heading}
      </h3>
      <div className="rounded-[10px] border bg-card text-[13.5px] text-card-foreground">
        <div
          aria-hidden="true"
          className={cn(
            ROW_GRID,
            "hidden px-4 py-2 text-[12.5px] text-muted-foreground md:grid",
          )}
        >
          {HEADERS.map((h, i) => (
            <span
              key={h}
              className={cn(
                i === HEADERS.length - 1 &&
                  "w-[112px] justify-self-end text-center",
              )}
            >
              {h}
            </span>
          ))}
        </div>
        <ul>
          {visible.map((g) => (
            <PartRow
              key={g.key}
              group={g}
              supplier={supplier}
              sort={sort}
              best={best}
              mine={title === "Аналоги" ? stockQty(g.key) : 0}
              now={now}
              onToStock={onToStock}
            />
          ))}
        </ul>
        {sorted.length > shown && (
          <button
            type="button"
            onClick={() => {
              setShown((n) => n + STEP);
            }}
            className="mx-4 mt-2.5 mb-3 flex w-[calc(100%-2rem)] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-border-active py-2 text-[13px] text-soft-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
            {`Показать ещё ${String(STEP)} (из ${String(sorted.length)})`}
          </button>
        )}
      </div>
    </section>
  );
}

function PartRow({
  group,
  supplier,
  sort,
  best,
  mine,
  now,
  onToStock,
}: {
  group: PartGroup;
  supplier: SupplierInfo;
  sort: SortMode;
  best: BestPair;
  mine: number;
  now: Date;
  onToStock: OnToStock;
}) {
  // A manual choice lives until the sort changes.
  const [chosen, setChosen] = useState<Offer | null>(null);
  const [chosenSort, setChosenSort] = useState(sort);
  if (chosenSort !== sort) {
    setChosenSort(sort);
    setChosen(null);
  }
  const offer = chosen ?? defaultOffer(group, sort, now);
  const variants = offer?.kind === "variants";

  return (
    <li
      className={cn(ROW_GRID, "relative border-t px-4 py-2.5 md:items-center")}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 [grid-area:id] md:contents">
        <span className="font-semibold [overflow-wrap:anywhere] md:[grid-area:brand]">
          {group.brand}
        </span>
        <div className="min-w-0 md:[grid-area:part]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-[14px] font-[650] [overflow-wrap:anywhere]">
              {group.number}
            </span>
            {mine > 0 && <Tag tone="ok">{`у вас ${String(mine)} шт`}</Tag>}
          </div>
          {group.name !== "" && (
            <div
              title={group.name}
              className="line-clamp-2 text-[12px] text-soft-foreground [overflow-wrap:anywhere]"
            >
              {group.name}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 [grid-area:wh]">
        {offer === undefined ? (
          <span className="text-soft-foreground">нет предложений</span>
        ) : (
          <WarehousePicker
            supplier={supplier.code}
            group={group}
            offers={sortOffers(group.offers, sort, now)}
            current={offer}
            onSelect={setChosen}
            now={now}
          />
        )}
      </div>
      {offer !== undefined && (
        <div className="flex flex-wrap gap-x-3 text-[13px] text-soft-foreground [grid-area:meta] md:contents md:text-foreground">
          <span className="md:[grid-area:term]">
            {variants ? "—" : formatDelivery(offer, now)}
          </span>
          <span className="tabular-nums md:[grid-area:qty]">
            {variants ? "—" : qtyLabel(offer)}
            {offer.multiplicity > 1 && (
              <span className="block text-[12px] text-muted-foreground">
                {`по ${String(offer.multiplicity)} шт`}
              </span>
            )}
          </span>
        </div>
      )}
      <div className="flex flex-col items-end text-right [grid-area:price] md:items-start md:text-left">
        {offer !== undefined && best.cheapest?.offer === offer && (
          <span className="mb-0.5 rounded-[4px] bg-status-ok-bg px-1.5 py-px text-[11px] font-semibold text-status-ok">
            Дешевле всех
          </span>
        )}
        {offer !== undefined && best.fastest?.offer === offer && (
          <span className="mb-0.5 rounded-[4px] bg-info-bg px-1.5 py-px text-[11px] font-semibold text-info">
            Быстрее всех
          </span>
        )}
        <span className="text-[15px] font-bold whitespace-nowrap tabular-nums">
          {offer === undefined
            ? "—"
            : `${variants ? "от " : ""}${formatPrice(offer.purchase_price)} ₽`}
        </span>
        {offer !== undefined && !QUIET_KINDS.has(offer.kind) && (
          <span className="text-[12px] whitespace-nowrap text-muted-foreground">
            {kindLabel(offer)}
          </span>
        )}
      </div>
      {offer !== undefined && (
        <div className="min-w-0 pt-1 [grid-area:act] md:pt-0">
          <OfferActions
            // A new offer starts the stepper over.
            key={`${offer.stock_id}|${offer.warehouse}|${offer.delivery_from ?? ""}|${offer.purchase_price}`}
            supplier={supplier.code}
            group={group}
            offer={offer}
            disabled={variants}
            onToStock={(g, o) => {
              onToStock(g, o, supplier.title);
            }}
          />
        </div>
      )}
    </li>
  );
}
