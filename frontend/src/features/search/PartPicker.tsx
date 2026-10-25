import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import type { PartCard } from "./derive";
import { formatDelivery, plural } from "./format";
import { Skeleton } from "./Tag";

type Props = {
  cards: PartCard[];
  stockQty: (key: string) => number;
  now: Date;
  pending: { title: string }[];
  errors: { title: string; message: string; retry: () => void }[];
  onPick: (supplier: string, key: string) => void;
};

function Card({
  card,
  qty,
  now,
  onPick,
}: {
  card: PartCard;
  qty: number;
  now: Date;
  onPick: Props["onPick"];
}) {
  const { group, analogs, minPrice, fastest } = card;
  const summary = [
    card.title,
    // Parts without data are left out: no «0 аналогов».
    ...(analogs > 0
      ? [
          `${String(analogs)} ${plural(analogs, "аналог", "аналога", "аналогов")}`,
        ]
      : []),
    ...(qty > 0 ? [`у вас ${String(qty)} шт`] : []),
  ].join(" · ");
  return (
    <button
      type="button"
      onClick={() => {
        onPick(card.supplier, group.key);
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3.5 text-left hover:border-border-active hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
        minPrice === null && "opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
        <span
          className="text-[17px] font-semibold text-soft-foreground truncate md:w-[130px] md:shrink-0"
          title={group.brand}
        >
          {group.brand}
        </span>{" "}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-[650] [overflow-wrap:anywhere]">
            {group.number}
          </span>
          {group.name !== "" && (
            <span className="text-[13px] text-soft-foreground [overflow-wrap:anywhere]">
              {group.name}
            </span>
          )}
          <span className="text-[13px] text-link">{summary}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        {minPrice === null ? (
          <span className="text-[18px] font-bold">—</span>
        ) : (
          <>
            <span className="text-[18px] font-bold whitespace-nowrap tabular-nums">
              {`от ${formatPrice(minPrice)} ₽`}
            </span>
            <span className="text-[13px] whitespace-nowrap text-soft-foreground">
              {fastest === null
                ? "варианты поставки"
                : formatDelivery(fastest, now)}
            </span>
          </>
        )}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
    </button>
  );
}

// Step 1: a card per supplier's part; a card opens step 2.
export function PartPicker({
  cards,
  stockQty,
  now,
  pending,
  errors,
  onPick,
}: Props) {
  const n = cards.length;
  return (
    <div className="flex flex-col gap-3">
      {n > 0 && (
        <h3 className="text-[20px] font-bold">
          {`Найдено ${String(n)} ${plural(n, "деталь", "детали", "деталей")}`}
        </h3>
      )}
      {cards.map((card) => (
        <Card
          key={`${card.supplier}|${card.group.key}`}
          card={card}
          qty={stockQty(card.group.key)}
          now={now}
          onPick={onPick}
        />
      ))}
      {pending.map((p) => (
        <div
          key={p.title}
          aria-busy="true"
          className="flex flex-col gap-2 rounded-lg border bg-card p-3.5"
        >
          <span className="text-[13px] text-muted-foreground">
            {`${p.title} · ждём ответ…`}
          </span>
          <Skeleton className="w-2/3" />
          <Skeleton />
        </div>
      ))}
      {errors.map((e) => (
        <div key={e.title} className="flex flex-wrap items-center gap-3 py-1">
          <p className="text-status-out [overflow-wrap:anywhere]">
            <span className="font-medium">{e.title}: </span>
            <span>{e.message}</span>
          </p>
          <Button type="button" onClick={e.retry}>
            Повторить
          </Button>
        </div>
      ))}
    </div>
  );
}
