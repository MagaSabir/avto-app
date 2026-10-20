import { useEffect, useRef } from "react";

import type { StockMove } from "@/api/stock";
import { Button } from "@/components/ui/button";

import { formatDateTime, formatPrice } from "./format";
import { explanation } from "./MoveHistory";
import { MoveTypeBadge } from "./MoveTypeBadge";

export function HistoryDialog({
  open,
  onClose,
  moves,
  title,
}: {
  open: boolean;
  onClose: () => void;
  moves: StockMove[];
  title: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[80vh] w-full max-w-[720px] overflow-y-auto rounded-lg border bg-card p-4 text-card-foreground backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Дата</th>
              <th className="py-1 font-medium">Операция</th>
              <th className="py-1 text-right font-medium">Кол-во</th>
              <th className="py-1 text-right font-medium">Цена</th>
              <th className="py-1 text-right font-medium">Остаток</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {moves.map((m) => (
              <tr key={m.id}>
                <td className="py-1.5 font-mono text-muted-foreground">
                  {formatDateTime(m.created_at)}
                </td>
                <td className="py-1.5">
                  <MoveTypeBadge type={m.type} />
                  <span className="text-muted-foreground">
                    {" "}
                    {explanation(m)}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono">
                  {m.qty_delta > 0
                    ? `+${String(m.qty_delta)}`
                    : `−${String(Math.abs(m.qty_delta))}`}
                </td>
                <td className="py-1.5 text-right font-mono text-muted-foreground">
                  {m.price !== null ? `${formatPrice(m.price)} ₽` : ""}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {String(m.qty_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
