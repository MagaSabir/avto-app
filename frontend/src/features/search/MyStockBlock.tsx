import { Link, useNavigate } from "react-router";

import type { StockSearchItem, SupplierSearchResult } from "@/api/search";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatPrice } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import { bestPriceFor, cheaperBy } from "./derive";
import { Skeleton, Tag } from "./Tag";

export type StockRow = { item: StockSearchItem; isAnalog: boolean };

type Props = {
  rows: StockRow[] | undefined;
  results: SupplierSearchResult[];
  loadingMatches: boolean;
  error?: Error | null;
};

const HEADERS: { label: string; right?: boolean }[] = [
  { label: "Статус" },
  { label: "Номер" },
  { label: "Бренд" },
  { label: "Название" },
  { label: "Связь" },
  { label: "Кол-во", right: true },
  { label: "Ячейка" },
  { label: "Цена", right: true },
  { label: "Продано 30 дн", right: true },
  { label: "Последний приход" },
  { label: "У Росско", right: true },
];

const itemUrl = (id: number) => `/stock?item=${String(id)}`;

function lastReceipt(it: StockSearchItem): string {
  if (it.last_receipt_at === null) return "—";
  const date = formatDate(it.last_receipt_at);
  return it.last_receipt_supplier === null
    ? date
    : `${date} · ${it.last_receipt_supplier}`;
}

// Rossko below my purchase price: restocking there is worth a look.
function Cheaper({ by }: { by: string }) {
  return (
    <span className="text-[12px] font-medium whitespace-nowrap text-status-low">
      {`на ${formatPrice(by)} ₽ дешевле закупки`}
    </span>
  );
}

function SupplierPrice({
  item,
  price,
  loading,
}: {
  item: StockSearchItem;
  price: string | null;
  loading: boolean;
}) {
  if (price === null)
    return loading ? <Skeleton className="ml-auto w-16" /> : <>—</>;
  const by = cheaperBy(item.purchase_price, price);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatPrice(price)} ₽</span>
      {by !== null && <Cheaper by={by} />}
    </span>
  );
}

export function MyStockBlock({
  rows,
  results,
  loadingMatches,
  error = null,
}: Props) {
  const navigate = useNavigate();
  const priceOf = (it: StockSearchItem) =>
    bestPriceFor(results, it.number_norm);

  return (
    <Card title="На моём складе">
      <div aria-busy={error === null && (rows === undefined || loadingMatches)}>
        {error !== null ? (
          <p className="py-4 text-center text-status-out [overflow-wrap:anywhere]">
            {error.message}
          </p>
        ) : rows === undefined ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton />
            <Skeleton />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            На складе нет
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    {HEADERS.map(({ label, right }) => (
                      <th
                        key={label}
                        className={cn(
                          "px-2 py-1.5 font-medium whitespace-nowrap",
                          right && "text-right",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item: it, isAnalog }) => (
                    <tr
                      key={it.id}
                      onClick={() => {
                        void navigate(itemUrl(it.id));
                      }}
                      className="h-9 cursor-pointer border-b hover:bg-muted"
                    >
                      <td className="px-2">
                        <StatusBadge status={it.status} />
                      </td>
                      <td className="px-2 font-mono font-medium whitespace-nowrap">
                        <Link
                          to={itemUrl(it.id)}
                          onClick={(e) => {
                            // The row navigates too; avoid a second push.
                            e.stopPropagation();
                          }}
                          className="hover:underline"
                        >
                          {it.number_raw}
                        </Link>
                      </td>
                      <td className="px-2 whitespace-nowrap">{it.brand}</td>
                      <td className="px-2">{it.name}</td>
                      <td className="px-2">
                        {isAnalog ? (
                          <Tag tone="analog">аналог</Tag>
                        ) : (
                          <Tag tone="neutral">искомый номер</Tag>
                        )}
                      </td>
                      <td className="px-2 text-right tabular-nums">{it.qty}</td>
                      <td className="px-2 font-mono whitespace-nowrap">
                        {it.cell ?? "—"}
                      </td>
                      <td className="px-2 text-right font-medium tabular-nums whitespace-nowrap">
                        {formatPrice(it.sale_price)} ₽
                      </td>
                      <td className="px-2 text-right tabular-nums">
                        {it.sold_30d}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {lastReceipt(it)}
                      </td>
                      <td className="px-2 text-right tabular-nums whitespace-nowrap">
                        <SupplierPrice
                          item={it}
                          price={priceOf(it)}
                          loading={loadingMatches}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map(({ item: it, isAnalog }) => {
                const price = priceOf(it);
                const by =
                  price === null ? null : cheaperBy(it.purchase_price, price);
                return (
                  <li key={it.id}>
                    <Link
                      to={itemUrl(it.id)}
                      className="block rounded-lg border p-3 hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">
                          {it.brand}{" "}
                          <span className="font-mono">{it.number_raw}</span>
                        </span>
                        <StatusBadge status={it.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span>{it.name}</span>
                        {isAnalog && <Tag tone="analog">аналог</Tag>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 tabular-nums">
                        <span className="font-semibold">{it.qty} шт</span>
                        {it.cell !== null && (
                          <span className="font-mono">{it.cell}</span>
                        )}
                        <span className="font-semibold">
                          {formatPrice(it.sale_price)} ₽
                        </span>
                        <span className="text-muted-foreground">
                          продано 30 дн: {it.sold_30d}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                        <span>Приход {lastReceipt(it)}</span>
                        {price !== null && (
                          <span>· у Росско {formatPrice(price)} ₽</span>
                        )}
                        {by !== null && <Cheaper by={by} />}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {error === null && loadingMatches && rows !== undefined && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="w-2/3" />
          </div>
        )}
      </div>
    </Card>
  );
}
