import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useCustomers } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NewCustomerDialog } from "@/features/customers/NewCustomerDialog";
import { carLabel, formatPhone } from "@/features/customers/format";

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
      <Card
        actions={
          <Button
            variant="primary"
            className="h-[34px]"
            onClick={() => {
              setCreating(true);
            }}
          >
            Новый клиент
          </Button>
        }
      >
        <Input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder="Имя, телефон, госномер или VIN"
          aria-label="Поиск клиента"
          className="mb-3 max-w-xs"
        />
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
          <ul className="flex flex-col divide-y">
            {data.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/customers/${String(c.id)}`}
                  className="flex flex-col gap-0.5 px-1 py-2 hover:bg-selected sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="font-semibold sm:w-64">{c.name}</span>
                  <span className="font-mono text-[13px] sm:w-48">
                    {c.phones.map(formatPhone).join(", ")}
                  </span>
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {c.cars.map(carLabel).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
