import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "../../api/search";

export type SortMode = "price" | "time";
export type Pick = { group: PartGroup; offer: Offer; supplier: string };

const DAY_MS = 86_400_000;

// Money strings are compared as integer kopecks, never as floats.
export function cents(v: string): bigint {
  const neg = v.startsWith("-");
  const [i = "0", f = ""] = v.replace("-", "").split(".");
  const total = BigInt(i) * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return neg ? -total : total;
}

export function deliveryRank(offer: Offer, now: Date): number {
  if (offer.delivery_from !== null)
    return new Date(offer.delivery_from).getTime();
  if (offer.delivery_days !== null)
    return now.getTime() + offer.delivery_days * DAY_MS;
  return Infinity;
}

function cmpNum(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function cmpBig(a: bigint, b: bigint): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function offerCmp(sort: SortMode, now: Date) {
  const byPrice = (a: Offer, b: Offer) =>
    cmpBig(cents(a.price), cents(b.price));
  const byTime = (a: Offer, b: Offer) =>
    cmpNum(deliveryRank(a, now), deliveryRank(b, now));
  return (a: Offer, b: Offer) =>
    sort === "price"
      ? byPrice(a, b) || byTime(a, b)
      : byTime(a, b) || byPrice(a, b);
}

export function arrangeGroups(
  groups: PartGroup[],
  opts: { showAnalogs: boolean; sort: SortMode; now: Date },
): PartGroup[] {
  const cmp = offerCmp(opts.sort, opts.now);
  const sorted = groups.map((g) => ({
    ...g,
    offers: [...g.offers].sort(cmp),
  }));
  const requested = sorted.filter((g) => g.is_requested);
  if (!opts.showAnalogs) return requested;
  const analogs = sorted
    .filter((g) => !g.is_requested)
    .sort((a, b) => {
      const x = a.offers.at(0);
      const y = b.offers.at(0);
      if (x === undefined || y === undefined)
        return (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0);
      return cmp(x, y);
    });
  return [...requested, ...analogs];
}

function picks(results: SupplierSearchResult[], showAnalogs: boolean): Pick[] {
  return results.flatMap((r) =>
    r.groups
      .filter((g) => showAnalogs || g.is_requested)
      .flatMap((g) =>
        g.offers.map((offer) => ({ group: g, offer, supplier: r.code })),
      ),
  );
}

function best(list: Pick[], cmp: (a: Offer, b: Offer) => number): Pick | null {
  let top: Pick | null = null;
  for (const p of list) {
    if (top === null || cmp(p.offer, top.offer) < 0) top = p;
  }
  return top;
}

export function cheapest(
  results: SupplierSearchResult[],
  showAnalogs: boolean,
): Pick | null {
  return best(picks(results, showAnalogs), (a, b) =>
    cmpBig(cents(a.price), cents(b.price)),
  );
}

export function fastest(
  results: SupplierSearchResult[],
  showAnalogs: boolean,
  now: Date,
): Pick | null {
  return best(picks(results, showAnalogs), offerCmp("time", now));
}

export function bestPriceFor(
  results: SupplierSearchResult[],
  numberNorm: string,
): string | null {
  let min: string | null = null;
  for (const r of results)
    for (const g of r.groups)
      if (g.number_norm === numberNorm)
        for (const o of g.offers)
          if (min === null || cents(o.price) < cents(min)) min = o.price;
  return min;
}

// qty counts every item; positions, price and cells only items in stock.
export function stockSummary(items: StockSearchItem[]): {
  qty: number;
  positions: number;
  minPrice: string | null;
  cells: string[];
} {
  let minPrice: string | null = null;
  const cells = new Set<string>();
  let qty = 0;
  let positions = 0;
  for (const it of items) {
    qty += it.qty;
    if (it.qty <= 0) continue;
    positions += 1;
    if (minPrice === null || cents(it.sale_price) < cents(minPrice))
      minPrice = it.sale_price;
    if (it.cell !== null && it.cell !== "") cells.add(it.cell);
  }
  return { qty, positions, minPrice, cells: [...cells] };
}

// How much cheaper the supplier is than my price, as a money string.
export function cheaperBy(mine: string, theirs: string): string | null {
  const diff = cents(mine) - cents(theirs);
  if (diff <= 0n) return null;
  const frac = String(diff % 100n).padStart(2, "0");
  return `${String(diff / 100n)}.${frac}`;
}

export function visibleStock(
  items: StockSearchItem[],
  matches: StockSearchItem[],
  opts: { inStockOnly: boolean; showAnalogs: boolean },
): { item: StockSearchItem; isAnalog: boolean }[] {
  const rows = [
    ...items.map((item) => ({ item, isAnalog: false })),
    ...(opts.showAnalogs
      ? matches.map((item) => ({ item, isAnalog: true }))
      : []),
  ];
  return opts.inStockOnly ? rows.filter((r) => r.item.qty > 0) : rows;
}
