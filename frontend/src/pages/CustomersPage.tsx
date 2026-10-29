import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router";

import {
  useCustomerCount,
  useCustomers,
  type CarBrief,
  type CustomerBrief,
} from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CarTitle, Plate } from "@/features/customers/CarBadges";
import { formatPhone } from "@/features/customers/format";
import { formatDate } from "@/features/stock/format";
import { NewCustomerDialog } from "@/features/customers/NewCustomerDialog";
import { cn } from "@/lib/utils";

// Wide screens: a table; phones: the same cells stacked.
const ROW =
  "md:grid-cols-[2.5rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_8rem] md:items-start md:gap-x-4 px-2";

// The car of the last purchase, or the first car when nothing was bought on one.
function mainCar(c: CustomerBrief): CarBrief | undefined {
  return c.cars.find((car) => car.id === c.last_car_id) ?? c.cars.at(0);
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function CustomerRow({ c, n }: { c: CustomerBrief; n: number }) {
  const car = mainCar(c);
  const more = c.cars.length - 1;
  return (
    <Link
      to={`/customers/${String(c.id)}`}
      className={cn(
        ROW,
        "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-md py-2.5 hover:bg-selected md:grid",
      )}
    >
      <span className="row-span-4 text-right text-muted-foreground tabular-nums md:row-span-1">
        {n}
      </span>
      <span className="font-semibold [overflow-wrap:anywhere]">{c.name}</span>
      <span className="flex flex-col tabular-nums">
        {c.phones.length > 0 ? (
          c.phones.map((p) => <span key={p}>{formatPhone(p)}</span>)
        ) : (
          <Dash />
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {car ? (
          <>
            <CarTitle make={car.make} model={car.model} />
            {car.plate && <Plate plate={car.plate} />}
            {more > 0 && (
              <span
                title={`Ещё машин: ${String(more)}`}
                className="rounded-full border px-1.5 text-[12px] font-medium text-muted-foreground"
              >
                {`+${String(more)}`}
              </span>
            )}
          </>
        ) : (
          <Dash />
        )}
      </span>
      <span className="tabular-nums">
        {c.last_purchase_at ? (
          <>
            <span className="text-muted-foreground md:hidden">
              Последняя покупка{" "}
            </span>
            {formatDate(c.last_purchase_at)}
          </>
        ) : (
          <span className="max-md:hidden">
            <Dash />
          </span>
        )}
      </span>
    </Link>
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, [text]);

  const { data, isPending, isError, error } = useCustomers(q);
  const total = useCustomerCount().data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[24px] font-bold">Клиенты</h1>
        {total !== undefined && (
          <span className="text-muted-foreground tabular-nums">{`всего ${String(total)}`}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            placeholder="Имя, телефон, госномер или VIN"
            aria-label="Поиск клиента"
            className="pl-9"
          />
        </div>
        <Button
          variant="primary"
          className="ml-auto h-[38px]"
          onClick={() => {
            setCreating(true);
          }}
        >
          Новый клиент
        </Button>
      </div>
      <Card>
        {isPending ? (
          <p className="py-6 text-center text-muted-foreground">Загрузка…</p>
        ) : isError ? (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">
            {q === "" ? "Клиентов пока нет" : "Никого не нашли"}
          </p>
        ) : (
          <>
            <div
              className={cn(
                ROW,
                "hidden border-b pb-1.5 text-[12px] text-muted-foreground md:grid",
              )}
            >
              <span className="text-right">№</span>
              <span>Клиент</span>
              <span>Телефоны</span>
              <span>Машина</span>
              <span>Последняя покупка</span>
            </div>
            <ul className="flex flex-col divide-y">
              {data.map((c, i) => (
                <li key={c.id}>
                  <CustomerRow c={c} n={i + 1} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <NewCustomerDialog
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        onCreated={(customer) => {
          setCreating(false);
          void navigate(`/customers/${String(customer.id)}`, {
            state: { warnings: customer.warnings },
          });
        }}
      />
    </div>
  );
}
