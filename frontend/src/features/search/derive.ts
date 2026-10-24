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
export const isPriced = (o: Offer) => o.kind !== "variants";

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

export function offerCmp(sort: SortMode, now: Date) {
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

// Row order: Rossko's own warehouses first, then the chosen sort.
function rowCmp(sort: SortMode, now: Date) {
  const sortCmp = offerCmp(sort, now);
  return (a: Offer, b: Offer) => ownFirst(a, b) || sortCmp(a, b);
}

export const isInStock = (o: Offer) =>
  o.kind !== "order" && o.kind !== "variants" && o.qty > 0;

// Requested parts always stay (even empty); analogs without stock go.
export function filterInStock(groups: MergedGroup[]): MergedGroup[] {
  return groups
    .map((g) => ({
      ...g,
      suppliers: g.suppliers.map((s) => ({
        ...s,
        offers: s.offers.filter(isInStock),
      })),
    }))
    .filter((g) => g.is_requested || g.suppliers.some((s) => s.offers.length));
}

export function bestOffers(
  groups: MergedGroup[],
  now: Date,
): { cheapest: Offer | null; fastest: Offer | null } {
  const byTime = offerCmp("time", now);
  const cheapCmp = offerCmp("price", now);
  let cheapest: Offer | null = null;
  let fastest: Offer | null = null;
  for (const g of groups)
    for (const s of g.suppliers)
      for (const o of s.offers.filter(isPriced)) {
        if (cheapest === null || cheapCmp(o, cheapest) < 0) cheapest = o;
        if (fastest === null || byTime(o, fastest) < 0) fastest = o;
      }
  return { cheapest, fastest };
}

export function analogOffers(
  group: MergedGroup,
  sort: SortMode,
  now: Date,
): { supplier: SupplierOffers; offer: Offer }[] {
  const cmp = rowCmp(sort, now);
  return group.suppliers
    .flatMap((supplier) =>
      supplier.offers.map((offer) => ({ supplier, offer })),
    )
    .sort((a, b) => cmp(a.offer, b.offer));
}

export function stockForPart(
  items: StockSearchItem[],
  key: string,
): StockSearchItem[] {
  const brand = key.split("|")[0];
  return items.filter((it) => it.brand_key === brand);
}

// Each supplier's offers sorted on their own; analogs ranked by the best
// offer of any supplier.
export function arrangeGroups(
  groups: MergedGroup[],
  opts: { showAnalogs: boolean; sort: SortMode; now: Date },
): MergedGroup[] {
  // Rows prefer Rossko's own warehouses (as on their site); the summary
  // cards still pick across all offers.
  const cmp = rowCmp(opts.sort, opts.now);
  const sorted = groups.map((g) => ({
    ...g,
    suppliers: g.suppliers.map((s) => ({
      ...s,
      offers: [...s.offers].sort(cmp),
    })),
  }));
  const top = (g: MergedGroup): Offer | undefined => {
    let best: Offer | undefined;
    for (const s of g.suppliers) {
      const o = s.offers.at(0);
      if (o !== undefined && (best === undefined || cmp(o, best) < 0)) best = o;
    }
    return best;
  };
  const requested = sorted.filter((g) => g.is_requested);
  if (!opts.showAnalogs) return requested;
  const analogs = sorted
    .filter((g) => !g.is_requested)
    .map((g) => ({ g, best: top(g) }))
    .sort((a, b) => {
      const x = a.best;
      const y = b.best;
      if (x === undefined || y === undefined)
        return (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0);
      return cmp(x, y);
    })
    .map(({ g }) => g);
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
  suppliers: number;
};

// One row per requested part (by key), merged across suppliers.
export function requestedParts(
  results: SupplierSearchResult[],
  now: Date,
  opts: { inStockOnly: boolean },
): PartChoice[] {
  const byTime = offerCmp("time", now);
  const parts = new Map<string, PartChoice>();
  const analogs = new Map<string, Set<string>>();
  const codes = new Map<string, Set<string>>();
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
          suppliers: 0,
        };
        if (p.name === "") p.name = g.name;
        const set = codes.get(g.key) ?? new Set<string>();
        set.add(r.code);
        codes.set(g.key, set);
        const priced = g.offers.filter(opts.inStockOnly ? isInStock : isPriced);
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
    suppliers: codes.get(p.key)?.size ?? 0,
  }));
}

