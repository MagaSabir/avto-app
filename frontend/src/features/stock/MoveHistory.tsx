import type { StockMove } from "@/api/stock";

import { formatDateTime, formatMoney, formatPrice } from "./format";
import { MoveTypeBadge } from "./MoveTypeBadge";

export function explanation(move: StockMove): string {
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
  if (move.price === null) return "—";
  const v =
    move.type === "receipt" ? formatMoney(move.price) : formatPrice(move.price);
  return `${v} ₽`;
}

export function MoveHistory({
  moves,
  onSelect,
}: {
  moves: StockMove[];
  onSelect?: (move: StockMove) => void;
}) {
  if (moves.length === 0) {
    return <p className="text-muted-foreground">Движений пока нет</p>;
  }
  return (
    <ul className="flex max-h-72 flex-col divide-y overflow-y-auto text-[13px]">
      {moves.map((m) => {
        const extra = explanation(m);
        return (
          <li
            key={m.id}
            onClick={() => {
              onSelect?.(m);
            }}
            className="cursor-pointer rounded py-1.5 hover:bg-muted"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_3rem_5.5rem] items-baseline gap-x-3">
              <MoveTypeBadge type={m.type} />
              <span className="truncate font-mono whitespace-nowrap text-muted-foreground">
                {formatDateTime(m.created_at)}
              </span>
              <span className="text-right font-mono tabular-nums">
                {qtyText(m)}
              </span>
              <span className="text-right tabular-nums">{priceText(m)}</span>
            </div>
            {extra && (
              <p className="line-clamp-2 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                {extra}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
