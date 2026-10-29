import { useRef, useState } from "react";

import {
  useCancelMove,
  type StockItemDetail,
  type StockMove,
} from "@/api/stock";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

import { errorText } from "./formBits";

const ACCUSATIVE: Record<StockMove["type"], string> = {
  sale: "продажу",
  return: "возврат",
  receipt: "приход",
  writeoff: "списание",
  adjustment: "корректировку",
  cancel: "отмену",
};

export function CancelMove({
  move,
  item,
  onDone,
}: {
  move: StockMove;
  item: StockItemDetail;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const op = useCancelMove();
  const sent = useRef(false);
  const close = () => {
    if (op.isPending) return;
    op.reset();
    setOpen(false);
  };
  const confirm = () => {
    if (sent.current) return;
    sent.current = true;
    // mutateAsync: the row may unmount after the refetch, per-call callbacks would be skipped.
    op.mutateAsync(move.id).then(
      (result) => {
        setOpen(false);
        onDone(`✓ Отменено → остаток ${String(result.item.qty)}`);
      },
      () => {
        sent.current = false;
      },
    );
  };

  return (
    <span
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <Button
        className="h-[26px] px-2 text-[12px]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        Отменить
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Отмена операции"
        className="max-w-[460px]"
      >
        <div className="flex flex-col gap-3 p-4">
          <p>
            {`Отменить ${ACCUSATIVE[move.type]} ${String(Math.abs(move.qty_delta))} шт? Остаток станет ${String(item.qty - move.qty_delta)}`}
          </p>
          {op.error && (
            <p role="alert" className="text-destructive">
              {errorText(op.error)}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="h-[34px]"
              disabled={op.isPending}
              onClick={confirm}
            >
              Отменить
            </Button>
            <Button className="h-[34px]" onClick={close}>
              Назад
            </Button>
          </div>
        </div>
      </Modal>
    </span>
  );
}
