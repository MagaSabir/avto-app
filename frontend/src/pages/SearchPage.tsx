import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import type { StockSearchItem, SupplierSearchResult } from "@/api/search";
import {
  useStockSearch,
  useSupplierSearches,
  useSuppliers,
} from "@/api/search";
import {
  requestedParts,
  selectPart,
  visibleStock,
} from "@/features/search/derive";
import { FilterBar, type SearchFilters } from "@/features/search/FilterBar";
import { setLastSearch } from "@/features/search/lastSearch";
import { MyStockBlock } from "@/features/search/MyStockBlock";
import { PartPicker } from "@/features/search/PartPicker";
import { SearchForm } from "@/features/search/SearchForm";
import { SummaryCards } from "@/features/search/SummaryCards";
import { SuppliersBlock } from "@/features/search/SuppliersBlock";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const queryClient = useQueryClient();
  const search = params.toString();

  // Remembered for the "Поиск" link in the header.
  useEffect(() => {
    if (q !== "") setLastSearch(`?${search}`);
  }, [q, search]);
  const [filters, setFilters] = useState<SearchFilters>({
    inStockOnly: false,
    showAnalogs: true,
    sort: "price",
  });

  const stock = useStockSearch(q);
  const suppliers = useSuppliers();
  const codes = suppliers.data?.map((s) => s.code) ?? [];
  const searches = useSupplierSearches(codes, q);

  const onSearch = (next: string) => {
    if (next === q) {
      // Reset (not invalidate) so blocks drop old data and show loading again.
      // The supplier list stays: it does not depend on the number.
      void queryClient.resetQueries({ queryKey: ["search", "stock"] });
      void queryClient.resetQueries({ queryKey: ["search", "supplier"] });
    } else setParams({ q: next });
  };

  const answered: SupplierSearchResult[] = searches.flatMap((s) =>
    s.data?.status === "ok" ? [s.data] : [],
  );
  const pending = suppliers.isPending || searches.some((s) => s.isPending);

  // Two steps when one number names several parts: pick a part, then see
  // only its offers and analogs. A single part skips the list.
  const now = new Date();
  const parts = requestedParts(answered, now);
  const partParam = params.get("part");
  const chosen =
    parts.find((p) => p.key === partParam) ??
    (parts.length === 1 ? parts[0] : undefined);
  const picking = parts.length > 1 && chosen === undefined;
  const partKey = chosen?.key ?? null;
  const results = partKey === null ? answered : selectPart(answered, partKey);

  // The same stock item may match analogs of several suppliers.
  // Analog matches belong to a part, so none are shown before one is chosen.
  const matches = [
    ...new Map(
      (picking ? [] : results)
        .flatMap((r) => r.stock_matches)
        .map((it): [number, StockSearchItem] => [it.id, it]),
    ).values(),
  ];
  const rows = stock.data
    ? visibleStock(stock.data.items, matches, filters)
    : undefined;
  const stockNumbers = new Map<string, number>();
  for (const it of [...(stock.data?.items ?? []), ...matches])
    stockNumbers.set(
      it.number_norm,
      (stockNumbers.get(it.number_norm) ?? 0) + it.qty,
    );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Поиск</h1>
      <SearchForm key={q} initial={q} onSearch={onSearch} />
      {q !== "" && (
        <>
          <FilterBar
            {...filters}
            onChange={(patch) => {
              setFilters((f) => ({ ...f, ...patch }));
            }}
          />
          <SummaryCards
            items={rows?.map((r) => r.item)}
            stockFailed={stock.isError}
            results={results}
            pending={pending}
            pickPart={picking}
            opts={{ showAnalogs: filters.showAnalogs, now }}
          />
          <MyStockBlock
            rows={rows}
            // Prices match by number only, which mixes parts: none on step 1.
            results={picking ? [] : results}
            loadingMatches={pending}
            error={stock.error}
          />
          {(suppliers.data?.length ?? 0) > 0 && (
            <SuppliersBlock
              suppliers={suppliers.data ?? []}
              queries={searches}
              opts={{ ...filters, now }}
              results={results}
              stockNumbers={stockNumbers}
              picker={
                picking ? (
                  <PartPicker
                    parts={parts}
                    now={now}
                    onPick={(part) => {
                      setParams({ q, part });
                    }}
                  />
                ) : undefined
              }
              backTo={
                parts.length > 1 && !picking
                  ? `?${new URLSearchParams({ q }).toString()}`
                  : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
