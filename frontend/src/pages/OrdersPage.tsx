import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { ordersKey, useOrders, type OrdersQuery } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { defaultPeriod, filterOrders } from "@/features/orders/filter";
import { OrderCard } from "@/features/orders/OrderCard";
import { OrdersFilters, type Period } from "@/features/orders/OrdersFilters";
import type { OrderGroup } from "@/features/orders/status";

function useReload() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.resetQueries({ queryKey: ordersKey });
  };
}

function Results({
  query,
  group,
  text,
  notFound,
}: {
  query: OrdersQuery;
  group: OrderGroup | null;
  text: string;
  notFound?: string;
}) {
  const result = useOrders(query);
  const reload = useReload();

  if (result.isPending) {
    return <p className="py-6 text-center text-muted-foreground">Загрузка…</p>;
  }
  if (result.isError) {
    return (
      <p role="alert" className="text-destructive">
        {result.error.message}
      </p>
    );
  }
  const out = result.data;
  if (out.status === "error" || !out.data) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <span className="text-destructive">{out.message}</span>
        <Button type="button" onClick={reload}>
          Повторить
        </Button>
      </div>
    );
  }
  const { orders, truncated } = out.data;
  if (orders.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground">
        {notFound ?? "Заказов за период нет"}
      </p>
    );
  }
  const shown = filterOrders(orders, group, text);
  return (
    <div className="flex flex-col gap-4">
      {truncated && (
        <p className="text-[13.5px] text-muted-foreground">
          Показаны первые 500 заказов — сузьте период
        </p>
      )}
      {shown.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          Ничего не найдено
        </p>
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} />)
      )}
    </div>
  );
}

function SingleOrder({ orderId, raw }: { orderId: number; raw: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Link to="/orders" className="self-start text-primary hover:underline">
        ← Все заказы
      </Link>
      <Results
        query={{ orderId }}
        group={null}
        text=""
        notFound={`Заказ № ${raw} не найден`}
      />
    </div>
  );
}

function OrdersList() {
  const reload = useReload();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(new Date()));
  const [group, setGroup] = useState<OrderGroup | null>(null);
  const [text, setText] = useState("");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <OrdersFilters
          period={period}
          onPeriod={setPeriod}
          group={group}
          onGroup={setGroup}
          text={text}
          onText={setText}
        />
        <Button type="button" className="self-start" onClick={reload}>
          Обновить
        </Button>
      </aside>
      <section className="min-w-0">
        <Results query={period} group={group} text={text} />
      </section>
    </div>
  );
}

export function OrdersPage() {
  const [params] = useSearchParams();
  const raw = params.get("id");
  const orderId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-bold">Заказы</h1>
      {raw === null ? (
        <OrdersList />
      ) : orderId > 0 ? (
        <SingleOrder orderId={orderId} raw={raw} />
      ) : (
        <div className="flex flex-col gap-4">
          <Link
            to="/orders"
            className="self-start text-primary hover:underline"
          >
            ← Все заказы
          </Link>
          <p className="py-6 text-center text-muted-foreground">
            {`Заказ № ${raw} не найден`}
          </p>
        </div>
      )}
    </div>
  );
}
