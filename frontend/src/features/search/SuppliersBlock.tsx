import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { SupplierInfo, SupplierSearchResult } from "@/api/search";
import { Button } from "@/components/ui/button";
import { trimPercent } from "@/features/stock/format";
import { cn } from "@/lib/utils";

import {
  arrangeGroups,
  requestedParts,
  selectPart,
  type SortMode,
} from "./derive";
import { plural } from "./format";
import { PartGroupCard } from "./PartGroupCard";
import { Skeleton } from "./Tag";

type Props = {
  suppliers: SupplierInfo[];
  queries: UseQueryResult<SupplierSearchResult>[];
  opts: { showAnalogs: boolean; sort: SortMode; now: Date };
  // Stock qty by normalized number, for "у вас N шт".
  stockNumbers: Map<string, number>;
  // Step 2: show only this requested part and its analogs.
  partKey: string | null;
  // Step 1: the part list, shown instead of the groups.
  picker?: ReactNode;
  // Link back to the part list, when there are several parts.
  backTo?: string;
};

type State =
  | { kind: "wait" }
  | { kind: "error"; message: string }
  | { kind: "ok"; result: SupplierSearchResult };

function stateOf(q: UseQueryResult<SupplierSearchResult> | undefined): State {
  if (q === undefined || q.isPending || q.isFetching) return { kind: "wait" };
  if (q.isError) return { kind: "error", message: q.error.message };
  if (q.data.status === "error")
    return { kind: "error", message: q.data.message ?? "Ошибка поставщика" };
  return { kind: "ok", result: q.data };
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

export function SuppliersBlock({
  suppliers,
  queries,
  opts,
  stockNumbers,
  partKey,
  picker,
  backTo,
}: Props) {
  const entries = suppliers.map((s, i) => {
    const query = queries.at(i);
    const state = stateOf(query);
    const result =
      state.kind !== "ok"
        ? null
        : partKey === null
          ? state.result
          : (selectPart([state.result], partKey)[0] ?? state.result);
    const groups = result === null ? [] : arrangeGroups(result.groups, opts);
    // Step 1 counts requested parts, step 2 the groups shown.
    const count =
      result === null
        ? 0
        : picker !== undefined
          ? requestedParts([result]).length
          : groups.length;
    return { supplier: s, query, state, groups, count };
  });
  const markup = entries.find((e) => e.state.kind === "ok");

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
        {markup?.state.kind === "ok" && (
          <span className="text-[13px] text-muted-foreground md:ml-auto">
            цены с наценкой {trimPercent(markup.state.result.markup)}%,
            округление вверх до 10 ₽
          </span>
        )}
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
        {entries.map(({ supplier, query, state, groups }) => (
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
            {state.kind === "ok" && picker === undefined && (
              <>
                {groups.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">
                    Ничего не найдено
                  </p>
                ) : (
                  groups.map((g) => (
                    <PartGroupCard
                      key={g.key}
                      group={g}
                      supplier={supplier.title}
                      stockQty={stockNumbers.get(g.number_norm)}
                      now={opts.now}
                    />
                  ))
                )}
              </>
            )}
          </div>
        ))}
        {picker}
      </div>
    </section>
  );
}
