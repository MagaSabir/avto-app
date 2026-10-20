import { useStockItem, useStockMoves } from "@/api/stock";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

import { errorText } from "./formBits";
import { formatDate, formatPrice, trimPercent } from "./format";
import { ItemActions } from "./ItemActions";
import { MoveHistory } from "./MoveHistory";

function Stat({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

export function ItemPanel({ itemId }: { itemId: number | null }) {
  const item = useStockItem(itemId);
  const moves = useStockMoves(itemId);

  if (itemId === null) {
    return (
      <Card>
        <p className="text-muted-foreground">Выберите позицию в таблице</p>
      </Card>
    );
  }
  if (item.error) {
    return (
      <Card>
        <p className="text-status-out">{errorText(item.error)}</p>
      </Card>
    );
  }
  if (!item.data) {
    return (
      <Card>
        <p className="text-muted-foreground">Загрузка…</p>
      </Card>
    );
  }

  const d = item.data;
  const last = (at: string | null, who?: string | null) =>
    at ? `${formatDate(at)}${who ? ` · ${who}` : ""}` : "—";

  return (
    <Card>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[20px] font-bold">
              {d.number_raw}
            </span>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-muted-foreground">
            {[d.brand, d.name, d.cell].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12.5px] text-muted-foreground">Остаток</span>
            <span className="font-medium">{`${String(d.qty)} шт`}</span>
            <span className="text-[12.5px] text-muted-foreground">{`мин. ${String(d.min_qty)}`}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12.5px] text-muted-foreground">Цена</span>
            <span className="font-mono font-medium">{`${formatPrice(d.sale_price)} ₽`}</span>
            <span className="text-[12.5px] text-muted-foreground">{`нац. ${trimPercent(d.markup)}%`}</span>
          </div>
          <Stat label="Последний приход">
            {last(d.last_receipt_at, d.last_receipt_supplier)}
          </Stat>
          <Stat label="Последняя продажа">{last(d.last_sale_at)}</Stat>
          <Stat label="Продано за 30 дн.">{`${String(d.sold_30d)} шт`}</Stat>
        </div>

        <ItemActions key={d.id} item={d} />

        <div className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-semibold">История</h3>
          {moves.data ? (
            <MoveHistory moves={moves.data} />
          ) : moves.error ? (
            <p className="text-status-out">{errorText(moves.error)}</p>
          ) : (
            <p className="text-muted-foreground">Загрузка…</p>
          )}
        </div>
      </div>
    </Card>
  );
}
