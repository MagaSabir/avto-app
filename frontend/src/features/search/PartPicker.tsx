import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

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
  const parts: ReactNode[] = [
    <span key="s" className="text-link font-medium">
      {card.title}
    </span>,
    // Parts without data are left out: no «0 аналогов».
    ...(analogs > 0
      ? [
          <span key="a">
            {`${String(analogs)} ${plural(analogs, "аналог", "аналога", "аналогов")}`}
          </span>,
        ]
      : []),
    ...(qty > 0
      ? [
          <span key="q">
            {"у вас "}
            <span className="font-semibold text-link">{`${String(qty)} шт`}</span>
          </span>,
        ]
      : []),
  ];
  return (
    <button
      type="button"
      onClick={() => {
        onPick(card.supplier, group.key);
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 md:grid md:grid-cols-[140px_minmax(0,2fr)_minmax(0,1fr)_24px] md:gap-x-4 rounded-[10px] border bg-card px-5 py-[18px] text-left hover:border-border-active hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
        minPrice === null && "opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1 md:contents">
        <span
          className="truncate text-[17px] font-medium md:self-start text-soft-foreground"
          title={group.brand}
        >
          {group.brand}
        </span>{" "}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[17px] font-[650] text-foreground [overflow-wrap:anywhere]">
            {group.number}
          </span>
          {group.name !== "" && (
            <span className="text-[13px] text-link [overflow-wrap:anywhere]">
              {group.name}
            </span>
          )}
          <span className="flex flex-wrap items-center text-[13px] text-soft-foreground">
            {parts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span aria-hidden="true" className="px-1">
                    {" · "}
                  </span>
                )}
                {part}
              </Fragment>
            ))}
          </span>
        </span>
        <span className="flex flex-col md:items-start md:self-start">
          {minPrice === null ? (
            <span className="text-[20px] font-bold">—</span>
          ) : (
            <>
              <span className="whitespace-nowrap tabular-nums">
                <span className="text-[13px]">от </span>
                <span className="text-[20px] font-bold">{`${formatPrice(minPrice)} ₽`}</span>
              </span>
              <span className="text-[13px] whitespace-nowrap text-soft-foreground">
                {fastest === null
                  ? "варианты поставки"
                  : formatDelivery(fastest, now)}
              </span>
            </>
          )}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-link md:justify-self-end"
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
        <h2 className="text-[20px] font-bold">
          {`Найдено ${String(n)} ${plural(n, "деталь", "детали", "деталей")}`}
        </h2>
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
          <p className="text-destructive [overflow-wrap:anywhere]">
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
