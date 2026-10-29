import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useCustomers } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CarTitle, Plate } from "@/features/customers/CarBadges";
import { formatPhone } from "@/features/customers/format";
import { NewCustomerDialog } from "@/features/customers/NewCustomerDialog";
import { cn } from "@/lib/utils";

// Wide screens: three columns; phones: the same cells stacked.
const ROW =
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)] md:items-start md:gap-x-4 px-2";

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-bold">Клиенты</h1>
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
              <span>Клиент</span>
              <span>Телефоны</span>
              <span>Машины</span>
            </div>
            <ul className="flex flex-col divide-y">
              {data.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/customers/${String(c.id)}`}
                    className={cn(
                      ROW,
                      "flex flex-col gap-1.5 rounded-md py-2.5 hover:bg-selected md:grid",
                    )}
                  >
                    <span className="font-semibold [overflow-wrap:anywhere]">
                      {c.name}
                    </span>
                    <span className="flex flex-col tabular-nums">
                      {c.phones.length > 0 ? (
                        c.phones.map((p) => (
                          <span key={p}>{formatPhone(p)}</span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="flex flex-col gap-1.5">
                      {c.cars.length > 0 ? (
                        c.cars.map((car) => (
                          <span
                            key={car.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <CarTitle make={car.make} model={car.model} />
                            {car.plate && <Plate plate={car.plate} />}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </Link>
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
