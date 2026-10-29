import { useSearchParams } from "react-router";

import { useCash } from "@/api/cash";
import { Input } from "@/components/ui/input";
import { CashOperations } from "@/features/cash/CashOperations";
import { CashTotalsTiles } from "@/features/cash/CashTotals";
import {
  activePreset,
  isoDate,
  isValidPeriod,
  PRESETS,
  presetPeriod,
} from "@/features/cash/period";
import { cn } from "@/lib/utils";

export function CashPage() {
  const [params, setParams] = useSearchParams();
  const today = new Date();
  const todayIso = isoDate(today);
  const rawStart = params.get("start") ?? "";
  const rawEnd = params.get("end") ?? "";
  const valid = isValidPeriod(rawStart, rawEnd);
  const start = valid ? rawStart : todayIso;
  const end = valid ? rawEnd : todayIso;
  const active = activePreset(start, end, today);
  const result = useCash(start, end);

  const setPeriod = (next: { start: string; end: string }) => {
    if (!isValidPeriod(next.start, next.end)) return;
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-bold">Касса</h1>
      <div className="flex flex-wrap items-end gap-2">
        {PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={active === value}
            onClick={() => {
              setPeriod(presetPeriod(value, today));
            }}
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium",
              active === value
                ? "border-foreground bg-foreground text-card"
                : "bg-card text-foreground hover:bg-selected",
            )}
          >
            {label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          с
          <Input
            type="date"
            value={start}
            onChange={(e) => {
              setPeriod({ start: e.target.value, end });
            }}
            className="h-8 w-auto"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          по
          <Input
            type="date"
            value={end}
            onChange={(e) => {
              setPeriod({ start, end: e.target.value });
            }}
            className="h-8 w-auto"
          />
        </label>
      </div>
      {result.isPending ? (
        <p className="py-6 text-center text-muted-foreground">Загрузка…</p>
      ) : result.isError ? (
        <p role="alert" className="text-destructive">
          {result.error.message}
        </p>
      ) : (
        <>
          <CashTotalsTiles totals={result.data.totals} />
          <CashOperations
            operations={result.data.operations}
            singleDay={start === end}
          />
        </>
      )}
    </div>
  );
}
