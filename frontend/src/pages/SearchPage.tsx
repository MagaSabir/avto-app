import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { Offer, SupplierSearchResult } from "@/api/search";
import {
  useAnalogStock,
  useStockSearch,
  useSupplierSearches,
  useSuppliers,
} from "@/api/search";
import {
  partCards,
  stockQty,
  supplierBest,
  supplierPart,
} from "@/features/search/derive";
import { FilterBar, type SearchFilters } from "@/features/search/FilterBar";
import { setLastSearch } from "@/features/search/lastSearch";
import { PartPicker } from "@/features/search/PartPicker";
import { PartTable } from "@/features/search/PartTable";
import { SearchForm } from "@/features/search/SearchForm";
import {
  loadSupplierChoice,
  saveSupplierChoice,
  selectedSuppliers,
} from "@/features/search/supplierChoice";
import { SummaryPanel } from "@/features/search/SummaryPanel";
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
  const chosenResult = answered.find((r) => r.code === chosen?.supplier);
  const chosenQuery = searches.at(codes.indexOf(chosen?.supplier ?? ""));
  const part =
    chosen === undefined || chosenResult === undefined
      ? undefined
      : { ...supplierPart(chosenResult, chosen.group.key), card: chosen };

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
  const analogNumbers =
    part === undefined
      ? []
      : [...new Set(part.analogs.map((g) => g.number_norm))].filter(
          (n) => n !== stock.data?.number_norm,
        );
  const matches = useAnalogStock(analogNumbers).data ?? [];
  const myItems = [...(stock.data?.items ?? []), ...matches];

  const best =
    part === undefined
      ? { cheapest: null, fastest: null }
      : supplierBest(
          filters.showAnalogs
            ? [part.card.group, ...part.analogs]
            : [part.card.group],
          now,
        );
  const onToStock = (
    group: ReceiptPart,
    offer: Offer,
    supplierTitle: string,
  ) => {
    setToStock({ group, offer, supplierTitle });
  };

  const nothing =
    cards.length === 0 &&
    waitingTitles.length === 0 &&
    errors.length === 0 &&
    !suppliers.isPending;

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
          {part === undefined ? (
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
                onPick={(supplier, key) => {
                  setParams({ q, supplier, part: key });
                }}
              />
              {nothing && (
                <p className="py-4 text-center text-muted-foreground">
                  Ничего не найдено
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                {cards.length > 1 && (
                  <Link
                    to={`?${new URLSearchParams({ q }).toString()}`}
                    className="rounded-[9px] border bg-card px-3 py-2 text-[14px] font-semibold text-link hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                  >
                    ← Другие детали
                  </Link>
                )}
                <div className="min-w-0">
                  <h2 className="text-[20px] font-bold [overflow-wrap:anywhere]">
                    {`${part.card.group.brand} ${part.card.group.number}`}{" "}
                    <span className="ml-1 inline-block rounded-full bg-muted px-2.5 py-0.5 align-middle text-[12.5px] font-normal text-soft-foreground">
                      {part.card.title}
                    </span>
                  </h2>
                  {part.card.group.name !== "" && (
                    <p className="text-[13px] text-soft-foreground [overflow-wrap:anywhere]">
                      {part.card.group.name}
                    </p>
                  )}
                </div>
              </div>
              <SummaryPanel
                stock={stock.data?.items}
                stockError={stock.isError}
                partKey={part.card.group.key}
                best={best}
                pending={chosenQuery?.isFetching ?? false}
                now={now}
              />
              {chosenResult?.message != null && (
                <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                  {chosenResult.message}
                </p>
              )}
              <PartTable
                title="Оригинал"
                groups={[part.card.group]}
                supplier={{ code: part.card.supplier, title: part.card.title }}
                sort={filters.sort}
                best={best}
                stockQty={(key) => stockQty(myItems, key)}
                now={now}
                onToStock={onToStock}
              />
              {filters.showAnalogs && part.analogs.length > 0 && (
                <PartTable
                  // A new search, card or filter starts again from 20 rows.
                  key={`${q}|${part.card.supplier}|${part.card.group.key}|${String(filters.showAnalogs)}|${filters.sort}`}
                  title="Аналоги"
                  groups={part.analogs}
                  supplier={{
                    code: part.card.supplier,
                    title: part.card.title,
                  }}
                  sort={filters.sort}
                  best={best}
                  stockQty={(key) => stockQty(myItems, key)}
                  now={now}
                  limit={20}
                  onToStock={onToStock}
                />
              )}
            </div>
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
