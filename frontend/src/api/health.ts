import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

export type HealthOk = components["schemas"]["HealthOk"];

export function useHealth(): UseQueryResult<HealthOk> {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthOk>("/api/health"),
    refetchOnWindowFocus: true,
  });
}
