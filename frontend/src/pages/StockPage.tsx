import { useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DefaultMarkupField } from "@/features/stock/DefaultMarkupField";
import { ItemPanel } from "@/features/stock/ItemPanel";
import { ReceiptForm } from "@/features/stock/ReceiptForm";
import { StockTable } from "@/features/stock/StockTable";
import { cn } from "@/lib/utils";

export function StockPage() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("item"));
  const selectedId = Number.isInteger(raw) && raw > 0 ? raw : null;

  const [panelOpen, setPanelOpen] = useState(false);

  const select = (id: number) => {
    setParams({ item: String(id) }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="sr-only">Склад</h1>
      <Card title="Быстрый приход" actions={<DefaultMarkupField />}>
        <ReceiptForm
          onAccepted={(item) => {
            select(item.id);
            setPanelOpen(false);
          }}
        />
      </Card>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <StockTable
          selectedId={selectedId}
          onSelect={(id) => {
            select(id);
            setPanelOpen(true);
          }}
        />
        <div
          data-open={panelOpen}
          className={cn(
            "lg:sticky lg:top-3 lg:z-auto lg:block lg:max-h-[calc(100vh-1.5rem)] lg:self-start lg:overflow-y-auto lg:bg-transparent lg:p-0",
            panelOpen
              ? "fixed inset-0 z-40 overflow-y-auto bg-background p-3"
              : "hidden",
          )}
        >
          {panelOpen && (
            <Button
              type="button"
              className="mb-3 lg:hidden"
              onClick={() => {
                setPanelOpen(false);
              }}
            >
              Закрыть
            </Button>
          )}
          <ItemPanel itemId={selectedId} />
        </div>
      </div>
    </div>
  );
}
