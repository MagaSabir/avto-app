import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type OrdersOut = Schemas["OrdersOut"];
export type Order = Schemas["OrderOut"];
export type OrderPart = Schemas["OrderPartOut"];

const SUPPLIER = "rossko";

export const ordersKey = ["orders", SUPPLIER] as const;

export type OrdersQuery = { start: string; end: string } | { orderId: number };

function fetchOrders(query: OrdersQuery): Promise<OrdersOut> {
  const params =
    "orderId" in query
      ? new URLSearchParams({ order_id: String(query.orderId) })
      : new URLSearchParams({ start: query.start, end: query.end });
  return apiFetch<OrdersOut>(
    `/api/suppliers/${SUPPLIER}/orders?${params.toString()}`,
  );
}

export function useOrders(query: OrdersQuery): UseQueryResult<OrdersOut> {
  return useQuery({
    queryKey: [...ordersKey, query],
    queryFn: () => fetchOrders(query),
  });
}
