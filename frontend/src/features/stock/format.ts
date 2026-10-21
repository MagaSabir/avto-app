const money = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function split(v: string): { int: bigint; frac: string; neg: boolean } {
  const [i = "0", f = "00"] = v.replace("-", "").split(".");
  return {
    int: BigInt(i),
    frac: f.padEnd(2, "0").slice(0, 2),
    neg: v.startsWith("-"),
  };
}

// Money strings are formatted from digits (not Number) to keep exact kopecks.
export function formatMoney(v: string): string {
  const { int, frac, neg } = split(v);
  const intStr = whole.format(int);
  const sep = money.format(0.5).charAt(1);
  return `${neg ? "-" : ""}${intStr}${sep}${frac}`;
}

export function formatPrice(v: string): string {
  const { int, frac, neg } = split(v);
  return frac === "00"
    ? `${neg ? "-" : ""}${whole.format(int)}`
    : formatMoney(v);
}

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatShortDateTime(iso: string): string {
  return `${formatDate(iso).slice(0, 5)} ${timeFmt.format(new Date(iso))}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${timeFmt.format(new Date(iso))}`;
}

// "30.00" -> "30", "27.50" -> "27.5"
export function trimPercent(v: string): string {
  return v.includes(".") ? v.replace(/\.?0+$/, "") : v;
}

export function movesLabel(n: number): string {
  const last2 = n % 100;
  const last = n % 10;
  let word = "движений";
  if (last2 < 11 || last2 > 14) {
    if (last === 1) word = "движение";
    else if (last >= 2 && last <= 4) word = "движения";
  }
  return `${String(n)} ${word}`;
}
