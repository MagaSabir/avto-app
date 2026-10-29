import { useState } from "react";
import { Link } from "react-router";

import { useCustomerHistory, type Car, type HistoryRow } from "@/api/customers";
import { Card } from "@/components/ui/card";
import {
  formatPrice,
  formatShortDateTime,
  PAYMENT_LABELS,
} from "@/features/stock/format";
import { MoveTypeBadge } from "@/features/stock/MoveTypeBadge";
import { cn } from "@/lib/utils";

import { carLabel } from "./format";

// Wide screens: one grid row per purchase; narrower: a labelled card.
const ROW =
  "grid grid-cols-[6.5rem_6.5rem_7rem_8rem_minmax(0,1fr)_3rem_5.5rem_6rem_4.5rem_9rem] items-center gap-x-3 px-3 py-2";

const HEADERS = [
  "Дата",
  "Тип",
  "Номер",
  "Бренд",
  "Название",
  "Кол-во",
  "Цена",
  "Сумма",
  "Оплата",
  "Машина",
];

const RIGHT = new Set(["Кол-во", "Цена", "Сумма"]);

function rub(v: string): string {
  return `${formatPrice(v)} ₽`;
}

function carText(row: HistoryRow): string {
  return row.car ? carLabel(row.car) || "—" : "—";
}

function payment(row: HistoryRow): string {
  return row.payment ? PAYMENT_LABELS[row.payment] : "—";
}

function PhoneCard({ row }: { row: HistoryRow }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 lg:hidden">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-muted-foreground">
          {formatShortDateTime(row.created_at)}
        </span>
        <MoveTypeBadge type={row.type} />
        <span className="ml-auto font-semibold whitespace-nowrap tabular-nums">
          {rub(row.amount)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-semibold">{row.number_raw}</span>
        <span>{row.brand}</span>
      </div>
      <div className="truncate">{row.name}</div>
      <div className="flex flex-wrap gap-x-3 text-[12.5px] text-muted-foreground">
        <span className="tabular-nums">
          {`${String(row.qty)} шт × ${rub(row.price)} = ${rub(row.amount)}`}
        </span>
        <span>{payment(row)}</span>
        <span>{carText(row)}</span>
      </div>
    </div>
  );
}

function Table({ rows }: { rows: HistoryRow[] }) {
  return (
    <div className="rounded-lg border bg-card text-[13.5px]">
      <div
        className={cn(
          ROW,
          "hidden border-b text-[12px] text-muted-foreground lg:grid",
        )}
      >
        {HEADERS.map((h) => (
          <span key={h} className={cn(RIGHT.has(h) && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.move_id}>
            <Link
              to={`/stock?item=${String(row.item_id)}`}
              className="block hover:bg-muted"
            >
              <PhoneCard row={row} />
              <div className={cn(ROW, "hidden lg:grid")}>
                <span className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                  {formatShortDateTime(row.created_at)}
                </span>
                <span className="justify-self-start">
                  <MoveTypeBadge type={row.type} />
                </span>
                <span className="font-mono font-semibold">
                  {row.number_raw}
                </span>
                <span className="whitespace-nowrap">{row.brand}</span>
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="text-right tabular-nums">{`${String(row.qty)} шт`}</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {rub(row.price)}
                </span>
                <span className="text-right font-semibold whitespace-nowrap tabular-nums">
                  {rub(row.amount)}
                </span>
                <span>{payment(row)}</span>
                <span className="truncate text-muted-foreground">
                  {carText(row)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CustomerHistory({
  customerId,
  cars,
}: {
  customerId: number;
  cars: Car[];
}) {
  const [carId, setCarId] = useState<number | null>(null);
  const { data, isPending, isError, error } = useCustomerHistory(
    customerId,
    carId,
  );

  return (
    <Card
      title="История покупок"
      actions={
        cars.length > 0 && (
          <select
            aria-label="Машина"
            value={carId === null ? "" : String(carId)}
            onChange={(e) => {
              setCarId(e.target.value === "" ? null : Number(e.target.value));
            }}
            className="h-[34px] rounded-lg border bg-card px-2"
          >
            <option value="">Все машины</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {carLabel(c) || c.vin || `№ ${String(c.id)}`}
              </option>
            ))}
          </select>
        )
      }
    >
      {isPending ? (
        <p className="py-6 text-center text-muted-foreground">Загрузка…</p>
      ) : isError ? (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          Покупок пока нет
        </p>
      ) : (
        <Table rows={data} />
      )}
    </Card>
  );
}
