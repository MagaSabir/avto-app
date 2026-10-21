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

function qs(q: string): string {
  return new URLSearchParams({ q }).toString();
}

export function useStockSearch(q: string): UseQueryResult<StockSearchResult> {
  return useQuery({
    queryKey: ["search", "stock", q],
    queryFn: () => apiFetch<StockSearchResult>(`/api/search?${qs(q)}`),
    enabled: q !== "",
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
): UseQueryResult<SupplierSearchResult>[] {
  return useQueries({
    queries: codes.map((code) => ({
      queryKey: ["search", "supplier", code, q],
      queryFn: () =>
        apiFetch<SupplierSearchResult>(
          `/api/search/suppliers/${encodeURIComponent(code)}?${qs(q)}`,
        ),
      enabled: q !== "",
      retry: false,
      staleTime: 0,
      gcTime: 0,
    })),
  });
}
