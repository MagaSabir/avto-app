import {
  useInfiniteQuery,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type SettlementsOut = Schemas["SettlementsOut"];
export type SettlementsData = Schemas["SettlementsData"];
export type SettlementDocument = Schemas["SettlementDocumentOut"];

const SUPPLIER = "rossko";
const BALANCE_STALE_MS = 5 * 60 * 1000;

export const settlementsKey = ["settlements", SUPPLIER] as const;

function fetchPage(page: number): Promise<SettlementsOut> {
  return apiFetch<SettlementsOut>(
    `/api/suppliers/${SUPPLIER}/settlements?page=${String(page)}`,
  );
}

export function useBalance(): UseQueryResult<SettlementsOut> {
  return useQuery({
    queryKey: [...settlementsKey, "balance"],
    queryFn: () => fetchPage(0),
    staleTime: BALANCE_STALE_MS,
  });
}

export function useSettlements() {
  return useInfiniteQuery({
    queryKey: [...settlementsKey, "pages"],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages, lastParam) => {
      if (last.data === null) return undefined;
      const loaded = pages.reduce(
        (n, p) => n + (p.data?.documents.length ?? 0),
        0,
      );
      return last.data.documents.length > 0 &&
        loaded < last.data.documents_total
        ? lastParam + 1
        : undefined;
    },
  });
}
