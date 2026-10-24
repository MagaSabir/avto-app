import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "../../api/search";

export type SortMode = "price" | "time";

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

export function stockForPart(
  items: StockSearchItem[],
  key: string,
): StockSearchItem[] {
  const brand = key.split("|")[0];
  return items.filter((it) => it.brand_key === brand);
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

export function sortOffers(
  offers: Offer[],
  sort: SortMode,
  now: Date,
): Offer[] {
  return [...offers].sort(defaultCmp(sort, now));
}

export function defaultOffer(
  group: PartGroup,
  sort: SortMode,
  now: Date,
): Offer | undefined {
  return sortOffers(group.offers, sort, now)[0];
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
