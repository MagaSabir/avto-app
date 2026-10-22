import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import type { SettlementDocument } from "@/api/settlements";
import { cn } from "@/lib/utils";

import { kopecks, money } from "./derive";
import { formatAmount, formatDocDate } from "./format";

const HEADERS = [
  { label: "Дата" },
  { label: "Операция" },
  { label: "Оплачено", right: true },
  { label: "Отгружено", right: true },
  { label: "Статус оплаты" },
  { label: "Баланс, ₽", right: true },
  { label: "" },
];

function Items({ doc }: { doc: SettlementDocument }) {
  const sums = doc.items.map((it) => kopecks(it.price) * BigInt(it.count));
  const total = sums.reduce((a, b) => a + b, 0n);
  const count = doc.items.reduce((n, it) => n + it.count, 0);
  return (
    <table aria-label="Товары" className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr className="border-b text-left text-[12px] text-muted-foreground">
          <th className="py-1.5 pr-4 font-medium">Наименование</th>
          <th className="py-1.5 pr-4 text-right font-medium">Заказано</th>
          <th className="py-1.5 text-right font-medium">Сумма, ₽</th>
        </tr>
      </thead>
      <tbody>
        {doc.items.map((it, i) => (
          <tr key={i} className="h-9 border-b">
            <td className="pr-4">{it.name}</td>
            <td className="pr-4 text-right whitespace-nowrap tabular-nums">
              {`${String(it.count)} шт.`}
            </td>
            <td className="text-right font-mono whitespace-nowrap">
              {formatAmount(money(sums[i] ?? 0n))}
            </td>
          </tr>
        ))}
        <tr className="h-10 font-semibold">
          <td className="pr-4 text-right">ИТОГО:</td>
          <td className="pr-4 text-right whitespace-nowrap tabular-nums">
            {`${String(count)} шт.`}
          </td>
          <td className="text-right font-mono whitespace-nowrap">
            {formatAmount(money(total))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function DocumentRow({
  doc,
  paid,
}: {
  doc: SettlementDocument;
  paid: string | null;
}) {
  const [open, setOpen] = useState(false);
  const expandable = doc.items.length > 0;
  const toggle = () => {
    setOpen(!open);
  };
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <tr
        onClick={expandable ? toggle : undefined}
        className={cn(
          "h-11 border-b",
          expandable && "cursor-pointer",
          open ? "bg-selected" : "hover:bg-muted",
        )}
      >
        <td className="px-2 whitespace-nowrap">{formatDocDate(doc.date)}</td>
        <td className="px-2">{doc.name}</td>
        <td className="px-2 text-right font-mono whitespace-nowrap">
          {paid === null ? "" : formatAmount(paid)}
        </td>
        <td className="px-2 text-right font-mono whitespace-nowrap">
          {kopecks(doc.amount) === 0n ? "" : formatAmount(doc.amount)}
        </td>
        <td className="px-2 whitespace-nowrap">{doc.status}</td>
        <td
          className={cn(
            "px-2 text-right font-mono whitespace-nowrap",
            doc.balance.startsWith("-") && "text-destructive",
          )}
        >
          {formatAmount(doc.balance)}
        </td>
        <td className="w-8 px-1">
          {expandable && (
            <button
              type="button"
              aria-label="Товары"
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="inline-flex cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <Chevron size={16} aria-hidden="true" />
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-b">
          <td colSpan={HEADERS.length} className="bg-card px-6 py-2">
            <Items doc={doc} />
          </td>
        </tr>
      )}
    </>
  );
}

export function DocumentsTable({
  documents,
  paid,
}: {
  documents: SettlementDocument[];
  paid: (string | null)[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-[12px] text-muted-foreground">
            {HEADERS.map(({ label, right }, i) => (
              <th
                key={i}
                className={cn("px-2 py-2 font-medium", right && "text-right")}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, i) => (
            <Fragment key={`${doc.date}-${doc.name}-${String(i)}`}>
              <DocumentRow doc={doc} paid={paid[i] ?? null} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
