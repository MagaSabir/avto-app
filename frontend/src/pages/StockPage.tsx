import { useSearchParams } from "react-router";

import { Card } from "@/components/ui/card";
import { DefaultMarkupField } from "@/features/stock/DefaultMarkupField";
import { ReceiptForm } from "@/features/stock/ReceiptForm";
import { StockTable } from "@/features/stock/StockTable";

export function StockPage() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("item"));
  const selectedId = Number.isInteger(raw) && raw > 0 ? raw : null;

  const select = (id: number) => {
    setParams({ item: String(id) });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="sr-only">Склад</h1>
      <Card title="Быстрый приход" actions={<DefaultMarkupField />}>
        <ReceiptForm
          onAccepted={(item) => {
            select(item.id);
          }}
        />
      </Card>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <StockTable selectedId={selectedId} onSelect={select} />
        <Card>
          <p className="text-muted-foreground">Выберите позицию в таблице</p>
        </Card>
      </div>
    </div>
  );
}
