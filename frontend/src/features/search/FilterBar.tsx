import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { SortMode } from "./derive";

export type SearchFilters = {
  inStockOnly: boolean;
  showAnalogs: boolean;
  mikadoOrders: boolean;
  sort: SortMode;
};

type Props = SearchFilters & {
  // The toggle exists only when Mikado is among the suppliers.
  hasMikado?: boolean;
  onChange: (patch: Partial<SearchFilters>) => void;
};

function Pill({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium",
        pressed
          ? "border-foreground bg-foreground text-card"
          : "bg-card text-foreground hover:bg-selected",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  inStockOnly,
  showAnalogs,
  mikadoOrders,
  hasMikado = false,
  sort,
  onChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        pressed={inStockOnly}
        onClick={() => {
          onChange({ inStockOnly: !inStockOnly });
        }}
      >
        В наличии
      </Pill>
      <Pill
        pressed={showAnalogs}
        onClick={() => {
          onChange({ showAnalogs: !showAnalogs });
        }}
      >
        Аналоги
      </Pill>
      {hasMikado && (
        <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[13px] font-medium">
          <input
            type="checkbox"
            checked={mikadoOrders}
            onChange={(e) => {
              onChange({ mikadoOrders: e.target.checked });
            }}
            className="size-4 cursor-pointer accent-primary"
          />
          Микадо: наличие и заказ
        </label>
      )}
      <div
        role="group"
        aria-label="Сортировка"
        className="flex items-center gap-2"
      >
        <span className="hidden text-muted-foreground md:inline">
          Сортировка:
        </span>
        <Pill
          pressed={sort === "price"}
          onClick={() => {
            onChange({ sort: "price" });
          }}
        >
          Цена
        </Pill>
        <Pill
          pressed={sort === "time"}
          onClick={() => {
            onChange({ sort: "time" });
          }}
        >
          Срок
        </Pill>
      </div>
    </div>
  );
}
