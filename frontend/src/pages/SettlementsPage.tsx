import { useQueryClient } from "@tanstack/react-query";

import { settlementsKey, useSettlements } from "@/api/settlements";
import type { SettlementsData } from "@/api/settlements";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentsTable } from "@/features/settlements/DocumentsTable";
import { formatSigned } from "@/features/settlements/format";
import { formatMoney } from "@/features/stock/format";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// "2026-10-25" -> "25.10.2026" without a time zone shift
function formatDay(day: string): string {
  return day.split("-").reverse().join(".");
}

function Summary({ data }: { data: SettlementsData }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-[12px] text-muted-foreground">Баланс</dt>
          <dd
            className={cn(
              "font-mono text-[15px] font-semibold",
              data.balance.startsWith("-") && "text-destructive",
            )}
          >
            {formatSigned(data.balance)}
          </dd>
        </div>
        <Field label="Тип расчёта">{data.kind}</Field>
        <Field label="Лимит">
          {data.limit === null ? "—" : `${formatMoney(data.limit)} ₽`}
        </Field>
        <Field label="Отсрочка">
          {data.payment_delay === null
            ? "—"
            : `${String(data.payment_delay)} дн.`}
        </Field>
      </dl>
      {data.customers.length > 1 && (
        <ul className="mt-3 text-[13px]">
          {data.customers.map((c) => (
            <li key={c.id}>
              {c.name}:{" "}
              <span className="font-mono">{formatSigned(c.balance)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Overdue({ data }: { data: SettlementsData }) {
  if (data.overdue_sum === null && data.payments.length === 0) return null;
  return (
    <Card title="Просрочка и график платежей">
      {data.overdue_sum !== null && (
        <p className="mb-2 text-destructive">
          Просрочено:{" "}
          <span className="font-mono">
            {`${formatMoney(data.overdue_sum)} ₽${data.overdue_days === null ? "" : ` · ${String(data.overdue_days)} дн.`}`}
          </span>
        </p>
      )}
      {data.payments.length > 0 && (
        <table className="border-collapse text-[13.5px]">
          <tbody>
            {data.payments.map((p, i) => (
              <tr key={i} className="h-8 border-b">
                <td className="pr-4 tabular-nums">{formatDay(p.date)}</td>
                <td className="pr-4 text-right font-mono">{`${formatMoney(p.amount)} ₽`}</td>
                <td>{p.contractor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function SettlementsPage() {
  const queryClient = useQueryClient();
  const query = useSettlements();
  const pages = query.data?.pages ?? [];
  const first = pages.at(0);
  const failed = pages.find((p) => p.status === "error");
  const documents = pages.flatMap((p) => p.data?.documents ?? []);
  const reload = () => {
    void queryClient.resetQueries({ queryKey: settlementsKey });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="sr-only">Взаиморасчёты</h1>
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
      {first?.data && (
        <>
          <Card
            title="Росско"
            actions={
              <Button type="button" onClick={reload}>
                Обновить
              </Button>
            }
          >
            <Summary data={first.data} />
          </Card>
          <Overdue data={first.data} />
          <Card title={`Документы · ${String(first.data.documents_total)}`}>
            <DocumentsTable documents={documents} />
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
          </Card>
        </>
      )}
    </div>
  );
}
