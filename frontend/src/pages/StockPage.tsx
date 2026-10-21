import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!panelOpen || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const prev = document.body.style.overflow;
    const sync = () => {
      document.body.style.overflow = mq.matches ? "hidden" : prev;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

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
          data-testid="item-panel"
          data-open={panelOpen}
          className={cn(
            "lg:sticky lg:top-3 lg:block lg:max-h-[calc(100vh-1.5rem)] lg:self-start lg:overflow-y-auto",
            panelOpen
              ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:bg-background max-lg:p-3"
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
