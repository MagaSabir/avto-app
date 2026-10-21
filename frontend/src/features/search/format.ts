import type { Offer } from "../../api/search";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatDelivery(offer: Offer, now: Date): string {
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
  if (offer.delivery_days !== null) return `${String(offer.delivery_days)} дн.`;
  return "не указан";
}

export function kindLabel(offer: Offer): string {
  switch (offer.kind) {
    case "normal":
      return "обычное";
    case "sale":
      return "распродажа";
    case "defect":
      return "некондиция";
    case "air":
      return "авиатовар";
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
export function warehouseLabel(offer: Offer): string {
  return offer.warehouse === "Партнерский склад"
    ? "склад партнёра"
    : offer.warehouse;
}
