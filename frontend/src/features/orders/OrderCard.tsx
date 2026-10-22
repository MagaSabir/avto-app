import type { Order, OrderPart } from "@/api/orders";
import { kopecks, money } from "@/features/settlements/derive";
import { formatAmount, formatDocDate } from "@/features/settlements/format";

import { deliveryLine } from "./format";
import { PartStatusBadge } from "./PartStatusBadge";

const GRID = "lg:grid-cols-[minmax(0,1fr)_80px_200px_110px_110px]";

function PartRow({ part }: { part: OrderPart }) {
  const sum = money(kopecks(part.price) * BigInt(part.count));
  return (
    <div
      className={`grid gap-1 border-b px-4 py-2.5 text-[13.5px] lg:items-center lg:gap-x-4 ${GRID}`}
    >
      <div className="min-w-0">
        <div>{part.name}</div>
        <div className="text-[12.5px]">
          <span className="text-muted-foreground">{part.brand}</span>{" "}
          <span className="font-mono font-medium">{part.number}</span>
        </div>
        {part.comment && (
          <div className="text-[12px] text-muted-foreground">
            {part.comment}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
        <div className="hidden lg:block">
          {part.delivery_days === null
            ? "—"
            : `${String(part.delivery_days)} дн.`}
        </div>
        <div>
          <PartStatusBadge code={part.status_code} />
        </div>
        <div className="lg:text-right">
          <div className="hidden font-mono lg:block">
            {formatAmount(part.price)}
          </div>
          <div className="tabular-nums lg:text-[12px] lg:text-muted-foreground">
            {`${String(part.count)} шт.`}
          </div>
        </div>
        <div className="ml-auto font-mono whitespace-nowrap lg:ml-0 lg:text-right">
          {formatAmount(sum)}
        </div>
      </div>
    </div>
  );
}

export function OrderCard({ order }: { order: Order }) {
  const count = order.parts.reduce((n, p) => n + p.count, 0);
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-4 bg-muted px-4 py-3">
        <div className="min-w-0 space-y-0.5 text-[13.5px]">
          <div className="font-mono text-[26px] leading-tight font-medium">
            {`№ ${String(order.id)}`}
          </div>
          <div>{`Заказано: ${formatDocDate(order.created_at)}`}</div>
          <div>{deliveryLine(order)}</div>
          <div
            className="truncate"
            title={order.stock_address}
          >{`Со склада: ${order.stock_address}`}</div>
          <div
            className="truncate"
            title={order.payment_type}
          >{`Оплата: ${order.payment_type}`}</div>
        </div>
        <div className="font-mono text-[26px] leading-tight font-medium whitespace-nowrap">
          {formatAmount(order.total)}
        </div>
      </div>
      {order.comment && (
        <div className="border-b px-4 py-2 text-[12.5px] text-muted-foreground">
          {order.comment}
        </div>
      )}
      <div
        className={`hidden border-b px-4 py-2 text-left text-[12px] text-muted-foreground lg:grid lg:gap-x-4 ${GRID}`}
      >
        <div>Запчасть</div>
        <div>Срок</div>
        <div>Статус</div>
        <div className="text-right">Цена × кол-во</div>
        <div className="text-right">Сумма, ₽</div>
      </div>
      {order.parts.map((p) => (
        <PartRow key={p.guid} part={p} />
      ))}
      <div className="flex items-center justify-end gap-4 px-4 py-2.5 text-[13.5px] font-semibold">
        <span>ИТОГО:</span>
        <span className="tabular-nums">{`${String(count)} шт.`}</span>
        <span className="font-mono">{formatAmount(order.total)}</span>
      </div>
    </section>
  );
}
