import { X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

import { defaultPeriod } from "./filter";
import { ORDER_GROUPS, type OrderGroup } from "./status";

export type Period = { start: string; end: string };

const fieldClass =
  "h-[38px] w-full rounded-md border bg-card px-2.5 text-[14px] text-foreground";

export function OrdersFilters({
  period,
  onPeriod,
  group,
  onGroup,
  text,
  onText,
}: {
  period: Period;
  onPeriod: (period: Period) => void;
  group: OrderGroup | null;
  onGroup: (group: OrderGroup | null) => void;
  text: string;
  onText: (text: string) => void;
}) {
  // The inputs hold what is being typed; the period is applied only when
  // complete and in order (browsers report every typed year digit).
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);
  const [initial] = useState(() => defaultPeriod(new Date()));

  function edit(next: Period) {
    setStart(next.start);
    setEnd(next.end);
    if (
      next.start >= "2000-01-01" &&
      next.end >= "2000-01-01" &&
      next.start <= next.end
    ) {
      onPeriod(next);
    }
  }

  const changed = period.start !== initial.start || period.end !== initial.end;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Статус
        <select
          value={group ?? ""}
          onChange={(e) => {
            onGroup((e.target.value || null) as OrderGroup | null);
          }}
          className={fieldClass}
        >
          <option value="">Любой статус</option>
          {ORDER_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
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
            className="min-w-0 flex-1 px-2"
            type="date"
            aria-label="Период с"
            value={start}
            max={end || undefined}
            onChange={(e) => {
              edit({ start: e.target.value, end });
            }}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            className="min-w-0 flex-1 px-2"
            type="date"
            aria-label="по"
            value={end}
            min={start || undefined}
            onChange={(e) => {
              edit({ start, end: e.target.value });
            }}
          />
          {changed && (
            <button
              type="button"
              aria-label="Сбросить период"
              title="Сбросить период"
              onClick={() => {
                edit(initial);
              }}
              className="inline-flex cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Номер запчасти, название или № заказа
        <Input
          type="text"
          value={text}
          onChange={(e) => {
            onText(e.target.value);
          }}
        />
      </label>
    </div>
  );
}
