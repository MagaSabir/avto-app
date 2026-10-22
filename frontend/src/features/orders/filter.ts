import type { Order } from "@/api/orders";

import type { OrderGroup } from "./status";
import { partStatus } from "./status";

export function normalizeNumber(s: string): string {
  return s
    .split("@")[0]
    .toUpperCase()
    .replace(/[\s\-./]/g, "");
}

export function filterOrders(
  orders: Order[],
  group: OrderGroup | null,
  text: string,
): Order[] {
  const query = text.trim();
  const lower = query.toLowerCase();
  const normalized = normalizeNumber(query);
  return orders.filter((order) => {
    if (
      group &&
      !order.parts.some((p) => partStatus(p.status_code).group === group)
    )
      return false;
    if (!query) return true;
    if (String(order.id).includes(query)) return true;
    return order.parts.some(
      (p) =>
        (normalized !== "" && normalizeNumber(p.number).includes(normalized)) ||
        p.name.toLowerCase().includes(lower) ||
        p.brand.toLowerCase().includes(lower),
    );
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(d: Date): string {
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function defaultPeriod(today: Date): { start: string; end: string } {
  const lastDay = new Date(
    today.getFullYear(),
    today.getMonth() - 2,
    0,
  ).getDate();
  const start = new Date(
    today.getFullYear(),
    today.getMonth() - 3,
    Math.min(today.getDate(), lastDay),
  );
  return { start: iso(start), end: iso(today) };
}
