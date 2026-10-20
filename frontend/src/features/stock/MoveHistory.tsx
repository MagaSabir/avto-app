import type { StockMove } from "@/api/stock";

import { formatDateTime, formatPrice } from "./format";

const LABELS: Record<StockMove["type"], string> = {
  receipt: "Приход",
  sale: "Продажа",
  return: "Возврат",
  writeoff: "Списание",
  adjustment: "Корректировка",
};

function explanation(move: StockMove): string {
  if (move.type === "receipt") return move.supplier ?? "";
  if (move.type === "adjustment") {
    const was = `было ${String(move.qty_after - move.qty_delta)}, факт ${String(move.qty_after)}`;
    return move.comment ? `${was} · ${move.comment}` : was;
  }
  return move.comment ?? "";
}

export function MoveHistory({ moves }: { moves: StockMove[] }) {
  if (moves.length === 0) {
    return <p className="text-muted-foreground">Движений пока нет</p>;
  }
  return (
    <ul className="flex flex-col divide-y text-[13px]">
      {moves.map((m) => {
        const extra = explanation(m);
        return (
          <li
            key={m.id}
            className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 py-1.5"
          >
            <span className="font-mono text-muted-foreground">
              {formatDateTime(m.created_at)}
            </span>
            <span>
              <span className="font-medium">{LABELS[m.type]}</span>
              {extra && <span className="text-muted-foreground"> {extra}</span>}
            </span>
            <span className="text-right font-mono">
              <span
                className={
                  m.qty_delta > 0 ? "font-semibold text-status-ok" : undefined
                }
              >
                {m.qty_delta > 0
                  ? `+${String(m.qty_delta)}`
                  : `−${String(Math.abs(m.qty_delta))}`}
              </span>
              {m.price !== null && (
                <span className="ml-2 text-muted-foreground">
                  {formatPrice(m.price)} ₽
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
