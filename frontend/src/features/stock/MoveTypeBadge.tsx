import type { StockMove } from "@/api/stock";

// Full class names so Tailwind can see them.
const STYLES: Record<StockMove["type"], { label: string; cls: string }> = {
  receipt: {
    label: "Приход",
    cls: "bg-move-receipt-bg text-move-receipt",
  },
  sale: { label: "Продажа", cls: "bg-move-sale-bg text-move-sale" },
  return: { label: "Возврат", cls: "bg-move-return-bg text-move-return" },
  writeoff: {
    label: "Списание",
    cls: "bg-move-writeoff-bg text-move-writeoff",
  },
  adjustment: {
    label: "Корректировка",
    cls: "bg-move-adjustment-bg text-move-adjustment",
  },
};

export function MoveTypeBadge({ type }: { type: StockMove["type"] }) {
  const { label, cls } = STYLES[type];
  return (
    <span
      className={`inline-block rounded-[4px] px-1.5 text-[12px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
