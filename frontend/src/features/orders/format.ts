import { MONTHS } from "@/features/settlements/format";

import type { Order } from "@/api/orders";

// "2026-10-19" -> "19 окт 2026"; parsed by hand so the time zone cannot shift the day
export function formatDay(day: string): string {
  const [y = "", m = "1", d = "1"] = day.split("-");
  return `${String(Number(d))} ${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

export function deliveryLine(order: Order): string {
  const head = order.delivery_address
    ? `${order.delivery_type}: ${order.delivery_address}`
    : order.delivery_type;
  return order.delivery_date
    ? `${head}, ${formatDay(order.delivery_date)}`
    : head;
}
