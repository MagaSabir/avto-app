import type { CashTotals } from "@/api/cash";
import { formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

function money(v: string): string {
  return `${formatPrice(v)} ₽`;
}

function Tile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div
      data-tile
      className="flex flex-col gap-0.5 rounded-lg border bg-card p-3"
    >
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[20px] font-bold tabular-nums",
          value.startsWith("-") && "text-status-out",
        )}
      >
        {money(value)}
      </span>
      {caption && (
        <span className="text-[12.5px] text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}

export function CashTotalsTiles({ totals: t }: { totals: CashTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Выручка"
        value={t.revenue}
        caption={`продажи ${money(t.sales)} · возвраты ${money(t.returns)}`}
      />
      <Tile label="Наличные" value={t.cash} />
      <Tile label="Перевод" value={t.transfer} />
      <Tile
        label="Прибыль"
        value={t.profit}
        caption={
          t.no_cost_count > 0
            ? `без ${String(t.no_cost_count)} старых операций`
            : undefined
        }
      />
      <Tile
        label="Списано"
        value={t.writeoffs}
        caption={
          t.writeoffs_no_cost_count > 0
            ? `без ${String(t.writeoffs_no_cost_count)} старых`
            : undefined
        }
      />
      <Tile
        label="Прибыль с учётом списаний"
        value={t.profit_after_writeoffs}
      />
    </div>
  );
}
