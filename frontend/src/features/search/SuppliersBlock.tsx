import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Offer, SupplierInfo, SupplierSearchResult } from "@/api/search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  arrangeGroups,
  mergeGroups,
  requestedParts,
  type MergedGroup,
  type SortMode,
} from "./derive";
import { plural } from "./format";
import { PART_COLS, PartRow } from "./PartRow";
import { Skeleton } from "./Tag";
import type { ReceiptPart } from "./ToStockDialog";

type Props = {
  suppliers: SupplierInfo[];
  queries: UseQueryResult<SupplierSearchResult>[];
  // Successful answers to show, already narrowed to the chosen part.
  results: SupplierSearchResult[];
  opts: { showAnalogs: boolean; sort: SortMode; now: Date };
  // Stock qty by normalized number, for "у вас N шт".
  stockNumbers: Map<string, number>;
  // Step 1: the part list, shown instead of the groups.
  picker?: ReactNode;
  // Link back to the part list, when there are several parts.
  backTo?: string;
  onToStock: (group: ReceiptPart, offer: Offer, supplierTitle: string) => void;
};

type State =
  | { kind: "wait" }
  | { kind: "error"; message: string }
  | { kind: "ok"; result: SupplierSearchResult };

function stateOf(
  q: UseQueryResult<SupplierSearchResult> | undefined,
  shown: SupplierSearchResult | undefined,
): State {
  if (q === undefined || q.isPending || q.isFetching) return { kind: "wait" };
  if (q.isError) return { kind: "error", message: q.error.message };
  if (q.data.status === "error")
    return { kind: "error", message: q.data.message ?? "Ошибка поставщика" };
  return shown === undefined ? { kind: "wait" } : { kind: "ok", result: shown };
}

function Plaque({ tone, text }: { tone: State["kind"]; text: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap",
        tone === "ok" && "bg-status-ok-bg text-status-ok",
        tone === "wait" && "border bg-muted text-muted-foreground",
        tone === "error" && "bg-status-out-bg text-status-out",
      )}
    >
      {text}
    </span>
  );
}

const HEADERS: { label: string; right?: boolean }[] = [
  { label: "Бренд" },
  { label: "Номер" },
  { label: "Наименование" },
  { label: "Можно забрать" },
  { label: "Остаток", right: true },
  { label: "Цена", right: true },
  { label: "Действия", right: true },
];

type ListProps = {
  groups: MergedGroup[];
  stockNumbers: Map<string, number>;
  now: Date;
  onToStock: (group: ReceiptPart, offer: Offer, supplierTitle: string) => void;
};

function PartList({ groups, stockNumbers, now, onToStock }: ListProps) {
  return (
    <div className="text-[13.5px]">
      <div
        aria-hidden="true"
        className={cn(
          "hidden border-b px-2 py-1.5 text-[12px] font-medium text-muted-foreground md:grid",
          PART_COLS,
        )}
      >
        {HEADERS.map(({ label, right }) => (
          <span key={label} className={cn(right && "text-right")}>
            {label}
          </span>
        ))}
      </div>
      <ul>
        {groups.map((g) => (
          <PartRow
            key={g.key}
            onToStock={onToStock}
            group={g}
            stockQty={stockNumbers.get(g.number_norm)}
            now={now}
          />
        ))}
      </ul>
    </div>
  );
}

// The chosen part first, then its analogs under their own heading.
function Parts(props: ListProps) {
  const requested = props.groups.filter((g) => g.is_requested);
  const analogs = props.groups.filter((g) => !g.is_requested);
  return (
    <>
      {requested.length > 0 && <PartList {...props} groups={requested} />}
      {analogs.length > 0 && (
        <>
          <h3 className="mt-2 text-[15px] font-semibold">Аналоги</h3>
          <PartList {...props} groups={analogs} />
        </>
      )}
    </>
  );
}

export function SuppliersBlock({
  suppliers,
  queries,
  results,
  opts,
  stockNumbers,
  picker,
  backTo,
  onToStock,
}: Props) {
  const entries = suppliers.map((s, i) => {
    const query = queries.at(i);
    const state = stateOf(
      query,
      results.find((r) => r.code === s.code),
    );
    const result = state.kind === "ok" ? state.result : null;
    // Step 1 counts requested parts, step 2 the parts shown.
    const count =
      result === null
        ? 0
        : picker !== undefined
          ? requestedParts([result], opts.now).length
          : result.groups.filter((g) => opts.showAnalogs || g.is_requested)
              .length;
    return { supplier: s, query, state, result, count };
  });
  // Step 2: one row per part, each supplier's offers inside it.
  const answered = entries.flatMap((e) =>
    e.result === null ? [] : [e.result],
  );
  const groups = arrangeGroups(mergeGroups(answered), opts);
  const settled = entries.every((e) => e.state.kind !== "wait");

  return (
    <section className="rounded-lg border bg-card p-3.5 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[15px] font-semibold">Предложения поставщиков</h2>
        {entries.map(({ supplier, state, count }) => (
          <Plaque
            key={supplier.code}
            tone={state.kind}
            text={
              state.kind === "wait"
                ? `${supplier.title} · ждём ответ…`
                : state.kind === "error"
                  ? `${supplier.title} · ошибка`
                  : `${supplier.title} · ${String(count)} ${plural(count, "деталь", "детали", "деталей")}`
            }
          />
        ))}
      </div>
      {backTo !== undefined && (
        <Link
          to={backTo}
          className="mb-2 inline-block rounded-sm text-[13px] text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          ← все детали
        </Link>
      )}
      <div className="flex flex-col gap-3">
        {entries.map(({ supplier, query, state }) => (
          <div
            key={supplier.code}
            aria-busy={state.kind === "wait"}
            className="flex flex-col gap-3 empty:hidden"
          >
            {state.kind === "wait" && (
              <div className="flex flex-col gap-2 py-1">
                <Skeleton />
                <Skeleton className="w-2/3" />
                <Skeleton />
              </div>
            )}
            {state.kind === "error" && (
              <div className="flex flex-wrap items-center gap-3 py-2">
                <p className="text-status-out [overflow-wrap:anywhere]">
                  {state.message}
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    void query?.refetch();
                  }}
                >
                  Повторить
                </Button>
              </div>
            )}
            {state.kind === "ok" && state.result.message !== null && (
              <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                {state.result.message}
              </p>
            )}
          </div>
        ))}
        {picker === undefined &&
          (groups.length > 0 ? (
            <Parts
              groups={groups}
              stockNumbers={stockNumbers}
              now={opts.now}
              onToStock={onToStock}
            />
          ) : (
            settled &&
            answered.length > 0 && (
              <p className="py-4 text-center text-muted-foreground">
                Ничего не найдено
              </p>
            )
          ))}
        {picker}
      </div>
    </section>
  );
}
