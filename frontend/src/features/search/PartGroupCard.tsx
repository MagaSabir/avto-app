import type { PartGroup } from "@/api/search";
import { formatMoney, formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import { formatDelivery, kindLabel } from "./format";
import { Tag } from "./Tag";

type Props = {
  group: PartGroup;
  supplier: string;
  stockQty: number | undefined;
  now: Date;
};

// Fixed widths keep columns aligned across all group tables.
const HEADERS: { label: string; width?: string; right?: boolean }[] = [
  { label: "Склад" },
  { label: "Наличие", width: "w-20", right: true },
  { label: "Кратн.", width: "w-16", right: true },
  { label: "Срок", width: "w-44" },
  { label: "Тип", width: "w-28" },
  { label: "Закупка", width: "w-28", right: true },
  { label: "Цена", width: "w-28", right: true },
];

export function PartGroupCard({ group, supplier, stockQty, now }: Props) {
  return (
    <article className="border-t pt-3">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{group.brand}</span>
        <span className="font-mono font-semibold [overflow-wrap:anywhere]">
          {group.number}
        </span>
        {group.name !== "" && (
          <span className="min-w-0 [overflow-wrap:anywhere]">{group.name}</span>
        )}
        {group.is_requested ? (
          <Tag tone="neutral">искомый номер</Tag>
        ) : (
          <Tag tone="analog">аналог</Tag>
        )}
        {stockQty !== undefined && stockQty > 0 && (
          <Tag tone="ok">у вас {stockQty} шт</Tag>
        )}
      </header>
      {group.offers.length === 0 ? (
        <p className="py-2 text-muted-foreground">нет предложений</p>
      ) : (
        <>
          <div className="mt-1 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b text-left text-[12px] text-muted-foreground">
                  {HEADERS.map(({ label, width, right }) => (
                    <th
                      key={label}
                      className={cn(
                        "px-2 py-1.5 font-medium whitespace-nowrap",
                        width,
                        right && "text-right",
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.offers.map((o, i) => (
                  <tr key={i} className="h-9 border-b last:border-b-0">
                    <td className="px-2 [overflow-wrap:anywhere]">
                      {o.warehouse}
                    </td>
                    <td className="px-2 text-right tabular-nums whitespace-nowrap">
                      {o.qty} шт
                    </td>
                    <td className="px-2 text-right tabular-nums">
                      {o.multiplicity}
                    </td>
                    <td className="px-2 whitespace-nowrap">
                      {formatDelivery(o, now)}
                    </td>
                    <td className="px-2 whitespace-nowrap text-muted-foreground">
                      {kindLabel(o)}
                    </td>
                    <td className="px-2 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                      {formatMoney(o.purchase_price)}
                    </td>
                    <td className="px-2 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(o.price)} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-1 flex flex-col md:hidden">
            {group.offers.map((o, i) => (
              <li key={i} className="border-b py-2 last:border-b-0">
                <div className="tabular-nums">
                  <span className="font-semibold">
                    {formatPrice(o.price)} ₽
                  </span>
                  <span className="text-muted-foreground"> · {supplier}</span>
                </div>
                <div className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                  {o.qty} шт · {formatDelivery(o, now)} · {o.warehouse}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
