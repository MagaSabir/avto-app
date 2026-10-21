import { useId } from "react";

import { formatPrice } from "@/features/stock/format";

import { groupPartsByName, type PartChoice } from "./derive";
import { formatDelivery, plural } from "./format";

type Props = {
  parts: PartChoice[];
  now: Date;
  onPick: (key: string) => void;
};

const COLS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 md:grid-cols-[12rem_minmax(0,1fr)_auto]";

function NameCard({ name, parts, now, onPick }: Props & { name: string }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <h4 id={id} className="bg-muted px-3 py-2.5 text-[15px] font-semibold">
        {name === "" ? "Без названия" : name}
      </h4>
      <div
        aria-hidden="true"
        className={`${COLS} border-b px-3 py-1.5 text-[12px] text-muted-foreground`}
      >
        <span className="hidden md:block">Бренд</span>
        <span>Артикул / Наименование</span>
        <span className="text-right">Цена</span>
      </div>
      <ul>
        {parts.map((p) => (
          <li key={p.key} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => {
                onPick(p.key);
              }}
              className={`${COLS} min-h-14 w-full cursor-pointer items-center px-3 py-2 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset`}
            >
              <span className="col-span-2 text-[20px] leading-tight font-semibold [overflow-wrap:anywhere] text-muted-foreground md:col-span-1">
                {p.brand}
              </span>{" "}
              <span className="flex min-w-0 flex-col">
                <span className="font-mono [overflow-wrap:anywhere]">
                  {p.number}
                </span>{" "}
                {p.name !== "" && (
                  <span className="[overflow-wrap:anywhere]">{p.name}</span>
                )}
              </span>{" "}
              <span className="flex flex-col items-end text-right">
                {p.fastest === null ? (
                  <>
                    <span className="font-semibold">—</span>
                    <span className="text-[12px] text-muted-foreground">
                      нет в наличии
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {formatPrice(p.fastest.purchase_price)} ₽
                    </span>
                    <span className="text-[12px] whitespace-nowrap">
                      {formatDelivery(p.fastest, now)}
                    </span>
                  </>
                )}
                {p.analogs > 0 && (
                  <span className="text-[12px] whitespace-nowrap text-muted-foreground">
                    {`+ ${String(p.analogs)} ${plural(p.analogs, "аналог", "аналога", "аналогов")}`}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Step 1: one card per part name, a row per part; a row opens step 2.
export function PartPicker({ parts, now, onPick }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[20px] font-bold">Результаты поиска</h3>
      {groupPartsByName(parts).map((card) => (
        <NameCard
          key={card.parts[0]?.key ?? card.name}
          name={card.name}
          parts={card.parts}
          now={now}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
