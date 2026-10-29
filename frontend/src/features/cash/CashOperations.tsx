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

// Wide screens: one grid row per operation; narrower: a labelled card.
const ROW =
  "grid grid-cols-[5.5rem_6.5rem_7rem_8rem_minmax(0,1fr)_3rem_5.5rem_6rem_4.5rem_5.5rem_6rem_7rem] items-center gap-x-3 px-3 py-2";

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
  "Клиент",
];

const RIGHT = new Set(["Кол-во", "Цена", "Сумма", "Прибыль"]);

function rub(v: string): string {
  return `${formatPrice(v)} ₽`;
}

function paymentText(op: CashOperation): string {
  return op.payment ? PAYMENT_LABELS[op.payment] : "—";
}

function Profit({ op, className }: { op: CashOperation; className?: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        op.profit?.startsWith("-") && "text-status-out",
        className,
      )}
    >
      {op.profit === null ? "—" : rub(op.profit)}
    </span>
  );
}

function PhoneCard({ op, time }: { op: CashOperation; time: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 xl:hidden">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-muted-foreground">
          {time}
        </span>
        <MoveTypeBadge type={op.type} />
        <span className="ml-auto font-semibold whitespace-nowrap tabular-nums">
          {rub(op.amount)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-semibold">{op.number_raw}</span>
        <span>{op.brand}</span>
      </div>
      <div className="truncate">{op.name}</div>
      <div className="flex flex-wrap gap-x-3 text-[12.5px] text-muted-foreground">
        <span className="tabular-nums">
          {`${String(op.qty)} шт × ${rub(op.price)} = ${rub(op.amount)}`}
        </span>
        <span>{paymentText(op)}</span>
        <span>
          прибыль <Profit op={op} />
        </span>
        <span>{op.user ?? "—"}</span>
        {op.customer && <span>{op.customer.name}</span>}
      </div>
    </div>
  );
}

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
  const time = (op: CashOperation) =>
    singleDay
      ? timeFmt.format(new Date(op.created_at))
      : formatShortDateTime(op.created_at);
  return (
    <div className="rounded-lg border bg-card text-[13.5px]">
      <div
        className={cn(
          ROW,
          "hidden border-b text-[12px] text-muted-foreground xl:grid",
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
              className="block hover:bg-muted"
            >
              <PhoneCard op={op} time={time(op)} />
              <div className={cn(ROW, "hidden xl:grid")}>
                <span className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                  {time(op)}
                </span>
                <span className="justify-self-start">
                  <MoveTypeBadge type={op.type} />
                </span>
                <span className="font-mono font-semibold">{op.number_raw}</span>
                <span className="whitespace-nowrap">{op.brand}</span>
                <span className="min-w-0 truncate">{op.name}</span>
                <span className="text-right tabular-nums">{`${String(op.qty)} шт`}</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {rub(op.price)}
                </span>
                <span className="text-right font-semibold whitespace-nowrap tabular-nums">
                  {rub(op.amount)}
                </span>
                <span>{paymentText(op)}</span>
                <Profit op={op} className="text-right" />
                <span className="truncate text-muted-foreground">
                  {op.user ?? "—"}
                </span>
                <span className="truncate">{op.customer?.name ?? "—"}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
