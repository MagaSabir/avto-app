import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import type { Offer, PartGroup } from "@/api/search";
import { Modal } from "@/components/ui/modal";
import { ReceiptForm } from "@/features/stock/ReceiptForm";

// The part as shown in the search (merged across suppliers).
export type ReceiptPart = Pick<PartGroup, "key" | "brand" | "number" | "name">;

export function ToStockDialog({
  supplierTitle,
  target,
  onClose,
}: {
  supplierTitle: string;
  target: { group: ReceiptPart; offer: Offer } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const qtyRef = useRef<HTMLInputElement>(null);
  // After Modal's own effect: showModal() would otherwise move focus to the
  // close button.
  useEffect(() => {
    if (target) qtyRef.current?.focus();
  }, [target]);
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
            qtyRef={qtyRef}
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
