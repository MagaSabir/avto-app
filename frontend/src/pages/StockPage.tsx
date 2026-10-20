import { Card } from "@/components/ui/card";
import { DefaultMarkupField } from "@/features/stock/DefaultMarkupField";
import { ReceiptForm } from "@/features/stock/ReceiptForm";

export function StockPage() {
  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="sr-only">Склад</h1>
      <Card title="Быстрый приход" actions={<DefaultMarkupField />}>
        <ReceiptForm onAccepted={() => undefined} />
      </Card>
    </div>
  );
}
