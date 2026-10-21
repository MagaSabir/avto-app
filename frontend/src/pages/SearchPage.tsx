import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";

import type { StockSearchItem, SupplierSearchResult } from "@/api/search";
import {
  useStockSearch,
  useSupplierSearches,
  useSuppliers,
} from "@/api/search";
import { visibleStock } from "@/features/search/derive";
import { FilterBar, type SearchFilters } from "@/features/search/FilterBar";
import { MyStockBlock } from "@/features/search/MyStockBlock";
import { SearchForm } from "@/features/search/SearchForm";
import { SummaryCards } from "@/features/search/SummaryCards";
import { SuppliersBlock } from "@/features/search/SuppliersBlock";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const queryClient = useQueryClient();
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
    if (next === q)
      // Reset (not invalidate) so blocks drop old data and show loading again.
      void queryClient.resetQueries({ queryKey: ["search"] });
    else setParams({ q: next });
  };

  const results: SupplierSearchResult[] = searches.flatMap((s) =>
    s.data?.status === "ok" ? [s.data] : [],
  );
  const pending = suppliers.isPending || searches.some((s) => s.isPending);

  // The same stock item may match analogs of several suppliers.
  const matches = [
    ...new Map(
      results
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
  const now = new Date();

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
            opts={{ showAnalogs: filters.showAnalogs, now }}
          />
          <MyStockBlock
            rows={rows}
            results={results}
            loadingMatches={pending}
            error={stock.error}
          />
          {(suppliers.data?.length ?? 0) > 0 && (
            <SuppliersBlock
              suppliers={suppliers.data ?? []}
              queries={searches}
              opts={{ ...filters, now }}
              stockNumbers={stockNumbers}
            />
          )}
        </>
      )}
    </div>
  );
}
