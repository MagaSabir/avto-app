import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type CashOut = Schemas["CashOut"];
export type CashTotals = Schemas["CashTotals"];
export type CashOperation = Schemas["CashOperation"];

export function useCash(start: string, end: string): UseQueryResult<CashOut> {
  return useQuery({
    queryKey: ["cash", start, end],
    queryFn: () =>
      apiFetch<CashOut>(
        `/api/cash?${new URLSearchParams({ start, end }).toString()}`,
      ),
  });
}
