import { formatMoney } from "@/features/stock/format";

// "67.54" -> "+67,54 ₽", "-1250.40" -> "−1 250,40 ₽" (a real minus sign).
export function formatSigned(v: string): string {
  const abs = formatMoney(v.replace("-", ""));
  if (/^-?0*(\.0*)?$/.test(v)) return `${abs} ₽`;
  return `${v.startsWith("-") ? "−" : "+"}${abs} ₽`;
}
