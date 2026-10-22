import { X } from "lucide-react";
import { useState } from "react";

import type { SettlementStatus, SettlementsFilters } from "@/api/settlements";
import { Input } from "@/components/ui/input";

const STATUSES: SettlementStatus[] = [
  "Проведено",
  "Оплачено",
  "Не оплачено",
  "Просрочено",
  "Обрабатывается",
];

const fieldClass =
  "h-[38px] w-full rounded-md border bg-card px-2.5 text-[14px] text-foreground";

export function SettlementsFiltersPanel({
  onChange,
}: {
  onChange: (filters: SettlementsFilters) => void;
}) {
  const [status, setStatus] = useState<SettlementStatus | "">("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // The period applies only when both dates are set.
  function apply(next: {
    status: SettlementStatus | "";
    start: string;
    end: string;
  }) {
    const both = next.start !== "" && next.end !== "";
    onChange({
      ...(next.status ? { status: next.status } : {}),
      ...(both ? { start: next.start, end: next.end } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Статус
        <select
          value={status}
          onChange={(e) => {
            const value = e.target.value as SettlementStatus | "";
            setStatus(value);
            apply({ status: value, start, end });
          }}
          className={fieldClass}
        >
          <option value="">Любой статус</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[12px] text-muted-foreground">
          Период
        </legend>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Период с"
            value={start}
            max={end || undefined}
            onChange={(e) => {
              setStart(e.target.value);
              apply({ status, start: e.target.value, end });
            }}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            aria-label="по"
            value={end}
            min={start || undefined}
            onChange={(e) => {
              setEnd(e.target.value);
              apply({ status, start, end: e.target.value });
            }}
          />
          {(start !== "" || end !== "") && (
            <button
              type="button"
              aria-label="Сбросить период"
              title="Сбросить период"
              onClick={() => {
                setStart("");
                setEnd("");
                apply({ status, start: "", end: "" });
              }}
              className="inline-flex cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
