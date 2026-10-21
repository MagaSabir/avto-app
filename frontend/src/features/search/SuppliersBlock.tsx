import type { UseQueryResult } from "@tanstack/react-query";

import type { SupplierInfo, SupplierSearchResult } from "@/api/search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { arrangeGroups, type SortMode } from "./derive";
import { plural } from "./format";
import { PartGroupCard } from "./PartGroupCard";
import { Skeleton } from "./Tag";

type Props = {
  suppliers: SupplierInfo[];
  queries: UseQueryResult<SupplierSearchResult>[];
  opts: { showAnalogs: boolean; sort: SortMode; now: Date };
  // Stock qty by normalized number, for "у вас N шт".
  stockNumbers: Map<string, number>;
};

type State =
  | { kind: "wait" }
  | { kind: "error"; message: string }
  | { kind: "ok"; result: SupplierSearchResult };

function stateOf(q: UseQueryResult<SupplierSearchResult> | undefined): State {
  if (q === undefined || q.isPending || q.isFetching) return { kind: "wait" };
  if (q.isError) return { kind: "error", message: q.error.message };
  if (q.data.status === "error")
    return { kind: "error", message: q.data.message ?? "" };
  return { kind: "ok", result: q.data };
}

// "20.00" -> "20", "12.50" -> "12,5"
function formatPercent(v: string): string {
  return v.includes(".") ? v.replace(/\.?0+$/, "").replace(".", ",") : v;
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
}: Props) {
  const entries = suppliers.map((s, i) => {
    const query = queries.at(i);
    const state = stateOf(query);
    const groups =
      state.kind === "ok" ? arrangeGroups(state.result.groups, opts) : [];
    return { supplier: s, query, state, groups };
  });
  const markup = entries.find((e) => e.state.kind === "ok");

  return (
    <section className="rounded-lg border bg-card p-3.5 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[15px] font-semibold">Предложения поставщиков</h2>
        {entries.map(({ supplier, state, groups }) => (
          <Plaque
            key={supplier.code}
            tone={state.kind}
            text={
              state.kind === "wait"
                ? `${supplier.title} · ждём ответ…`
                : state.kind === "error"
                  ? `${supplier.title} · ошибка`
                  : `${supplier.title} · ${String(groups.length)} ${plural(groups.length, "деталь", "детали", "деталей")}`
            }
          />
        ))}
        {markup?.state.kind === "ok" && (
          <span className="text-[13px] text-muted-foreground md:ml-auto">
            цены с наценкой {formatPercent(markup.state.result.markup)}%,
            округление вверх до 10 ₽
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {entries.map(({ supplier, query, state, groups }) => (
          <div
            key={supplier.code}
            aria-busy={state.kind === "wait"}
            className="flex flex-col gap-3"
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
            {state.kind === "ok" && (
              <>
                {state.result.message !== null && (
                  <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                    {state.result.message}
                  </p>
                )}
                {groups.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">
                    Ничего не найдено
                  </p>
                ) : (
                  groups.map((g) => (
                    <PartGroupCard
                      key={`${g.brand}|${g.number_norm}`}
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
      </div>
    </section>
  );
}
