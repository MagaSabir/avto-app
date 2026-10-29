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
export type Customer = Schemas["CustomerOut"];
export type CustomerBrief = Schemas["CustomerBrief"];
export type CustomerSaved = Schemas["CustomerSaved"];
export type CustomerIn = Schemas["CustomerIn"];
export type CustomerPatch = Schemas["CustomerPatch"];
export type Car = Schemas["CarOut"];
export type CarBrief = Schemas["CarBrief"];
export type CarIn = Schemas["CarIn"];
export type CarPatch = Schemas["CarPatch"];
export type HistoryRow = Schemas["CustomerHistoryRow"];

export function useCustomers(q: string): UseQueryResult<CustomerBrief[]> {
  return useQuery({
    queryKey: ["customers", "list", q],
    queryFn: () => {
      const params = new URLSearchParams({ q });
      return apiFetch<CustomerBrief[]>(`/api/customers?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number | null): UseQueryResult<Customer> {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => apiFetch<Customer>(`/api/customers/${String(id)}`),
    enabled: id !== null,
  });
}

export function useCustomerHistory(
  id: number | null,
  carId: number | null,
): UseQueryResult<HistoryRow[]> {
  return useQuery({
    queryKey: ["customers", "history", id, carId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (carId !== null) params.set("car_id", String(carId));
      return apiFetch<HistoryRow[]>(
        `/api/customers/${String(id)}/history?${params.toString()}`,
      );
    },
    enabled: id !== null,
  });
}

function useCustomerMutation<TBody, TResult>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  dropOnSuccess?: (key: readonly unknown[]) => boolean,
): UseMutationResult<TResult, Error, TBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      apiFetch<TResult>(path, {
        method,
        ...(method === "DELETE" ? {} : { body: JSON.stringify(body) }),
      }),
    onSuccess: async () => {
      // A deleted customer's own queries would 404 on refetch: drop them.
      if (dropOnSuccess) {
        queryClient.removeQueries({
          queryKey: ["customers"],
          predicate: (q) => dropOnSuccess(q.queryKey),
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        // Customer and car are shown on stock moves and cash rows.
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
        queryClient.invalidateQueries({ queryKey: ["cash"] }),
      ]);
    },
  });
}

export function useCreateCustomer() {
  return useCustomerMutation<CustomerIn, CustomerSaved>(
    "/api/customers",
    "POST",
  );
}

export function usePatchCustomer(id: number) {
  return useCustomerMutation<CustomerPatch, CustomerSaved>(
    `/api/customers/${String(id)}`,
    "PATCH",
  );
}

export function useDeleteCustomer(id: number) {
  return useCustomerMutation<undefined, null>(
    `/api/customers/${String(id)}`,
    "DELETE",
    (key) => (key[1] === "detail" || key[1] === "history") && key[2] === id,
  );
}

export function useAddCar(customerId: number) {
  return useCustomerMutation<CarIn, Car>(
    `/api/customers/${String(customerId)}/cars`,
    "POST",
  );
}

export function usePatchCar(customerId: number, carId: number) {
  return useCustomerMutation<CarPatch, Car>(
    `/api/customers/${String(customerId)}/cars/${String(carId)}`,
    "PATCH",
  );
}

export function useDeleteCar(customerId: number, carId: number) {
  return useCustomerMutation<undefined, null>(
    `/api/customers/${String(customerId)}/cars/${String(carId)}`,
    "DELETE",
  );
}
