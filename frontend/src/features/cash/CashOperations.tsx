import { Link } from "react-router";

import type { CashOperation } from "@/api/cash";
import {
  formatPrice,
  formatShortDateTime,
  PAYMENT_LABELS,
} from "@/features/stock/format";
import { MoveTypeBadge } from "@/features/stock/MoveTypeBadge";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

// Desktop: one grid row per operation; phone: a wrapped card.
const ROW =
  "grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 px-3 py-2 md:grid-cols-[5.5rem_6.5rem_7rem_8rem_minmax(0,1fr)_3rem_5.5rem_6rem_4.5rem_5.5rem_6rem] md:items-center";

const HEADERS = [
  "Время",
  "Операция",
  "Номер",
  "Бренд",
  "Название",
  "Кол-во",
  "Цена",
  "Сумма",
  "Оплата",
  "Прибыль",
  "Кто",
];

const RIGHT = new Set(["Кол-во", "Цена", "Сумма", "Прибыль"]);

export function CashOperations({
  operations,
  singleDay,
}: {
  operations: CashOperation[];
  singleDay: boolean;
}) {
  if (operations.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground">
        За этот период продаж нет
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card text-[13.5px]">
      <div
        className={cn(
          ROW,
          "hidden border-b text-[12px] text-muted-foreground md:grid",
        )}
      >
        {HEADERS.map((h) => (
          <span key={h} className={cn(RIGHT.has(h) && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {operations.map((op) => (
          <li key={op.move_id}>
            <Link
              to={`/stock?item=${String(op.item_id)}`}
              className={cn(ROW, "hover:bg-muted")}
            >
              <span className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                {singleDay
                  ? timeFmt.format(new Date(op.created_at))
                  : formatShortDateTime(op.created_at)}
              </span>
              <span className="justify-self-start">
                <MoveTypeBadge type={op.type} />
              </span>
              <span className="col-span-full font-mono font-semibold md:col-auto">
                {op.number_raw}
              </span>
              <span className="whitespace-nowrap">{op.brand}</span>
              <span className="min-w-0 truncate md:col-auto">{op.name}</span>
              <span className="text-right font-mono tabular-nums">
                {`${String(op.qty)} шт`}
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {`${formatPrice(op.price)} ₽`}
              </span>
              <span className="text-right font-semibold whitespace-nowrap tabular-nums">
                {`${formatPrice(op.amount)} ₽`}
              </span>
              <span>{op.payment ? PAYMENT_LABELS[op.payment] : "—"}</span>
              <span
                className={cn(
                  "text-right whitespace-nowrap tabular-nums",
                  op.profit?.startsWith("-") && "text-status-out",
                )}
              >
                {op.profit === null ? "—" : `${formatPrice(op.profit)} ₽`}
              </span>
              <span className="truncate text-muted-foreground">
                {op.user ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
