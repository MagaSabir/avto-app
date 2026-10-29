import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type StockItem = Schemas["StockItemOut"];
export type StockItemDetail = Schemas["StockItemDetail"];
export type StockItemList = Schemas["StockItemList"];
export type StockMove = Schemas["StockMoveOut"];
export type Payment = NonNullable<StockMove["payment"]>;
export type OperationResult = Schemas["OperationResult"];
export type ReceiptIn = Schemas["ReceiptIn"];
export type SaleIn = Schemas["SaleIn"];
export type ReturnIn = Schemas["ReturnIn"];
export type WriteoffIn = Schemas["WriteoffIn"];
export type AdjustmentIn = Schemas["AdjustmentIn"];
export type StockItemPatch = Schemas["StockItemPatch"];
export type StatusFilter = "all" | "low" | "out";

export function useStockItems(
  q: string,
  status: StatusFilter,
): UseQueryResult<StockItemList> {
  return useQuery({
    queryKey: ["stock", "items", q, status],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ q, status });
      return apiFetch<StockItemList>(`/api/stock/items?${params.toString()}`);
    },
  });
}

export function useStockItem(
  id: number | null,
): UseQueryResult<StockItemDetail> {
  return useQuery({
    queryKey: ["stock", "item", id],
    queryFn: () => apiFetch<StockItemDetail>(`/api/stock/items/${String(id)}`),
    enabled: id !== null,
  });
}

export function useStockMoves(id: number | null): UseQueryResult<StockMove[]> {
  return useQuery({
    queryKey: ["stock", "moves", id],
    queryFn: () =>
      apiFetch<StockMove[]>(`/api/stock/items/${String(id)}/moves`),
    enabled: id !== null,
  });
}

export function useStockLookup(number: string): UseQueryResult<StockItem[]> {
  return useQuery({
    queryKey: ["stock", "lookup", number],
    queryFn: () => {
      const params = new URLSearchParams({ number });
      return apiFetch<StockItem[]>(`/api/stock/lookup?${params.toString()}`);
    },
    enabled: number.trim() !== "",
  });
}

export function useStockBrands(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: ["stock", "brands"],
    queryFn: () => apiFetch<string[]>("/api/stock/brands"),
  });
}

export function useStockSuppliers(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: ["stock", "suppliers"],
    queryFn: () => apiFetch<string[]>("/api/stock/suppliers"),
  });
}

function useStockMutation<TBody, TResult>(
  path: string | null,
  method: "POST" | "PATCH",
): UseMutationResult<TResult, Error, TBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => {
      if (path === null) return Promise.reject(new Error("No item selected"));
      return apiFetch<TResult>(path, { method, body: JSON.stringify(body) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock"] }),
  });
}

export function useReceipt() {
  return useStockMutation<ReceiptIn, OperationResult>(
    "/api/stock/receipts",
    "POST",
  );
}

function itemPath(id: number | null, op: string): string | null {
  return id === null ? null : `/api/stock/items/${String(id)}/${op}`;
}

export function useSale(id: number | null) {
  return useStockMutation<SaleIn, OperationResult>(
    itemPath(id, "sales"),
    "POST",
  );
}

export function useReturn(id: number | null) {
  return useStockMutation<ReturnIn, OperationResult>(
    itemPath(id, "returns"),
    "POST",
  );
}

export function useWriteoff(id: number | null) {
  return useStockMutation<WriteoffIn, OperationResult>(
    itemPath(id, "writeoffs"),
    "POST",
  );
}

export function useAdjustment(id: number | null) {
  return useStockMutation<AdjustmentIn, OperationResult>(
    itemPath(id, "adjustments"),
    "POST",
  );
}

export function useCancelMove(): UseMutationResult<
  OperationResult,
  Error,
  number
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<OperationResult>(`/api/stock/moves/${String(id)}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock"] }),
  });
}

export function usePatchItem(id: number | null) {
  return useStockMutation<StockItemPatch, StockItem>(
    id === null ? null : `/api/stock/items/${String(id)}`,
    "PATCH",
  );
}

export function useDeleteItem(id: number | null) {
  const queryClient = useQueryClient();
  return useMutation<null>({
    mutationFn: () => {
      if (id === null) return Promise.reject(new Error("No item selected"));
      return apiFetch<null>(`/api/stock/items/${String(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      // The deleted item's own queries would 404 on refetch: drop, don't refresh.
      const gone = (key: readonly unknown[]) =>
        (key[1] === "item" || key[1] === "moves") && key[2] === id;
      queryClient.removeQueries({
        queryKey: ["stock"],
        predicate: (q) => gone(q.queryKey),
      });
      await queryClient.invalidateQueries({
        queryKey: ["stock"],
        predicate: (q) => !gone(q.queryKey),
      });
    },
  });
}
