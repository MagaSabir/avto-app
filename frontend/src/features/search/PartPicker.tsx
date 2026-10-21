import { formatPrice } from "@/features/stock/format";

import type { PartChoice } from "./derive";
import { plural } from "./format";

type Props = {
  parts: PartChoice[];
  onPick: (key: string) => void;
};

export function PartPicker({ parts, onPick }: Props) {
  return (
    <div>
      <h3 className="font-semibold">Выберите деталь</h3>
      <ul className="mt-1 flex flex-col">
        {parts.map((p) => (
          <li key={p.key} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => {
                onPick(p.key);
              }}
              className="flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{p.brand}</span>{" "}
                <span className="font-mono font-semibold [overflow-wrap:anywhere]">
                  {p.number}
                </span>{" "}
                {p.name !== "" && (
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {p.name}
                  </span>
                )}
              </span>{" "}
              <span className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground tabular-nums">
                <span>
                  {p.offers === 0
                    ? "нет предложений"
                    : `${String(p.offers)} ${plural(p.offers, "предложение", "предложения", "предложений")}`}
                </span>{" "}
                {p.minPrice !== null && (
                  <span className="font-semibold text-foreground">
                    от {formatPrice(p.minPrice)} ₽
                  </span>
                )}{" "}
                <span>
                  {p.analogs}{" "}
                  {plural(p.analogs, "аналог", "аналога", "аналогов")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
