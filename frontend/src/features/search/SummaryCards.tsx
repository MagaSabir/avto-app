import { useId, type ReactNode } from "react";

import type { StockSearchItem, SupplierSearchResult } from "@/api/search";
import { formatPrice } from "@/features/stock/format";

import { cheapest, fastest, stockSummary, type Pick } from "./derive";
import { formatDelivery, plural } from "./format";
import { Skeleton } from "./Tag";

type Props = {
  items: StockSearchItem[] | undefined;
  stockFailed?: boolean;
  results: SupplierSearchResult[];
  pending: boolean;
  opts: { showAnalogs: boolean; now: Date };
};

function SummaryCard({
  title,
  busy,
  value,
  sub,
}: {
  title: string;
  busy: boolean;
  value: ReactNode;
  sub?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      aria-busy={busy}
      className="min-w-0 rounded-lg border bg-card p-3.5"
    >
      <h3 id={id} className="text-[12px] text-muted-foreground">
        {title}
      </h3>
      {busy ? (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="w-40 max-w-full" />
        </div>
      ) : (
        <>
          <div className="mt-1 text-[20px] font-semibold tabular-nums">
            {value}
          </div>
          {sub !== undefined && (
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              {sub}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PartName({ pick }: { pick: Pick }) {
  return (
    <>
      {pick.group.brand} <span className="font-mono">{pick.group.number}</span>
    </>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SummaryCards({
  items,
  stockFailed = false,
  results,
  pending,
  opts,
}: Props) {
  const mine = items === undefined ? null : stockSummary(items);
  const cheap = cheapest(results, opts.showAnalogs);
  const fast = fastest(results, opts.showAnalogs, opts.now);
  const title = (p: Pick) =>
    results.find((r) => r.code === p.supplier)?.title ?? p.supplier;

  const mineSub =
    mine === null || mine.minPrice === null
      ? undefined
      : [
          `от ${formatPrice(mine.minPrice)} ₽`,
          mine.cells.length > 0 &&
            `${mine.cells.length === 1 ? "ячейка" : "ячейки"} ${mine.cells.join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <SummaryCard
        title="Мой склад"
        busy={mine === null && !stockFailed}
        value={
          mine === null || mine.positions === 0 ? (
            "—"
          ) : (
            <>
              {mine.qty} шт
              <span className="text-[14px] font-normal text-muted-foreground">
                {" "}
                · {mine.positions}{" "}
                {plural(mine.positions, "позиция", "позиции", "позиций")}
              </span>
            </>
          )
        }
        sub={mineSub}
      />
      <SummaryCard
        title="Дешевле всего"
        busy={pending}
        value={cheap === null ? "—" : `${formatPrice(cheap.offer.price)} ₽`}
        sub={
          cheap === null ? undefined : (
            <>
              <PartName pick={cheap} /> · {title(cheap)} · {cheap.offer.qty} шт
            </>
          )
        }
      />
      <SummaryCard
        title="Быстрее всего"
        busy={pending}
        value={
          fast === null ? "—" : capitalize(formatDelivery(fast.offer, opts.now))
        }
        sub={
          fast === null ? undefined : (
            <>
              <PartName pick={fast} /> · {formatPrice(fast.offer.price)} ₽
            </>
          )
        }
      />
    </div>
  );
}
