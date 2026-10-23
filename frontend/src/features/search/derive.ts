import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "../../api/search";

export type SortMode = "price" | "time";
export type Pick = { group: PartGroup; offer: Offer; supplier: string };

// A «variants» row opens a list of delivery options: it has no per-item
// price or term of its own, so summaries and minimums skip it.
const isPriced = (o: Offer) => o.kind !== "variants";

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

// Search shows Rossko's own price ("as on their site"), never our markup.
const byPrice = (a: Offer, b: Offer) =>
  cmpBig(cents(a.purchase_price), cents(b.purchase_price));

function offerCmp(sort: SortMode, now: Date) {
  const byTime = (a: Offer, b: Offer) =>
    cmpNum(deliveryRank(a, now), deliveryRank(b, now));
  return (a: Offer, b: Offer) =>
    sort === "price"
      ? byPrice(a, b) || byTime(a, b)
      : byTime(a, b) || byPrice(a, b);
}

// Rossko's name for third-party stock; its own warehouses carry an address.
export const PARTNER_WAREHOUSE = "Партнерский склад";

const ownFirst = (a: Offer, b: Offer) =>
  Number(a.warehouse === PARTNER_WAREHOUSE) -
  Number(b.warehouse === PARTNER_WAREHOUSE);

export function arrangeGroups(
  groups: PartGroup[],
  opts: { showAnalogs: boolean; sort: SortMode; now: Date },
): PartGroup[] {
  // Rows prefer Rossko's own warehouses (as on their site); the summary
  // cards still pick across all offers.
  const sortCmp = offerCmp(opts.sort, opts.now);
  const cmp = (a: Offer, b: Offer) => ownFirst(a, b) || sortCmp(a, b);
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
        g.offers
          .filter(isPriced)
          .map((offer) => ({ group: g, offer, supplier: r.code })),
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
  return best(picks(results, showAnalogs), byPrice);
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
        for (const o of g.offers.filter(isPriced))
          if (min === null || cents(o.purchase_price) < cents(min))
            min = o.purchase_price;
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

// How much cheaper the supplier is than my purchase price, as money.
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

export type PartChoice = {
  key: string;
  brand: string;
  number: string;
  name: string;
  offers: number;
  minPrice: string | null;
  fastest: Offer | null;
  analogs: number;
};

// One row per requested part (by key), merged across suppliers.
export function requestedParts(
  results: SupplierSearchResult[],
  now: Date,
): PartChoice[] {
  const byTime = offerCmp("time", now);
  const parts = new Map<string, PartChoice>();
  const analogs = new Map<string, Set<string>>();
  for (const r of results)
    for (const g of r.groups) {
      if (g.is_requested) {
        const p = parts.get(g.key) ?? {
          key: g.key,
          brand: g.brand,
          number: g.number,
          name: g.name,
          offers: 0,
          minPrice: null,
          fastest: null,
          analogs: 0,
        };
        if (p.name === "") p.name = g.name;
        const priced = g.offers.filter(isPriced);
        p.offers += priced.length;
        for (const o of priced) {
          if (
            p.minPrice === null ||
            cents(o.purchase_price) < cents(p.minPrice)
          )
            p.minPrice = o.purchase_price;
          if (p.fastest === null || byTime(o, p.fastest) < 0) p.fastest = o;
        }
        parts.set(g.key, p);
      }
      for (const k of g.analog_of) {
        const set = analogs.get(k) ?? new Set<string>();
        set.add(g.key);
        analogs.set(k, set);
      }
    }
  return [...parts.values()].map((p) => ({
    ...p,
    analogs: analogs.get(p.key)?.size ?? 0,
  }));
}

export type SupplierOffers = { code: string; title: string; offers: Offer[] };
export type MergedGroup = {
  key: string;
  brand: string;
  number: string;
  number_norm: string;
  name: string;
  is_requested: boolean;
  analog_of: string[];
  suppliers: SupplierOffers[];
};

// One group per part key; each supplier's offers stay under its own code.
export function mergeGroups(results: SupplierSearchResult[]): MergedGroup[] {
  const merged = new Map<string, MergedGroup>();
  for (const r of results)
    for (const g of r.groups) {
      const m = merged.get(g.key) ?? {
        key: g.key,
        brand: "",
        number: "",
        number_norm: "",
        name: "",
        is_requested: false,
        analog_of: [],
        suppliers: [],
      };
      if (m.brand === "") m.brand = g.brand;
      if (m.number === "") m.number = g.number;
      if (m.number_norm === "") m.number_norm = g.number_norm;
      if (m.name === "") m.name = g.name;
      m.is_requested ||= g.is_requested;
      for (const k of g.analog_of)
        if (!m.analog_of.includes(k)) m.analog_of.push(k);
      m.suppliers.push({ code: r.code, title: r.title, offers: g.offers });
      merged.set(g.key, m);
    }
  return [...merged.values()];
}

// Narrows each answer to one requested part, its analogs and their stock.
export function selectPart(
  results: SupplierSearchResult[],
  key: string,
): SupplierSearchResult[] {
  return results.map((r) => {
    const groups = r.groups.filter(
      (g) => g.key === key || g.analog_of.includes(key),
    );
    return { ...r, groups };
  });
}

// Step 1 cards: parts with the same name (case and edge spaces aside).
export function groupPartsByName(
  parts: PartChoice[],
): { name: string; parts: PartChoice[] }[] {
  const cards = new Map<string, { name: string; parts: PartChoice[] }>();
  for (const p of parts) {
    const name = p.name.trim();
    const key = name.toLowerCase();
    const card = cards.get(key) ?? { name, parts: [] };
    card.parts.push(p);
    cards.set(key, card);
  }
  return [...cards.values()];
}
