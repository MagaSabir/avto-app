import { useState } from "react";

import { useDeleteItem, type StockItemDetail } from "@/api/stock";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

import { errorText } from "./formBits";
import { movesLabel } from "./format";

export function DeleteItem({
  item,
  moveCount,
  onDeleted,
}: {
  item: StockItemDetail;
  moveCount: number | undefined;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const op = useDeleteItem(item.id);
  const close = () => {
    if (op.isPending) return;
    op.reset();
    setOpen(false);
  };

  return (
    <>
      <Button
        className="h-[34px] border-destructive text-destructive"
        disabled={moveCount === undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        Удалить
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Удаление"
        className="max-w-[460px]"
      >
        <div className="flex flex-col gap-3 p-4">
          <p>
            {`Удалить ${item.number_raw} · ${item.brand} вместе со всей историей (${movesLabel(moveCount ?? 0)})? Остаток: ${String(item.qty)} шт. Это нельзя отменить.`}
          </p>
          {op.error && (
            <p role="alert" className="text-destructive">
              {errorText(op.error)}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="h-[34px] border-destructive bg-destructive text-primary-foreground enabled:hover:bg-destructive/90"
              disabled={op.isPending}
              onClick={() => {
                op.mutate(undefined, { onSuccess: onDeleted });
              }}
            >
              Удалить
            </Button>
            <Button className="h-[34px]" onClick={close}>
              Отмена
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
