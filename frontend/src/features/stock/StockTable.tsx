import { useEffect, useState } from "react";

import { useStockItems, type StatusFilter } from "@/api/stock";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

import { formatMoney, formatPrice, trimPercent } from "./format";

type Props = {
  selectedId: number | null;
  onSelect: (id: number) => void;
};

const PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "low", label: "Мало" },
  { value: "out", label: "Нет" },
];

const HEADERS: { label: string; right?: boolean }[] = [
  { label: "Статус" },
  { label: "Номер" },
  { label: "Бренд" },
  { label: "Название" },
  { label: "Кол-во", right: true },
  { label: "Ячейка" },
  { label: "Закупка", right: true },
  { label: "Нац.", right: true },
  { label: "Продажа", right: true },
];

export function StockTable({ selectedId, onSelect }: Props) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, [text]);

  const { data, isError } = useStockItems(q, status);
  const counts = data?.counts;
  const items = data?.items ?? [];

  return (
    <Card title="Остатки">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder="Номер, бренд или название"
          aria-label="Поиск по складу"
          className="max-w-xs"
        />
        {PILLS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
            }}
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium",
              status === value
                ? "border-foreground bg-foreground text-card"
                : "bg-card text-foreground hover:bg-selected",
            )}
          >
            {label} · {counts ? counts[value] : 0}
          </button>
        ))}
      </div>
      {isError && (
        <p className="py-6 text-center text-status-out">
          Не удалось загрузить склад
        </p>
      )}
      {data && items.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">
          {q !== "" || status !== "all"
            ? "Ничего не найдено"
            : "На складе пока ничего нет — оформите первый приход"}
        </p>
      )}
      {items.length > 0 && (
        <div className="overflow-x-auto lg:overflow-visible">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b text-left text-[12px] text-muted-foreground">
                {HEADERS.map(({ label, right }) => (
                  <th
                    key={label}
                    className={cn(
                      "sticky top-0 z-10 bg-card px-2 py-1.5 font-medium",
                      right && "text-right",
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const selected = it.id === selectedId;
                return (
                  <tr
                    key={it.id}
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(it.id);
                    }}
                    className={cn(
                      "h-9 cursor-pointer border-b",
                      selected
                        ? "bg-selected shadow-[inset_3px_0_0_var(--primary)]"
                        : "hover:bg-muted",
                    )}
                  >
                    <td className="px-2">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="px-2 font-mono font-medium whitespace-nowrap">
                      {it.number_raw}
                    </td>
                    <td className="px-2 whitespace-nowrap">{it.brand}</td>
                    <td className="px-2">{it.name}</td>
                    <td className="px-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-2 whitespace-nowrap">{it.cell ?? "—"}</td>
                    <td className="px-2 text-right tabular-nums whitespace-nowrap">
                      {formatMoney(it.purchase_price)}
                    </td>
                    <td className="px-2 text-right tabular-nums whitespace-nowrap">
                      {trimPercent(it.markup)}%
                    </td>
                    <td className="px-2 text-right tabular-nums whitespace-nowrap">
                      {formatPrice(it.sale_price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
