import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { SupplierInfo } from "@/api/search";

import type { SortMode } from "./derive";

export type SearchFilters = {
  showAnalogs: boolean;
  sort: SortMode;
};

type Props = SearchFilters & {
  suppliers: SupplierInfo[]; // all connected
  chosen: string[]; // codes of selected ones
  onChoose: (codes: string[]) => void;
  onChange: (patch: Partial<SearchFilters>) => void;
};

function Check({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[14px] text-soft-foreground">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="grid size-[22px] shrink-0 cursor-pointer appearance-none place-items-center rounded-[5px] border border-border-active bg-card checked:border-primary checked:bg-primary checked:after:text-[16px] checked:after:leading-none checked:after:font-extrabold checked:after:text-primary-foreground checked:after:content-['✓'] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
      />
      {children}
    </label>
  );
}

function SupplierPicker({
  suppliers,
  chosen,
  onChoose,
}: Pick<Props, "suppliers" | "chosen" | "onChoose">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = suppliers
    .filter((s) => chosen.includes(s.code))
    .map((s) => s.title)
    .join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border bg-card px-[11px] text-[14px] font-medium text-foreground hover:bg-selected"
      >
        <span className="font-normal text-muted-foreground">Поставщик:</span>{" "}
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 min-w-44 rounded-[9px] border bg-card px-3 py-1 shadow-md">
          {suppliers.map((s) => {
            const on = chosen.includes(s.code);
            return (
              <Check
                key={s.code}
                checked={on}
                disabled={on && chosen.length === 1}
                onChange={(v) => {
                  onChoose(
                    v
                      ? suppliers
                          .map((x) => x.code)
                          .filter((c) => c === s.code || chosen.includes(c))
                      : chosen.filter((c) => c !== s.code),
                  );
                }}
              >
                {s.title}
              </Check>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  showAnalogs,
  sort,
  suppliers,
  chosen,
  onChoose,
  onChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Check
        checked={showAnalogs}
        onChange={(v) => {
          onChange({ showAnalogs: v });
        }}
      >
        Показывать аналоги
      </Check>
      <div className="flex h-[38px] items-center gap-2 rounded-[9px] border bg-card px-[11px] text-[14px]">
        <span aria-hidden="true" className="text-muted-foreground">
          Сортировка:
        </span>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => {
            onChange({ sort: e.target.value as SortMode });
          }}
          className="cursor-pointer bg-transparent font-medium text-foreground outline-none"
        >
          <option value="price">По цене ↑</option>
          <option value="time">По сроку ↑</option>
        </select>
      </div>
      {suppliers.length > 1 && (
        <SupplierPicker
          suppliers={suppliers}
          chosen={chosen}
          onChoose={onChoose}
        />
      )}
    </div>
  );
}
