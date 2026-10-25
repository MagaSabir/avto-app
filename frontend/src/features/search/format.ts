import type { Offer } from "../../api/search";
import { PARTNER_WAREHOUSE } from "./derive";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatDelivery(
  offer: Pick<
    Offer,
    "delivery_from" | "delivery_to" | "delivery_days" | "delivery_days_max"
  >,
  now: Date,
): string {
  if (offer.delivery_from !== null) {
    const from = new Date(offer.delivery_from);
    const diff = Math.round((dayStart(from) - dayStart(now)) / 86_400_000);
    const day =
      diff === 0
        ? "сегодня"
        : diff === 1
          ? "завтра"
          : `${pad(from.getDate())}.${pad(from.getMonth() + 1)}`;
    const end =
      offer.delivery_to !== null ? `–${hhmm(new Date(offer.delivery_to))}` : "";
    return `${day} ${hhmm(from)}${end}`;
  }
  const days = offer.delivery_days;
  if (days !== null) {
    const max = offer.delivery_days_max ?? days;
    if (max > days) return `${String(days)}–${String(max)} дн.`;
    return days === 0 ? "сегодня" : `${String(days)} дн.`;
  }
  return "не указан";
}

// «10+ шт» when the supplier only says "at least"; order offers have no stock.
export function qtyLabel(offer: Pick<Offer, "qty" | "qty_plus" | "kind">) {
  if (offer.kind === "order") return "под заказ";
  return `${String(offer.qty)}${offer.qty_plus ? "+" : ""} шт`;
}

export function kindLabel(offer: Pick<Offer, "kind" | "kind_code">): string {
  switch (offer.kind) {
    case "normal":
      return "обычное";
    case "sale":
      return "распродажа";
    case "defect":
      return "некондиция";
    case "air":
      return "авиатовар";
    case "order":
      return "под заказ";
    case "variants":
      return "варианты поставки";
    case "other":
      return `тип ${offer.kind_code}`;
  }
}

export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

// Rossko hides third-party stock behind "Партнерский склад".
export function warehouseLabel(offer: Pick<Offer, "warehouse">): string {
  return offer.warehouse === PARTNER_WAREHOUSE
    ? "склад партнёра"
    : offer.warehouse;
}
