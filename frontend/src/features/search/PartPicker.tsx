import { formatPrice } from "@/features/stock/format";

import type { PartChoice } from "./derive";
import { plural } from "./format";

type Props = {
  parts: PartChoice[];
  onPick: (key: string) => void;
};

function meta(p: PartChoice): string {
  return [
    p.offers === 0
      ? "нет предложений"
      : `${String(p.offers)} ${plural(p.offers, "предложение", "предложения", "предложений")}`,
    p.minPrice !== null && `от ${formatPrice(p.minPrice)} ₽`,
    `${String(p.analogs)} ${plural(p.analogs, "аналог", "аналога", "аналогов")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

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
              className="flex min-h-9 w-full cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:flex-row md:items-center md:gap-x-3"
            >
              <span className="font-semibold whitespace-nowrap">
                {p.brand} <span className="font-mono">{p.number}</span>
              </span>{" "}
              {p.name !== "" && (
                <span className="min-w-0 md:flex-1 [overflow-wrap:anywhere]">
                  {p.name}
                </span>
              )}{" "}
              <span className="text-[13px] text-muted-foreground tabular-nums md:ml-auto md:whitespace-nowrap">
                {meta(p)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
