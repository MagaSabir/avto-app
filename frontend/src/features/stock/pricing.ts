// Mirrors backend/app/domain/pricing.py. Money is kept in kopecks and
// percents in hundredths of a percent, all as BigInt.

// RegExpExecArray groups are typed `string` but are undefined when unmatched.
function group(match: RegExpExecArray, i: number): string {
  return match[i] ?? "";
}

function toScaled(input: string): bigint | null {
  const cleaned = input.replace(/\s+/g, "").replace(",", ".");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const frac = group(match, 2).padEnd(2, "0");
  return BigInt(`${group(match, 1)}${frac}`);
}

function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(3, "0");
  return `${negative ? "-" : ""}${str.slice(0, -2)}.${str.slice(-2)}`;
}

function parseStrict(value: string): bigint {
  const parsed = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!parsed) throw new Error(`Invalid decimal: ${value}`);
  const scaled = BigInt(
    `${group(parsed, 2)}${group(parsed, 3).padEnd(2, "0")}`,
  );
  return parsed[1] === "-" ? -scaled : scaled;
}

export function parseMoney(input: string): string | null {
  const scaled = toScaled(input);
  if (scaled === null || scaled <= 0n) return null;
  return fromScaled(scaled);
}

export function parsePercent(input: string): string | null {
  const scaled = toScaled(input);
  if (scaled === null) return null;
  return fromScaled(scaled);
}

// Markup may be negative (sale below purchase), but must stay above -100%.
export function parseMarkup(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("-")) return parsePercent(trimmed);
  const abs = toScaled(trimmed.slice(1));
  if (abs === null || abs >= 10000n) return null;
  return abs === 0n ? "0.00" : fromScaled(-abs);
}

export function salePrice(purchase: string, markup: string): string {
  const kopecks = parseStrict(purchase);
  const hundredths = parseStrict(markup);
  // raw kopecks = purchase * (1 + markup/100) = kopecks * (10000 + hundredths) / 10000
  const numerator = kopecks * (10000n + hundredths);
  const step = 10_000_000n; // 10 RUB = 1000 kopecks, times 10000
  const rounded = ((numerator + step - 1n) / step) * 1000n;
  return fromScaled(rounded);
}

export function markupFromSale(purchase: string, sale: string): string {
  const p = parseStrict(purchase);
  const s = parseStrict(sale);
  // (s/p - 1) * 10000 hundredths, rounded half up (away from zero on ties
  // matches Decimal ROUND_HALF_UP).
  const num = (s - p) * 10000n;
  const neg = num < 0n !== p < 0n;
  const absNum = num < 0n ? -num : num;
  const absDen = p < 0n ? -p : p;
  const q = (2n * absNum + absDen) / (2n * absDen);
  return fromScaled(neg ? -q : q);
}

// Unrounded purchase * (1 + markup/100), kopecks rounded half up.
export function exactPrice(purchase: string, markup: string): string {
  const numerator = parseStrict(purchase) * (10000n + parseStrict(markup));
  return fromScaled((numerator + 5000n) / 10000n);
}
