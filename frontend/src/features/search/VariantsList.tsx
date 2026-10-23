import type { Offer, PartGroup } from "@/api/search";
import { useSupplierVariants } from "@/api/search";
import { formatPrice } from "@/features/stock/format";

import { formatDelivery, warehouseLabel } from "./format";
import { OfferActions } from "./OfferActions";

type Props = {
  supplier: string;
  group: PartGroup;
  orderCode: string;
  onToStock: (group: PartGroup, offer: Offer) => void;
};

// Delivery options of one «variants» row. Mounted only when opened, so the
// supplier is asked once per opening.
export function VariantsList({ supplier, group, orderCode, onToStock }: Props) {
  const q = useSupplierVariants(supplier, orderCode, true);
  const now = new Date();

  if (q.isPending)
    return <p className="py-1 text-[12px] text-muted-foreground">Загрузка…</p>;
  if (q.isError || q.data.status === "error")
    return (
      <p
        role="alert"
        className="my-1 rounded-md border border-destructive px-2 py-1 text-[12px] text-destructive"
      >
        {q.isError ? q.error.message : (q.data.message ?? "Ошибка поставщика")}
      </p>
    );

  return (
    <div className="flex w-full min-w-0 flex-col md:items-end">
      {q.data.message !== null && (
        <p className="py-1 text-[12px] text-muted-foreground">
          {q.data.message}
        </p>
      )}
      <ul aria-label="Варианты поставки" className="w-full">
        {q.data.offers.map((v) => {
          const offer: Offer = { ...v, order_code: v.order_code ?? orderCode };
          return (
            <li
              key={v.stock_id}
              className="flex flex-col gap-1 border-t border-dashed py-1.5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 md:justify-end">
                <span className="font-semibold whitespace-nowrap tabular-nums">
                  {formatPrice(v.purchase_price)} ₽
                </span>
                <span className="whitespace-nowrap">
                  {formatDelivery(v, now)}
                </span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {v.rating === null || v.rating === undefined
                    ? ""
                    : `${String(v.rating)} %`}
                </span>
                <span className="basis-full text-[12px] text-muted-foreground [overflow-wrap:anywhere] md:text-right">
                  {v.kind === "order" ? "Под заказ" : warehouseLabel(v)}
                </span>
              </div>
              <OfferActions
                supplier={supplier}
                group={group}
                offer={offer}
                onToStock={onToStock}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