// `group` is the supplier's own spelling of the part (its cart check and
// receipts use it); `offers` may be re-sorted for display.
export type SupplierOffers = {
  code: string;
  title: string;
  group: PartGroup;
  offers: Offer[];
};
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
      m.suppliers.push({
        code: r.code,
        title: r.title,
        group: g,
        offers: g.offers,
      });
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

export type PartCard = {
  supplier: string;
  title: string;
  group: PartGroup;
  analogs: number;
  minPrice: string | null;
  fastest: Offer | null;
};

// The requested group of one supplier plus its groups that are analogs of it.
export function supplierPart(
  result: SupplierSearchResult,
  key: string,
): { original: PartGroup | undefined; analogs: PartGroup[] } {
  return {
    original: result.groups.find((g) => g.is_requested && g.key === key),
    analogs: result.groups.filter((g) => g.analog_of.includes(key)),
  };
}

// Variants rows go last; own Rossko warehouses win only a full tie.
function defaultCmp(sort: SortMode, now: Date) {
  const sortCmp = offerCmp(sort, now);
  return (a: Offer, b: Offer) =>
    Number(!isPriced(a)) - Number(!isPriced(b)) ||
    sortCmp(a, b) ||
    ownFirst(a, b);
}

export function defaultOffer(
  group: PartGroup,
  sort: SortMode,
  now: Date,
): Offer | undefined {
  return [...group.offers].sort(defaultCmp(sort, now))[0];
}

export function sortGroups(
  groups: PartGroup[],
  sort: SortMode,
  now: Date,
): PartGroup[] {
  const cmp = defaultCmp(sort, now);
  const tops = new Map(groups.map((g) => [g, defaultOffer(g, sort, now)]));
  return [...groups].sort((a, b) => {
    const x = tops.get(a);
    const y = tops.get(b);
    if (x === undefined || y === undefined)
      return Number(x === undefined) - Number(y === undefined);
    return cmp(x, y);
  });
}

export type Best = { group: PartGroup; offer: Offer };

export function supplierBest(
  groups: PartGroup[],
  now: Date,
): { cheapest: Best | null; fastest: Best | null } {
  const priceCmp = offerCmp("price", now);
  const timeCmp = offerCmp("time", now);
  let cheapest: Best | null = null;
  let fastest: Best | null = null;
  for (const group of groups)
    for (const offer of group.offers.filter(isPriced)) {
      if (cheapest === null || priceCmp(offer, cheapest.offer) < 0)
        cheapest = { group, offer };
      if (fastest === null || timeCmp(offer, fastest.offer) < 0)
        fastest = { group, offer };
    }
  return { cheapest, fastest };
}

export function partCards(
  results: SupplierSearchResult[],
  opts: { showAnalogs: boolean; sort: SortMode; now: Date },
): PartCard[] {
  const timeCmp = offerCmp("time", opts.now);
  const cards: PartCard[] = [];
  for (const r of results)
    for (const group of r.groups.filter((g) => g.is_requested)) {
      const { analogs } = supplierPart(r, group.key);
      const set = opts.showAnalogs ? [group, ...analogs] : [group];
      let minPrice: string | null = null;
      let fastestOffer: Offer | null = null;
      for (const g of set)
        for (const o of g.offers) {
          if (minPrice === null || cents(o.purchase_price) < cents(minPrice))
            minPrice = o.purchase_price;
          if (
            isPriced(o) &&
            (fastestOffer === null || timeCmp(o, fastestOffer) < 0)
          )
            fastestOffer = o;
        }
      cards.push({
        supplier: r.code,
        title: r.title,
        group,
        analogs: analogs.length,
        minPrice,
        fastest: fastestOffer,
      });
    }
  const byMin = (a: PartCard, b: PartCard) => {
    if (a.minPrice === null || b.minPrice === null)
      return Number(a.minPrice === null) - Number(b.minPrice === null);
    return cmpBig(cents(a.minPrice), cents(b.minPrice));
  };
  const byFast = (a: PartCard, b: PartCard) => {
    if (a.fastest === null || b.fastest === null)
      return Number(a.fastest === null) - Number(b.fastest === null);
    return timeCmp(a.fastest, b.fastest);
  };
  return cards.sort((a, b) =>
    opts.sort === "price"
      ? byMin(a, b) || byFast(a, b)
      : byFast(a, b) || byMin(a, b),
  );
}

export function stockQty(items: StockSearchItem[], key: string): number {
  let sum = 0;
  for (const it of items)
    if (it.qty > 0 && `${it.brand_key}|${it.number_norm}` === key)
      sum += it.qty;
  return sum;
}
