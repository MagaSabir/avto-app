import { useState } from "react";

import type { StockMove } from "@/api/stock";
import { Modal } from "@/components/ui/modal";

import { formatDateTime } from "./format";
import { MoveDetailDialog } from "./MoveDetailDialog";
import { explanation, priceText, qtyText } from "./MoveHistory";
import { MoveTypeBadge } from "./MoveTypeBadge";

const TH = "whitespace-nowrap px-3 py-1.5 font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-1.5 first:pl-4 last:pr-4";

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
  const [selected, setSelected] = useState<StockMove | null>(null);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        className="max-w-[900px]"
      >
        <div className="min-h-0 flex-1 overflow-auto pb-2">
          <table className="w-full min-w-[720px] table-fixed text-[13px]">
            <thead className="sticky top-0 border-b bg-card text-left text-muted-foreground">
              <tr>
                <th className={`${TH} w-[9.5rem]`}>Дата</th>
                <th className={`${TH} w-[8rem]`}>Операция</th>
                <th className={`${TH} w-[4.5rem] text-right`}>Кол-во</th>
                <th className={`${TH} w-[6.5rem] text-right`}>Цена</th>
                <th className={`${TH} w-[5rem] text-right`}>Остаток</th>
                <th className={TH}>Комментарий</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {moves.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => {
                    setSelected(m);
                  }}
                  className="cursor-pointer hover:bg-muted"
                >
                  <td
                    className={`${TD} font-mono whitespace-nowrap text-muted-foreground`}
                  >
                    {formatDateTime(m.created_at)}
                  </td>
                  <td className={TD}>
                    <MoveTypeBadge type={m.type} />
                  </td>
                  <td
                    className={`${TD} text-right font-mono font-semibold whitespace-nowrap`}
                  >
                    {qtyText(m)}
                  </td>
                  <td
                    className={`${TD} text-right whitespace-nowrap tabular-nums`}
                  >
                    {priceText(m)}
                  </td>
                  <td
                    className={`${TD} text-right whitespace-nowrap tabular-nums`}
                  >
                    {String(m.qty_after)}
                  </td>
                  <td className={`${TD} text-muted-foreground`}>
                    <span className="line-clamp-2 [overflow-wrap:anywhere]">
                      {explanation(m) || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
      <MoveDetailDialog
        move={selected}
        onClose={() => {
          setSelected(null);
        }}
      />
    </>
  );
}
