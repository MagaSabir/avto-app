import { formatMoney } from "@/features/stock/format";

const MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

function isZero(v: string): boolean {
  return /^-?0*(\.0*)?$/.test(v);
}

// "-1132.46" -> "−1 132,46" (a real minus sign), "67.54" -> "67,54"
export function formatAmount(v: string): string {
  const abs = formatMoney(v.replace("-", ""));
  return v.startsWith("-") && !isZero(v) ? `−${abs}` : abs;
}

// "67.54" -> "+67,54 ₽", "-1250.40" -> "−1 250,40 ₽"
export function formatSigned(v: string): string {
  if (isZero(v)) return `${formatAmount(v)} ₽`;
  return `${v.startsWith("-") ? "" : "+"}${formatAmount(v)} ₽`;
}

// ISO time -> "20 окт 2026, 12:15" in local time, as on the Rossko site
export function formatDocDate(iso: string): string {
  const d = new Date(iso);
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${String(d.getDate())} ${MONTHS[d.getMonth()] ?? ""} ${String(d.getFullYear())}, ${String(d.getHours())}:${minutes}`;
}
