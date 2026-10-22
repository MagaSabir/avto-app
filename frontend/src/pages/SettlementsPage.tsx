import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  settlementsKey,
  useSettlements,
  type SettlementsData,
  type SettlementsFilters,
} from "@/api/settlements";
import { Button } from "@/components/ui/button";
import { DocumentsTable } from "@/features/settlements/DocumentsTable";
import { SettlementsFiltersPanel } from "@/features/settlements/SettlementsFilters";
import { paidAmounts } from "@/features/settlements/derive";
import { formatAmount, formatSigned } from "@/features/settlements/format";
import { formatMoney } from "@/features/stock/format";
import { cn } from "@/lib/utils";

// "2026-10-25" -> "25.10.2026" without a time zone shift
function formatDay(day: string): string {
  return day.split("-").reverse().join(".");
}

function Header({ data }: { data: SettlementsData | undefined }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-[24px] font-bold">Взаиморасчёты</h1>
      {data && (
        <div className="text-right">
          <div className="text-[13px] text-muted-foreground">{data.kind}</div>
          <div
            className={cn(
              "font-mono text-[26px] leading-tight",
              data.balance.startsWith("-") && "text-destructive",
            )}
          >
            {formatSigned(data.balance)}
          </div>
        </div>
      )}
    </div>
  );
}

function Customers({ data }: { data: SettlementsData }) {
  return (
    <div role="tablist" className="flex rounded-md bg-muted">
      {data.customers.map((c, i) => (
        <div
          key={c.id}
          role="tab"
          aria-selected={i === 0}
          className={cn(
            "border-b-2 px-5 py-2",
            i === 0 ? "border-primary bg-card" : "border-transparent",
          )}
        >
          <div
            className={cn(
              "font-mono",
              c.balance.startsWith("-") && "text-destructive",
            )}
          >
            {`${c.balance.startsWith("-") ? "" : "+"}${formatAmount(c.balance)}`}
          </div>
          <div className="text-[12px] text-muted-foreground uppercase">
            {c.name}
          </div>
        </div>
      ))}
    </div>
  );
}

function Overdue({ data }: { data: SettlementsData }) {
  if (data.overdue_sum === null && data.payments.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-[13.5px] text-destructive">
      {data.overdue_sum !== null && (
        <p>
          {`Просрочено: ${formatMoney(data.overdue_sum)} ₽${data.overdue_days === null ? "" : ` · ${String(data.overdue_days)} дн.`}`}
        </p>
      )}
      {data.payments.length > 0 && (
        <p>
          {`График платежей: ${data.payments
            .map((p) => `${formatDay(p.date)} — ${formatMoney(p.amount)} ₽`)
            .join("; ")}`}
        </p>
      )}
    </div>
  );
}

export function SettlementsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SettlementsFilters>({});
  const query = useSettlements(filters);
  const pages = query.data?.pages ?? [];
  const data = pages.at(0)?.data ?? undefined;
  const failed = pages.find((p) => p.status === "error");
  const documents = pages.flatMap((p) => p.data?.documents ?? []);
  const reload = () => {
    void queryClient.resetQueries({ queryKey: settlementsKey });
  };

  return (
    <div className="flex flex-col gap-4">
      <Header data={data} />
      {data && <Customers data={data} />}
      {data && <Overdue data={data} />}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <SettlementsFiltersPanel onChange={setFilters} />
          <Button type="button" className="self-start" onClick={reload}>
            Обновить
          </Button>
        </aside>
        <section className="min-w-0">
          {query.isError && (
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
          )}
          {failed && (
            <div role="alert" className="flex items-center gap-3">
              <span className="text-destructive">{failed.message}</span>
              <Button type="button" onClick={reload}>
                Повторить
              </Button>
            </div>
          )}
          {data && documents.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">
              Документов нет
            </p>
          )}
          {documents.length > 0 && (
            <DocumentsTable
              documents={documents}
              paid={paidAmounts(documents, filters.status !== undefined)}
            />
          )}
          {query.hasNextPage && (
            <Button
              type="button"
              className="mt-3"
              disabled={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Показать ещё
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
