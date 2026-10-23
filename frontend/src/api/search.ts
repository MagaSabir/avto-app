import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type StockSearchItem = Schemas["StockSearchItem"];
export type StockSearchResult = Schemas["StockSearchResult"];
export type SupplierInfo = Schemas["SupplierInfo"];
export type SupplierSearchResult = Schemas["SupplierSearchResult"];
export type PartGroup = Schemas["PartGroupOut"];
export type Offer = Schemas["OfferOut"];
export type SupplierVariants = Schemas["SupplierVariantsOut"];

// Supplier answers live in the tab for 30 minutes so going to the stock
// screen and back shows the last search without asking Rossko again. Only
// «Найти» requests anew (the page resets these queries).
const KEEP_MS = 30 * 60 * 1000;

function qs(q: string): string {
  return new URLSearchParams({ q }).toString();
}

export function useStockSearch(q: string): UseQueryResult<StockSearchResult> {
  return useQuery({
    queryKey: ["search", "stock", q],
    queryFn: () => apiFetch<StockSearchResult>(`/api/search?${qs(q)}`),
    enabled: q !== "",
    // Local and cheap, and quantities change on the stock screen: refetch on
    // return, showing the cached rows meanwhile.
    gcTime: KEEP_MS,
  });
}

// My stock for analog numbers: a local query under the ["search","stock"]
// prefix, so a receipt refreshes it without asking suppliers again.
export function useAnalogStock(
  numbers: string[],
): UseQueryResult<StockSearchItem[]> {
  const sorted = [...new Set(numbers)].sort();
  return useQuery({
    queryKey: ["search", "stock", "analogs", ...sorted],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const n of sorted) params.append("numbers", n);
      return apiFetch<StockSearchItem[]>(`/api/search/stock?${params}`);
    },
    enabled: sorted.length > 0,
    gcTime: KEEP_MS,
  });
}

export function useSuppliers(): UseQueryResult<SupplierInfo[]> {
  return useQuery({
    queryKey: ["search", "suppliers"],
    queryFn: () => apiFetch<SupplierInfo[]>("/api/search/suppliers"),
    staleTime: Infinity,
  });
}

export function useSupplierSearches(
  codes: string[],
  q: string,
  withOrders: Record<string, boolean>,
): UseQueryResult<SupplierSearchResult>[] {
  return useQueries({
    queries: codes.map((code) => ({
      queryKey: ["search", "supplier", code, q, withOrders[code] ?? false],
      queryFn: () =>
        apiFetch<SupplierSearchResult>(
          `/api/search/suppliers/${encodeURIComponent(code)}?${qs(q)}${
            withOrders[code] ? "&with_orders=true" : ""
          }`,
        ),
      enabled: q !== "",
      retry: false,
      // Rossko is rate-limited; never re-request on our own.
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: KEEP_MS,
    })),
  });
}

// Delivery options of one «variants» row. Asked only when opened (the supplier
// has a daily request limit), and never re-requested on its own.
export function useSupplierVariants(
  code: string,
  orderCode: string,
  enabled: boolean,
): UseQueryResult<SupplierVariants> {
  return useQuery({
    queryKey: ["search", "supplier", code, "variants", orderCode],
    queryFn: () =>
      apiFetch<SupplierVariants>(
        `/api/search/suppliers/${encodeURIComponent(code)}/variants?${new URLSearchParams({ order_code: orderCode }).toString()}`,
      ),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: KEEP_MS,
  });
}
