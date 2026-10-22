import { Fragment, useState } from "react";

import type { SettlementDocument } from "@/api/settlements";
import { formatDateTime, formatMoney } from "@/features/stock/format";

import { formatSigned } from "./format";

const HEADERS = [
  { label: "Дата" },
  { label: "Документ" },
  { label: "Сумма", right: true },
  { label: "Баланс после", right: true },
  { label: "Статус" },
  { label: "№ заказа" },
];

function DocumentRow({ doc }: { doc: SettlementDocument }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="h-9 border-b hover:bg-muted">
        <td className="px-2 whitespace-nowrap tabular-nums">
          {formatDateTime(doc.date)}
        </td>
        <td className="px-2">
          <div className="flex items-center gap-2">
            <span>{doc.name}</span>
            {doc.items.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpen(!open);
                }}
                className="cursor-pointer text-[12px] whitespace-nowrap text-primary"
              >
                {`Товары: ${String(doc.items.length)}`}
              </button>
            )}
          </div>
        </td>
        <td className="px-2 text-right font-mono whitespace-nowrap">
          {/^0*(\.0*)?$/.test(doc.amount) ? "" : `${formatMoney(doc.amount)} ₽`}
        </td>
        <td className="px-2 text-right font-mono whitespace-nowrap">
          {formatSigned(doc.balance)}
        </td>
        <td className="px-2 whitespace-nowrap">{doc.status}</td>
        <td className="px-2 font-mono">{doc.order_id ?? ""}</td>
      </tr>
      {open &&
        doc.items.map((item, i) => (
          <tr key={i} className="h-8 border-b bg-muted/40 text-[13px]">
            <td />
            <td className="px-2 pl-6">{item.name}</td>
            <td className="px-2 text-right tabular-nums">{item.count}</td>
            <td className="px-2 text-right font-mono whitespace-nowrap">
              {`${formatMoney(item.price)} ₽`}
            </td>
            <td colSpan={2} />
          </tr>
        ))}
    </>
  );
}

export function DocumentsTable({
  documents,
}: {
  documents: SettlementDocument[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-[12px] text-muted-foreground">
            {HEADERS.map(({ label, right }) => (
              <th
                key={label}
                className={`px-2 py-1.5 font-medium ${right ? "text-right" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, i) => (
            <Fragment key={`${doc.date}-${doc.name}-${String(i)}`}>
              <DocumentRow doc={doc} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
