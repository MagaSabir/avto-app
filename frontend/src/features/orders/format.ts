import { MONTHS } from "@/features/settlements/format";

import type { Order } from "@/api/orders";

// "2026-10-19" -> "19 окт 2026"; parsed by hand so the time zone cannot shift the day
export function formatDay(day: string): string {
  const [y = "", m = "1", d = "1"] = day.split("-");
  return `${String(Number(d))} ${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

// Value under the delivery-type column label: address, then date
export function deliveryValue(order: Order): string {
  const day = order.delivery_date ? formatDay(order.delivery_date) : "";
  return [order.delivery_address, day].filter(Boolean).join(", ");
}
