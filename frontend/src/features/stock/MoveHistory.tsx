import type { ReactNode } from "react";

import type { StockMove } from "@/api/stock";

import {
  formatMoney,
  formatPrice,
  formatShortDateTime,
  PAYMENT_LABELS,
} from "./format";
import { MoveTypeBadge, typeLabel } from "./MoveTypeBadge";

export function explanation(move: StockMove, moves: StockMove[]): string {
  if (move.type === "cancel") {
    const original = moves.find((m) => m.id === move.cancels_move_id);
    return original
      ? `Отмена: ${typeLabel(original.type).toLowerCase()} ${qtyText(original)}`
      : "Отмена";
  }
  if (move.type === "sale" || move.type === "return") {
    return [move.payment ? PAYMENT_LABELS[move.payment] : null, move.comment]
      .filter((p) => p)
      .join(" · ");
  }
  if (move.type === "receipt") return move.supplier ?? "";
  if (move.type === "adjustment") {
    const was = `было ${String(move.qty_after - move.qty_delta)}, факт ${String(move.qty_after)}`;
    return move.comment ? `${was} · ${move.comment}` : was;
  }
  return move.comment ?? "";
}

export function qtyText(move: StockMove): string {
  return move.qty_delta > 0
    ? `+${String(move.qty_delta)}`
    : `−${String(Math.abs(move.qty_delta))}`;
}

// Receipt keeps kopecks; sale and return drop zero kopecks.
export function priceText(move: StockMove): string {
  if (move.type === "writeoff") return "0 ₽";
  if (move.price === null) return "—";
  const v =
    move.type === "receipt" ? formatMoney(move.price) : formatPrice(move.price);
  return `${v} ₽`;
}

export function MoveHistory({
  moves,
  onSelect,
  action,
}: {
  moves: StockMove[];
  onSelect?: (move: StockMove) => void;
  action?: (move: StockMove) => ReactNode;
}) {
  if (moves.length === 0) {
    return <p className="text-muted-foreground">Движений пока нет</p>;
  }
  return (
    <ul className="flex max-h-72 flex-col divide-y overflow-y-auto text-[13px]">
      {moves.map((m) => {
        const strike = m.cancelled ? "line-through text-muted-foreground" : "";
        return (
          <li
            key={m.id}
            onClick={() => {
              onSelect?.(m);
            }}
            className="cursor-pointer rounded py-1.5 hover:bg-muted"
          >
            <div className="flex items-center gap-x-2">
              <div
                className={`grid min-w-0 flex-1 grid-cols-[5.5rem_minmax(0,1fr)_2.5rem_5rem] items-center gap-x-2 ${strike}`}
              >
                <span className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                  {formatShortDateTime(m.created_at)}
                </span>
                <span className="flex min-w-0 items-center gap-x-1 justify-self-start">
                  <MoveTypeBadge type={m.type} />
                  {m.user && (
                    <span className="truncate text-[12px] text-muted-foreground">
                      {`· ${m.user}`}
                    </span>
                  )}
                </span>
                <span className={`text-right font-mono tabular-nums ${strike}`}>
                  {qtyText(m)}
                </span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {priceText(m)}
                </span>
              </div>
              {action?.(m)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
