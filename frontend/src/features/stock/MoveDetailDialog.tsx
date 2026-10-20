import type { StockMove } from "@/api/stock";
import { Modal } from "@/components/ui/modal";

import { formatDateTime } from "./format";
import { priceText, qtyText } from "./MoveHistory";
import { MoveTypeBadge } from "./MoveTypeBadge";

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
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 overflow-auto px-4 pb-4 text-[13px]">
          <dt className="text-muted-foreground">Количество</dt>
          <dd className="font-mono font-semibold">{qtyText(move)}</dd>
          <dt className="text-muted-foreground">Цена</dt>
          <dd className="tabular-nums">{priceText(move)}</dd>
          <dt className="text-muted-foreground">Остаток после</dt>
          <dd className="tabular-nums">{String(move.qty_after)}</dd>
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
