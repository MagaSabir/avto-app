import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type CartOut = Schemas["CartOut"];
export type CartItem = Schemas["CartItemOut"];
export type CartItemIn = Schemas["CartItemIn"];
export type CartRefreshOut = Schemas["CartRefreshOut"];
export type CartRefreshItem = Schemas["CartRefreshItem"];

export const cartKey = ["cart"] as const;

export function useCart(): UseQueryResult<CartOut> {
  return useQuery({
    queryKey: cartKey,
    queryFn: () => apiFetch<CartOut>("/api/cart"),
  });
}

export function useAddToCart(): UseMutationResult<CartItem, Error, CartItemIn> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CartItemIn) =>
      apiFetch<CartItem>("/api/cart/items", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useSetCartQty(): UseMutationResult<
  CartItem,
  Error,
  { id: number; qty: number }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      apiFetch<CartItem>(`/api/cart/items/${String(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ qty }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useRemoveCartItem(): UseMutationResult<null, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<null>(`/api/cart/items/${String(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useClearCart(): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>("/api/cart", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useCartRefresh(): UseMutationResult<
  CartRefreshOut,
  Error,
  void
> {
  return useMutation({
    mutationFn: () =>
      apiFetch<CartRefreshOut>("/api/cart/refresh", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}
