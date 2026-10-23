import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { Offer, PartGroup } from "@/api/search";
import { Modal } from "@/components/ui/modal";
import { ReceiptForm } from "@/features/stock/ReceiptForm";

export function ToStockDialog({
  supplierTitle,
  target,
  onClose,
}: {
  supplierTitle: string;
  target: { group: PartGroup; offer: Offer } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const prefill = useMemo(
    () =>
      target && {
        number: target.group.number,
        brand: target.group.brand,
        name: target.group.name,
        purchase: target.offer.purchase_price,
        supplier: supplierTitle,
      },
    [target, supplierTitle],
  );

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Принять на склад"
      className="max-w-md"
    >
      {target && prefill && (
        <div className="overflow-y-auto p-4">
          <ReceiptForm
            key={`${target.group.key}|${target.offer.stock_id}`}
            layout="column"
            prefill={prefill}
            onAccepted={() => {
              // The supplier query is left alone: no new Rossko request.
              void queryClient.invalidateQueries({
                queryKey: ["search", "stock"],
              });
              onClose();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
