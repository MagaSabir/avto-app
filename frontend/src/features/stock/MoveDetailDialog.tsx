import { Link } from "react-router";

import type { StockMove } from "@/api/stock";
import { Modal } from "@/components/ui/modal";
import { carLabel } from "@/features/customers/format";

import { formatDateTime, formatPrice, PAYMENT_LABELS } from "./format";
import { cents } from "./formBits";
import { priceText, qtyText } from "./MoveHistory";
import { MoveTypeBadge } from "./MoveTypeBadge";

// Profit in whole money string, sign kept: (price - cost) * -qty_delta.
function profitText(price: string, cost: string, qty: number): string {
  const total = (cents(price) - cents(cost)) * BigInt(-qty);
  const abs = total < 0n ? -total : total;
  const frac = String(abs % 100n).padStart(2, "0");
  return `${total < 0n ? "-" : ""}${String(abs / 100n)}.${frac}`;
}

export function MoveDetailDialog({
  move,
  onClose,
}: {
  move: StockMove | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={move !== null}
      onClose={onClose}
      className="max-w-[480px]"
      title={
        move && (
          <>
            <MoveTypeBadge type={move.type} />
            <span className="font-mono text-[13px] font-normal text-muted-foreground">
              {formatDateTime(move.created_at)}
            </span>
          </>
        )
      }
    >
      {move && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 overflow-auto px-4 py-3 text-[13px]">
          <dt className="text-muted-foreground">Количество</dt>
          <dd className="font-mono font-semibold">{qtyText(move)}</dd>
          <dt className="text-muted-foreground">Цена</dt>
          <dd className="tabular-nums">{priceText(move)}</dd>
          <dt className="text-muted-foreground">Остаток после</dt>
          <dd className="tabular-nums">{String(move.qty_after)}</dd>
          {(move.type === "sale" || move.type === "return") && (
            <>
              <dt className="text-muted-foreground">Оплата</dt>
              <dd>{move.payment ? PAYMENT_LABELS[move.payment] : "—"}</dd>
              {move.customer && (
                <>
                  <dt className="text-muted-foreground">Клиент</dt>
                  <dd>
                    <Link
                      to={`/customers/${String(move.customer.id)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {move.car
                        ? `${move.customer.name} · ${carLabel(move.car)}`
                        : move.customer.name}
                    </Link>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Закупка</dt>
              <dd className="tabular-nums">
                {move.cost === null
                  ? "закупка неизвестна"
                  : `${formatPrice(move.cost)} ₽`}
              </dd>
              {move.cost !== null && move.price !== null && (
                <>
                  <dt className="text-muted-foreground">Прибыль</dt>
                  <dd className="tabular-nums">
                    {`${formatPrice(profitText(move.price, move.cost, move.qty_delta))} ₽`}
                  </dd>
                </>
              )}
            </>
          )}
          <dt className="text-muted-foreground">Кто</dt>
          <dd>{move.user ?? "—"}</dd>
          {move.type === "receipt" && move.supplier && (
            <>
              <dt className="text-muted-foreground">Поставщик</dt>
              <dd>{move.supplier}</dd>
            </>
          )}
          {move.type === "adjustment" && (
            <>
              <dt className="text-muted-foreground">Было / факт</dt>
              <dd>{`было ${String(move.qty_after - move.qty_delta)}, факт ${String(move.qty_after)}`}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Комментарий</dt>
          <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {move.comment ?? "—"}
          </dd>
        </dl>
      )}
    </Modal>
  );
}
