import { Truck, Warehouse, Zap, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Link } from "react-router";

import type { StockSearchItem } from "@/api/search";
import { formatPrice } from "@/features/stock/format";

import { stockForPart, type Best } from "./derive";
import { formatDelivery, warehouseLabel } from "./format";
import { Skeleton } from "./Tag";

type Props = {
  stock: StockSearchItem[] | undefined;
  stockError: boolean;
  partKey: string;
  best: { cheapest: Best | null; fastest: Best | null };
  pending: boolean;
  now: Date;
};

function Block({
  icon: Icon,
  title,
  busy,
  value,
  sub,
}: {
  icon: LucideIcon;
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
      className="flex min-w-0 items-center gap-3.5 px-5 py-3.5"
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.6}
        className="size-[34px] shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id={id} className="text-[13px] text-muted-foreground">
          {title}
        </h3>
        {busy ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="w-40 max-w-full" />
          </div>
        ) : (
          <>
            <div className="text-[17px] font-[650] tabular-nums [overflow-wrap:anywhere]">
              {value}
            </div>
            {sub !== undefined && (
              <div className="text-[12.5px] text-soft-foreground [overflow-wrap:anywhere]">
                {sub}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const partName = (b: Best) => `${b.group.brand} ${b.group.number}`;

type StockProps = {
  stock: StockSearchItem[] | undefined;
  stockError: boolean;
  // Without a part (no supplier cards) every item of the number is shown.
  partKey?: string;
};

function MyStock({ stock, stockError, partKey }: StockProps) {
  const exact =
    stock === undefined || partKey === undefined
      ? []
      : stockForPart(stock, partKey);
  // Same number under a brand we do not know as this one: show it anyway.
  const mine = exact.length > 0 ? exact : (stock ?? []);
  const qty = mine.reduce((sum, it) => sum + it.qty, 0);
  const cells = [
    ...new Set(mine.flatMap((it) => (it.cell ? [it.cell] : []))),
  ].join(", ");
  const first = mine.at(0);
  return (
    <Block
      icon={Warehouse}
      title="Мой склад"
      busy={stock === undefined && !stockError}
      value={
        stockError ? (
          <span className="text-destructive">Склад недоступен</span>
        ) : first === undefined ? (
          "—"
        ) : (
          `${String(qty)} шт`
        )
      }
      sub={
        !stockError && first !== undefined ? (
          <>
            {cells !== "" && (
              <>
                <span className="font-mono">{cells}</span>
                {" · "}
              </>
            )}
            <Link
              to={`/stock?item=${String(first.id)}`}
              className="rounded-sm text-link hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              Открыть на складе →
            </Link>
          </>
        ) : undefined
      }
    />
  );
}

// «Мой склад» alone: shown when no supplier has a card for the number.
export function MyStockBlock(props: StockProps) {
  return (
    <div className="rounded-[10px] border bg-card text-card-foreground">
      <MyStock {...props} />
    </div>
  );
}

// Step 2: my stock of the part, the cheapest and the fastest offer of the
// chosen supplier.
export function SummaryPanel({
  stock,
  stockError,
  partKey,
  best,
  pending,
  now,
}: Props) {
  const { cheapest, fastest } = best;

  return (
    <div className="grid rounded-[10px] border bg-card text-card-foreground md:grid-cols-3 md:divide-x max-md:divide-y">
      <MyStock stock={stock} stockError={stockError} partKey={partKey} />
      <Block
        icon={Truck}
        title="Дешевле всего"
        busy={pending}
        value={
          cheapest === null
            ? "—"
            : `${formatPrice(cheapest.offer.purchase_price)} ₽`
        }
        sub={
          cheapest === null
            ? undefined
            : [
                partName(cheapest),
                warehouseLabel(cheapest.offer),
                formatDelivery(cheapest.offer, now),
              ].join(" · ")
        }
      />
      <Block
        icon={Zap}
        title="Быстрее всего"
        busy={pending}
        value={fastest === null ? "—" : formatDelivery(fastest.offer, now)}
        sub={
          fastest === null
            ? undefined
            : [
                `${formatPrice(fastest.offer.purchase_price)} ₽`,
                partName(fastest),
                warehouseLabel(fastest.offer),
              ].join(" · ")
        }
      />
    </div>
  );
}
