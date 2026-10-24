import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import type { Offer, SupplierSearchResult } from "@/api/search";
import {
  useAnalogStock,
  useStockSearch,
  useSupplierSearches,
  useSuppliers,
} from "@/api/search";
import {
  partCards,
  selectPart,
  stockQty,
  visibleStock,
} from "@/features/search/derive";
import { FilterBar, type SearchFilters } from "@/features/search/FilterBar";
import { setLastSearch } from "@/features/search/lastSearch";
import { MyStockBlock } from "@/features/search/MyStockBlock";
import { PartPicker } from "@/features/search/PartPicker";
import { SearchForm } from "@/features/search/SearchForm";
import { SummaryCards } from "@/features/search/SummaryCards";
import { SuppliersBlock } from "@/features/search/SuppliersBlock";
import {
  loadSupplierChoice,
  saveSupplierChoice,
  selectedSuppliers,
} from "@/features/search/supplierChoice";
import {
  ToStockDialog,
  type ReceiptPart,
} from "@/features/search/ToStockDialog";

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
    showAnalogs: true,
    sort: "price",
  });

  const [toStock, setToStock] = useState<{
    group: ReceiptPart;
    offer: Offer;
    supplierTitle: string;
  } | null>(null);

  const stock = useStockSearch(q);
  const suppliers = useSuppliers();
  const [saved, setSaved] = useState(loadSupplierChoice);
  const selected = selectedSuppliers(suppliers.data ?? [], saved);
  const codes = selected.map((s) => s.code);
  const searches = useSupplierSearches(codes, q, {
    mikado: true,
  });

  const onSearch = (next: string) => {
    if (next === q) {
      // Reset (not invalidate) so blocks drop old data and show loading again.
      // The supplier list stays: it does not depend on the number.
      void queryClient.resetQueries({ queryKey: ["search", "stock"] });
      void queryClient.resetQueries({ queryKey: ["search", "supplier"] });
    } else {
      // A new submit always asks suppliers again, even if this number was
      // answered earlier (the cache is for Back and the Stock screen only).
      queryClient.removeQueries({
        queryKey: ["search", "supplier"],
        predicate: (query) => query.queryKey[3] === next,
      });
      setParams({ q: next });
    }
  };

  const answered: SupplierSearchResult[] = searches.flatMap((s) =>
    s.data?.status === "ok" ? [s.data] : [],
  );
  const pending = suppliers.isPending || searches.some((s) => s.isPending);

  // Two steps: pick a supplier's part (a card), then see its offers and
  // analogs. A single card skips the list once every supplier has answered.
  const now = new Date();
  const cards = partCards(answered, { ...filters, now });
  const supplierParam = params.get("supplier");
  const partParam = params.get("part");
  const chosen =
    cards.find(
      (c) => c.supplier === supplierParam && c.group.key === partParam,
    ) ?? (cards.length === 1 && !pending ? cards[0] : undefined);
  const picking = cards.length > 0 && chosen === undefined;
  const chosenResult = answered.find((r) => r.code === chosen?.supplier);
  const results =
    chosen === undefined || chosenResult === undefined
      ? answered
      : selectPart([chosenResult], chosen.group.key);
  const stepSuppliers =
    chosen === undefined
      ? selected
      : selected.filter((s) => s.code === chosen.supplier);
  const stepQueries =
    chosen === undefined
      ? searches
      : searches.filter((_, i) => selected.at(i)?.code === chosen.supplier);

  const waitingTitles: { title: string }[] = [];
  const errors: { title: string; message: string; retry: () => void }[] = [];
  selected.forEach((s, i) => {
    const q = searches.at(i);
    if (q === undefined || q.isPending || q.isFetching) {
      waitingTitles.push({ title: s.title });
    } else if (q.isError || q.data.status === "error") {
      errors.push({
        title: s.title,
        message: q.isError
          ? q.error.message
          : (q.data.message ?? "Ошибка поставщика"),
        retry: () => {
          void q.refetch();
        },
      });
    }
  });

  // Analog stock is its own local query, so it can be refreshed after a
  // receipt without asking suppliers again. Analogs belong to a part, so none
  // are looked up before one is chosen.
  const analogNumbers = picking
    ? []
    : [
        ...new Set(
          results.flatMap((r) =>
            r.groups.filter((g) => !g.is_requested).map((g) => g.number_norm),
          ),
        ),
      ].filter((n) => n !== stock.data?.number_norm);
  const matches = useAnalogStock(analogNumbers).data ?? [];
  const rows = stock.data
    ? visibleStock(stock.data.items, matches, {
        ...filters,
        inStockOnly: false,
      })
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
            suppliers={suppliers.data ?? []}
            chosen={codes}
            onChoose={(next) => {
              setSaved(next);
              saveSupplierChoice(next);
            }}
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
          {picking && (
            <div className="flex flex-col gap-3">
              {answered.map(
                (r) =>
                  r.message !== null && (
                    <p
                      key={r.code}
                      className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]"
                    >
                      {r.message}
                    </p>
                  ),
              )}
              <PartPicker
                cards={cards}
                stockQty={(key) => stockQty(stock.data?.items ?? [], key)}
                now={now}
                pending={waitingTitles}
                errors={errors}
                onPick={(supplier, part) => {
                  setParams({ q, supplier, part });
                }}
              />
            </div>
          )}
          {!picking && (suppliers.data?.length ?? 0) > 0 && (
            <SuppliersBlock
              suppliers={stepSuppliers}
              queries={stepQueries}
              opts={{ ...filters, now }}
              results={results}
              stockNumbers={stockNumbers}
              onToStock={(group, offer, supplierTitle) => {
                setToStock({ group, offer, supplierTitle });
              }}
              backTo={
                cards.length > 1 && chosen !== undefined
                  ? `?${new URLSearchParams({ q }).toString()}`
                  : undefined
              }
            />
          )}
        </>
      )}
      <ToStockDialog
        supplierTitle={toStock?.supplierTitle ?? ""}
        target={toStock}
        onClose={() => {
          setToStock(null);
        }}
      />
    </div>
  );
}
