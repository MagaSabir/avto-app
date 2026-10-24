import { describe, expect, it } from "vitest";

import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "../../api/search";
import {
  analogOffers,
  arrangeGroups,
  bestOffers,
  filterInStock,
  isInStock,
  stockForPart,
  bestPriceFor,
  cents,
  cheaperBy,
  cheapest,
  deliveryRank,
  fastest,
  groupPartsByName,
  requestedParts,
  selectPart,
  type PartChoice,
  mergeGroups,
  stockSummary,
  visibleStock,
  partCards,
  supplierPart,
  defaultOffer,
  sortGroups,
  supplierBest,
  stockQty,
} from "./derive";
import * as fx from "@/test/searchFixtures";

const now = new Date(2026, 9, 22, 10, 0);
const at = (d: number, h = 9) => new Date(2026, 9, d, h, 0).toISOString();

function offer(price: string, over: Partial<Offer> = {}): Offer {
  return {
    warehouse: "W",
    stock_id: "s1",
    qty: 1,
    multiplicity: 1,
    delivery_days: null,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    qty_plus: false,
    purchase_price: price,
    // Price with markup is not used on screen; a constant proves it.
    price: "1.00",
    ...over,
  };
}

function group(
  norm: string,
  requested: boolean,
  offers: Offer[],
  brand = "B",
): PartGroup {
  return {
    brand,
    number: norm,
    number_norm: norm,
    name: "n",
    is_requested: requested,
    key: `${brand}|${norm}`,
    analog_of: [],
    offers,
  };
}

function result(code: string, groups: PartGroup[]): SupplierSearchResult {
  return {
    code,
    title: code,
    status: "ok",
    message: null,
    markup: "10.00",
    groups,
    stock_matches: [],
  };
}

function item(
  id: number,
  over: Partial<StockSearchItem> = {},
): StockSearchItem {
  return {
    id,
    number_raw: `N${String(id)}`,
    number_norm: `N${String(id)}`,
    brand: "B",
    name: "n",
    brand_key: "B",
    qty: 1,
    min_qty: 0,
    cell: null,
    purchase_price: "10.00",
    markup: "30.00",
    sale_price: "13.00",
    last_receipt_at: null,
    last_receipt_supplier: null,
    sold_30d: 0,
    status: "ok",
    ...over,
  };
}

describe("cents", () => {
  it("parses money strings exactly", () => {
    expect(cents("2940.5")).toBe(294050n);
    expect(cents("2940.00")).toBe(294000n);
    expect(cents("7")).toBe(700n);
  });
});

describe("deliveryRank", () => {
  it("prefers the window, then days, then infinity", () => {
    expect(deliveryRank(offer("1", { delivery_from: at(23) }), now)).toBe(
      new Date(at(23)).getTime(),
    );
    expect(deliveryRank(offer("1", { delivery_days: 2 }), now)).toBe(
      now.getTime() + 2 * 86_400_000,
    );
    expect(deliveryRank(offer("1"), now)).toBe(Infinity);
  });
});

// Sorting works on parts merged across suppliers; one supplier here.
function arrange(
  groups: PartGroup[],
  opts: { showAnalogs: boolean; sort: "price" | "time"; now: Date },
) {
  return arrangeGroups(mergeGroups([result("a", groups)]), opts).map((g) => ({
    number_norm: g.number_norm,
    offers: g.suppliers[0]?.offers ?? [],
  }));
}

describe("arrangeGroups", () => {
  const requested = group("REQ", true, [offer("5000.00"), offer("100.00")]);
  const analogs = [
    group("A3", false, [offer("20163.00")]),
    group("A1", false, [offer("2144.00")]),
    group("A2", false, [offer("2315.00")]),
  ];

  it("keeps requested first and sorts analogs by price", () => {
    const out = arrange([...analogs, requested], {
      showAnalogs: true,
      sort: "price",
      now,
    });
    expect(out.map((g) => g.number_norm)).toEqual(["REQ", "A1", "A2", "A3"]);
    expect(out[0]?.offers.map((o) => o.purchase_price)).toEqual([
      "100.00",
      "5000.00",
    ]);
  });

  it("sorts by time, no-time last, empty groups last", () => {
    const groups = [
      group("EMPTY", false, []),
      group("NONE", false, [offer("1.00")]),
      group("LATE", false, [offer("1.00", { delivery_from: at(25) })]),
      group("SOON", false, [offer("9.00", { delivery_from: at(23) })]),
    ];
    const out = arrange(groups, {
      showAnalogs: true,
      sort: "time",
      now,
    });
    expect(out.map((g) => g.number_norm)).toEqual([
      "SOON",
      "LATE",
      "NONE",
      "EMPTY",
    ]);
  });

  it("breaks ties with the other key", () => {
    const g = group("X", true, [
      offer("9.00", { delivery_from: at(23) }),
      offer("5.00", { delivery_from: at(23) }),
    ]);
    const out = arrange([g], { showAnalogs: true, sort: "time", now });
    expect(out[0]?.offers.map((o) => o.purchase_price)).toEqual([
      "5.00",
      "9.00",
    ]);
  });

  it("puts Rossko's own warehouses before partner stock", () => {
    const partner = "Партнерский склад";
    const g = group("X", true, [
      offer("100.00", { warehouse: partner }),
      offer("300.00", { warehouse: "г. Грозный" }),
      offer("200.00", { warehouse: "Краснодар" }),
    ]);
    const out = arrange([g], { showAnalogs: true, sort: "price", now });
    expect(out[0]?.offers.map((o) => o.purchase_price)).toEqual([
      "200.00",
      "300.00",
      "100.00",
    ]);
  });

  it("ranks analogs with own stock above partner-only analogs", () => {
    const partner = "Партнерский склад";
    const out = arrange(
      [
        group("P", false, [offer("10.00", { warehouse: partner })]),
        group("O", false, [offer("90.00", { warehouse: "Пятигорск" })]),
      ],
      { showAnalogs: true, sort: "price", now },
    );
    expect(out.map((g) => g.number_norm)).toEqual(["O", "P"]);
  });

  it("keeps the summary picks honest across warehouses", () => {
    const r = result("a", [
      group("X", true, [
        offer("100.00", { warehouse: "Партнерский склад" }),
        offer("300.00", { warehouse: "г. Грозный" }),
      ]),
    ]);
    expect(cheapest([r], true)?.offer.purchase_price).toBe("100.00");
  });

  it("hides analogs", () => {
    const out = arrange([...analogs, requested], {
      showAnalogs: false,
      sort: "price",
      now,
    });
    expect(out.map((g) => g.number_norm)).toEqual(["REQ"]);
  });

  it("sorts each supplier's offers and ranks analogs by the best of them", () => {
    const out = arrangeGroups(
      mergeGroups([
        result("a", [
          group("REQ", true, [offer("30.00"), offer("10.00")]),
          group("A1", false, [offer("500.00")]),
          group("A2", false, [offer("300.00")]),
        ]),
        result("b", [
          group("REQ", true, [offer("40.00"), offer("20.00")]),
          group("A1", false, [offer("100.00")]),
        ]),
      ]),
      { showAnalogs: true, sort: "price", now },
    );
    expect(out.map((g) => g.number_norm)).toEqual(["REQ", "A1", "A2"]);
    expect(
      out[0]?.suppliers.map((s) => s.offers.map((o) => o.purchase_price)),
    ).toEqual([
      ["10.00", "30.00"],
      ["20.00", "40.00"],
    ]);
  });
});

describe("cheapest / fastest", () => {
  const r1 = result("a", [
    group("REQ", true, [offer("300.00", { delivery_from: at(24) })]),
  ]);
  const r2 = result("b", [
    group("REQ", true, [offer("200.00", { delivery_from: at(23) })]),
    group("AN", false, [offer("50.00", { delivery_from: at(25) })]),
  ]);

  it("finds the cheapest, with and without analogs", () => {
    expect(cheapest([r1, r2], false)?.offer.purchase_price).toBe("200.00");
    const p = cheapest([r1, r2], true);
    expect(p?.offer.purchase_price).toBe("50.00");
    expect(p?.supplier).toBe("b");
    expect(p?.group.number_norm).toBe("AN");
  });

  it("finds the fastest", () => {
    expect(fastest([r1, r2], true, now)?.offer.purchase_price).toBe("200.00");
  });

  it("prefers cheaper on equal delivery", () => {
    const a = result("a", [
      group("R", true, [offer("300.00", { delivery_from: at(23) })]),
    ]);
    const b = result("b", [
      group("R", true, [offer("200.00", { delivery_from: at(23) })]),
    ]);
    expect(fastest([a, b], true, now)?.supplier).toBe("b");
  });

  it("returns null for empty input", () => {
    expect(cheapest([], true)).toBeNull();
    expect(
      fastest([result("a", [group("R", true, [])])], true, now),
    ).toBeNull();
  });
});

describe("bestPriceFor", () => {
  it("takes the minimum across brands with the same number", () => {
    const r = result("a", [
      group("W683", true, [offer("3100.00")], "MANN"),
      group("W683", false, [offer("2940.00"), offer("3000.00")], "MGA"),
      group("OTHER", false, [offer("1.00")]),
    ]);
    expect(bestPriceFor([r], "W683")).toBe("2940.00");
    expect(bestPriceFor([r], "NOPE")).toBeNull();
    expect(bestPriceFor([result("a", [group("W683", true, [])])], "W683")).toBe(
      null,
    );
  });
});

describe("stockSummary", () => {
  it("sums qty, finds min price and unique cells", () => {
    const s = stockSummary([
      item(1, { qty: 2, sale_price: "20.50", cell: "A1" }),
      item(2, { qty: 3, sale_price: "9.99", cell: "A1" }),
      item(3, { qty: 0, sale_price: "15.00", cell: null }),
      item(4, { qty: 1, sale_price: "30.00", cell: "B2" }),
    ]);
    expect(s).toEqual({
      qty: 6,
      positions: 3,
      minPrice: "9.99",
      cells: ["A1", "B2"],
    });
  });

  it("ignores zero-qty items for positions, price and cells", () => {
    const s = stockSummary([
      item(1, { qty: 0, sale_price: "1.00", cell: "Z9" }),
      item(2, { qty: 2, sale_price: "50.00", cell: "A1" }),
    ]);
    expect(s).toEqual({
      qty: 2,
      positions: 1,
      minPrice: "50.00",
      cells: ["A1"],
    });
  });

  it("handles empty", () => {
    expect(stockSummary([])).toEqual({
      qty: 0,
      positions: 0,
      minPrice: null,
      cells: [],
    });
  });
});

describe("groupPartsByName", () => {
  const part = (key: string, name: string): PartChoice => ({
    key,
    brand: key,
    number: key,
    name,
    offers: 0,
    minPrice: null,
    fastest: null,
    analogs: 0,
    suppliers: 1,
  });

  it("joins names ignoring case and edge spaces, in first-seen order", () => {
    const a = part("A", "Фильтр масляный");
    const b = part("B", "Насос водяной");
    const c = part("C", " фильтр масляный ");
    expect(groupPartsByName([a, b, c])).toEqual([
      { name: "Фильтр масляный", parts: [a, c] },
      { name: "Насос водяной", parts: [b] },
    ]);
  });
});

describe("cheaperBy", () => {
  it("returns the difference only when the supplier is cheaper", () => {
    expect(cheaperBy("3190.00", "2940.00")).toBe("250.00");
    expect(cheaperBy("100.00", "99.95")).toBe("0.05");
    expect(cheaperBy("2940.00", "2940.00")).toBeNull();
    expect(cheaperBy("2940.00", "3190.00")).toBeNull();
  });
});

describe("visibleStock", () => {
  const items = [item(1, { qty: 0 }), item(2)];
  const matches = [item(3), item(4, { qty: 0 })];

  it("lists requested then analogs", () => {
    const out = visibleStock(items, matches, {
      inStockOnly: false,
      showAnalogs: true,
    });
    expect(out.map((r) => [r.item.id, r.isAnalog])).toEqual([
      [1, false],
      [2, false],
      [3, true],
      [4, true],
    ]);
  });

  it("hides zero qty and analogs", () => {
    expect(
      visibleStock(items, matches, {
        inStockOnly: true,
        showAnalogs: true,
      }).map((r) => r.item.id),
    ).toEqual([2, 3]);
    expect(
      visibleStock(items, matches, {
        inStockOnly: false,
        showAnalogs: false,
      }).map((r) => r.item.id),
    ).toEqual([1, 2]);
  });
});

const MANN = "MANN|W683";
const MGA = "MGA|W683";

function twoParts(): SupplierSearchResult[] {
  return [
    fx.supplierResult({
      code: "rossko",
      groups: [
        fx.partGroup({
          brand: "Mann",
          number: "W 68/3",
          number_norm: "W683",
          name: "Фильтр масляный",
          key: MANN,
          offers: [
            fx.offer({ purchase_price: "900.00", delivery_days: 1 }),
            fx.offer({ purchase_price: "710.00", delivery_days: 5 }),
          ],
        }),
        fx.partGroup({
          brand: "MGA",
          number: "W68/3",
          number_norm: "W683",
          name: "Насос водяной",
          key: MGA,
          offers: [],
        }),
        fx.partGroup({
          brand: "BOSCH",
          number_norm: "F026",
          key: "BOSCH|F026",
          is_requested: false,
          analog_of: [MANN],
        }),
        fx.partGroup({
          brand: "LUZAR",
          number_norm: "LP01",
          key: "LUZAR|LP01",
          is_requested: false,
          analog_of: [MGA],
        }),
      ],
      stock_matches: [
        fx.stockItem(5, { number_norm: "F026" }),
        fx.stockItem(6, { number_norm: "LP01" }),
      ],
    }),
    fx.supplierResult({
      code: "other",
      groups: [
        fx.partGroup({
          brand: "Mann",
          number: "W 68/3",
          number_norm: "W683",
          name: "Фильтр масляный",
          key: MANN,
          offers: [fx.offer({ purchase_price: "750.00" })],
        }),
        fx.partGroup({
          brand: "BOSCH",
          number_norm: "F026",
          key: "BOSCH|F026",
          is_requested: false,
          analog_of: [MANN],
        }),
        fx.partGroup({
          brand: "MAHLE",
          number_norm: "OC1",
          key: "MAHLE|OC1",
          is_requested: false,
          analog_of: [MANN, MGA],
        }),
      ],
    }),
  ];
}

describe("requestedParts", () => {
  it("merges a part across suppliers in first-seen order", () => {
    const parts = requestedParts(twoParts(), now, { inStockOnly: false }).map(
      (p) => ({
        ...p,
        fastest: p.fastest?.purchase_price ?? null,
      }),
    );
    expect(parts).toEqual([
      {
        key: MANN,
        brand: "Mann",
        number: "W 68/3",
        name: "Фильтр масляный",
        offers: 3,
        minPrice: "710.00",
        fastest: "900.00",
        analogs: 2,
        suppliers: 2,
      },
      {
        key: MGA,
        brand: "MGA",
        number: "W68/3",
        name: "Насос водяной",
        offers: 0,
        minPrice: null,
        fastest: null,
        analogs: 2,
        suppliers: 1,
      },
    ]);
  });

  it("is empty without results", () => {
    expect(requestedParts([], now, { inStockOnly: false })).toEqual([]);
  });
});

describe("selectPart", () => {
  it("keeps only the part and its analogs", () => {
    const [a, b] = selectPart(twoParts(), MANN);
    expect(a.groups.map((g) => g.key)).toEqual([MANN, "BOSCH|F026"]);
    expect(b.groups.map((g) => g.key)).toEqual([
      MANN,
      "BOSCH|F026",
      "MAHLE|OC1",
    ]);
  });

  it("keeps a part without offers and its analogs", () => {
    const [a] = selectPart(twoParts(), MGA);
    expect(a.groups.map((g) => g.key)).toEqual([MGA, "LUZAR|LP01"]);
  });
});

describe("two suppliers by canonical key", () => {
  const KEY = "MANN|W683";
  const rossko = fx.supplierResult({
    code: "rossko",
    title: "Росско",
    groups: [
      fx.partGroup({
        brand: "Mann",
        number: "W 68/3",
        number_norm: "W683",
        name: "",
        key: KEY,
        analog_of: [],
        offers: [fx.offer({ purchase_price: "800.00", delivery_days: 3 })],
      }),
      fx.partGroup({
        brand: "BOSCH",
        number_norm: "F026",
        key: "BOSCH|F026",
        is_requested: false,
        analog_of: [KEY],
        offers: [],
      }),
    ],
  });
  const mikado = fx.supplierResult({
    code: "mikado",
    title: "Микадо",
    groups: [
      fx.partGroup({
        brand: "MANN-FILTER",
        number: "W683",
        number_norm: "W683",
        name: "Фильтр масляный",
        key: KEY,
        analog_of: [],
        offers: [
          fx.offer({ purchase_price: "700.00", delivery_days: 2 }),
          fx.offer({
            kind: "variants",
            purchase_price: "0.00",
            delivery_days: 0,
            order_code: "X1",
          }),
        ],
      }),
      fx.partGroup({
        brand: "BOSCH",
        number_norm: "F026",
        key: "BOSCH|F026",
        is_requested: false,
        analog_of: [KEY, "OTHER|1"],
        offers: [],
      }),
    ],
  });

  it("merges parts of two suppliers by key", () => {
    const merged = mergeGroups([rossko, mikado]);
    expect(merged).toHaveLength(2);
    const g = merged[0];
    expect(g.key).toBe(KEY);
    expect(g.brand).toBe("Mann");
    expect(g.number).toBe("W 68/3");
    expect(g.name).toBe("Фильтр масляный");
    expect(g.is_requested).toBe(true);
    expect(g.suppliers.map((s) => s.code)).toEqual(["rossko", "mikado"]);
    expect(g.suppliers[1].title).toBe("Микадо");
    expect(g.suppliers[1].offers).toHaveLength(2);
    expect(g.suppliers[1].group.brand).toBe("MANN-FILTER");
    expect(merged[1].analog_of).toEqual([KEY, "OTHER|1"]);
  });

  it("requestedParts takes the minimum over both suppliers", () => {
    const [p] = requestedParts([rossko, mikado], now, { inStockOnly: false });
    expect(p.minPrice).toBe("700.00");
    expect(p.offers).toBe(2);
    expect(p.fastest?.purchase_price).toBe("700.00");
  });

  it("summary picks the cheapest across suppliers, never variants", () => {
    const pick = cheapest([rossko, mikado], false);
    expect(pick?.supplier).toBe("mikado");
    expect(pick?.offer.purchase_price).toBe("700.00");
    const quick = fastest([rossko, mikado], false, now);
    expect(quick?.supplier).toBe("mikado");
    expect(quick?.offer.purchase_price).toBe("700.00");
    expect(bestPriceFor([rossko, mikado], "W683")).toBe("700.00");
  });

  it("keeps order offers eligible for cheapest and fastest", () => {
    const order = fx.supplierResult({
      code: "mikado",
      title: "Микадо",
      groups: [
        fx.partGroup({
          key: KEY,
          offers: [
            fx.offer({
              kind: "order",
              qty: 0,
              purchase_price: "650.00",
              delivery_days: 1,
              order_code: "v1004-w683",
            }),
          ],
        }),
      ],
    });
    const pick = cheapest([rossko, order], false);
    expect(pick?.offer.kind).toBe("order");
    expect(pick?.offer.purchase_price).toBe("650.00");
    expect(fastest([rossko, order], false, now)?.offer.kind).toBe("order");
  });
});

describe("search helpers", () => {
  const o = (price: string, over: Partial<Offer> = {}) =>
    fx.offer({ purchase_price: price, ...over });
  const one = (offers: Offer[], over: Partial<PartGroup> = {}) =>
    mergeGroups([
      fx.supplierResult({ groups: [fx.partGroup({ offers, ...over })] }),
    ]);

  it("isInStock", () => {
    expect(isInStock(o("1", { qty: 3 }))).toBe(true);
    expect(isInStock(o("1", { qty: 0 }))).toBe(false);
    expect(isInStock(o("1", { kind: "order" }))).toBe(false);
    expect(isInStock(o("1", { kind: "variants" }))).toBe(false);
  });

  it("filterInStock keeps requested, drops empty analogs", () => {
    const req = fx.partGroup({ offers: [o("1", { kind: "order" })] });
    const onlyOrder = fx.partGroup({
      key: "A|1",
      is_requested: false,
      offers: [o("1", { kind: "order" })],
    });
    const mixed = fx.partGroup({
      key: "B|1",
      is_requested: false,
      offers: [o("1", { kind: "order" }), o("2")],
    });
    const out = filterInStock(
      mergeGroups([fx.supplierResult({ groups: [req, onlyOrder, mixed] })]),
    );
    expect(out.map((g) => g.key)).toEqual(["KYB|333114", "B|1"]);
    expect(out[0]?.suppliers[0]?.offers).toEqual([]);
    expect(out[1]?.suppliers[0]?.offers).toHaveLength(1);
    expect(out[1]?.suppliers[0]?.offers[0]?.kind).toBe("normal");
  });

  it("bestOffers", () => {
    const a = o("100.00", { delivery_days: 3 });
    const b = o("200.00", { delivery_days: 0 });
    const r = bestOffers(one([a, b]), now);
    expect(r.cheapest).toBe(a);
    expect(r.fastest).toBe(b);
    const solo = bestOffers(one([a]), now);
    expect(solo.cheapest).toBe(a);
    expect(solo.fastest).toBe(a);
    const slow = o("100.00", { delivery_days: 5 });
    expect(bestOffers(one([slow, a]), now).cheapest).toBe(a);
    const v = o("1.00", { kind: "variants" });
    expect(bestOffers(one([v, a]), now).cheapest).toBe(a);
    expect(bestOffers([], now)).toEqual({ cheapest: null, fastest: null });
  });

  it("analogOffers", () => {
    const [g] = mergeGroups([
      fx.supplierResult({
        groups: [fx.partGroup({ offers: [o("150.00", { delivery_days: 1 })] })],
      }),
      fx.supplierResult({
        code: "mikado",
        title: "Микадо",
        groups: [fx.partGroup({ offers: [o("120.00", { delivery_days: 4 })] })],
      }),
    ]);
    const byP = analogOffers(g, "price", now);
    expect(byP[0]?.supplier.code).toBe("mikado");
    expect(byP[0]?.offer.purchase_price).toBe("120.00");
    expect(analogOffers(g, "time", now)[0]?.supplier.code).toBe("rossko");
  });

  it("requestedParts suppliers and inStockOnly", () => {
    const both = [
      fx.supplierResult({
        groups: [
          fx.partGroup({
            offers: [o("50.00", { kind: "order" }), o("100.00")],
          }),
        ],
      }),
      fx.supplierResult({ code: "mikado", title: "Микадо" }),
    ];
    const all = requestedParts(both, now, { inStockOnly: false });
    expect(all[0]?.suppliers).toBe(2);
    expect(all[0]?.minPrice).toBe("50.00");
    const stock = requestedParts(both, now, { inStockOnly: true });
    expect(stock[0]?.minPrice).toBe("100.00");
  });

  it("stockForPart", () => {
    const items = [
      fx.stockItem(1, { brand: "MANN", brand_key: "MANN" }),
      fx.stockItem(2, { brand: "MANN-FILTER", brand_key: "MANN" }),
      fx.stockItem(3, { brand: "FILTRON", brand_key: "FILTRON" }),
    ];
    expect(stockForPart(items, "MANN|W683").map((i) => i.id)).toEqual([1, 2]);
    expect(stockForPart(items, "BOSCH|W683")).toEqual([]);
  });
});

describe("per-supplier part cards", () => {
  const W = "MANN|W683";
  const o = (price: string, over: Partial<Offer> = {}) =>
    fx.offer({ purchase_price: price, ...over });
  const rossko = () =>
    fx.supplierResult({
      code: "rossko",
      title: "Росско",
      groups: [
        fx.partGroup({
          brand: "Mann",
          key: W,
          number_norm: "W683",
          offers: [
            o("513.00", { delivery_from: at(31) }),
            o("548.00", { delivery_from: at(22, 12) }),
          ],
        }),
        fx.partGroup({
          brand: "Geely",
          key: "GEELY|1",
          is_requested: false,
          analog_of: [W],
          offers: [o("126.00", { delivery_from: at(30) })],
        }),
      ],
    });
  const mikado = () =>
    fx.supplierResult({
      code: "mikado",
      title: "Микадо",
      groups: [
        fx.partGroup({
          brand: "MANN-FILTER",
          key: W,
          offers: [o("627.84", { kind: "variants" })],
        }),
      ],
    });
  const opts = { showAnalogs: true, sort: "price" as const, now };

  it("makes one card per supplier with its own spelling", () => {
    const cards = partCards([rossko(), mikado()], opts);
    expect(cards.map((c) => c.group.brand).sort()).toEqual([
      "MANN-FILTER",
      "Mann",
    ]);
  });

  it("includes analogs in minPrice only when asked, counts own analogs", () => {
    const on = partCards([rossko(), mikado()], opts);
    const off = partCards([rossko(), mikado()], {
      ...opts,
      showAnalogs: false,
    });
    const r = (cs: typeof on) => cs.find((c) => c.supplier === "rossko");
    expect(r(on)?.minPrice).toBe("126.00");
    expect(r(off)?.minPrice).toBe("513.00");
    expect(r(on)?.analogs).toBe(1);
    expect(on.find((c) => c.supplier === "mikado")?.analogs).toBe(0);
  });

  it("variants-only card keeps its price but has no fastest", () => {
    const c = partCards([mikado()], opts)[0];
    expect(c.minPrice).toBe("627.84");
    expect(c.fastest).toBeNull();
  });

  it("sorts by price and by time, empty card last", () => {
    const cheap = fx.supplierResult({
      code: "a",
      groups: [
        fx.partGroup({
          key: W,
          offers: [o("140.98", { delivery_from: at(22, 11) })],
        }),
      ],
    });
    const slow = fx.supplierResult({
      code: "b",
      groups: [
        fx.partGroup({
          key: W,
          offers: [o("126.00", { delivery_from: at(30) })],
        }),
      ],
    });
    const empty = fx.supplierResult({
      code: "c",
      groups: [fx.partGroup({ key: W, offers: [] })],
    });
    const codes = (sort: "price" | "time") =>
      partCards([empty, cheap, slow], { ...opts, sort }).map((c) => c.supplier);
    expect(codes("price")).toEqual(["b", "a", "c"]);
    expect(codes("time")).toEqual(["a", "b", "c"]);
    expect(partCards([empty], opts)[0]?.minPrice).toBeNull();
  });

  it("supplierPart splits original and analogs", () => {
    const p = supplierPart(rossko(), W);
    expect(p.original?.key).toBe(W);
    expect(p.analogs.map((g) => g.key)).toEqual(["GEELY|1"]);
  });
});

describe("row helpers", () => {
  const o = (price: string, over: Partial<Offer> = {}) =>
    fx.offer({ purchase_price: price, ...over });

  it("defaultOffer follows the sort", () => {
    const g = fx.partGroup({
      offers: [
        o("513.00", { delivery_from: at(31) }),
        o("548.00", { delivery_from: at(22, 12) }),
      ],
    });
    expect(defaultOffer(g, "price", now)?.purchase_price).toBe("513.00");
    expect(defaultOffer(g, "time", now)?.purchase_price).toBe("548.00");
  });

  it("defaultOffer prefers own warehouse only on a full tie", () => {
    const partner = o("100.00", { warehouse: "Партнерский склад" });
    const own = o("100.00", { warehouse: "Москва, ул. 1" });
    const g = fx.partGroup({ offers: [partner, own] });
    expect(defaultOffer(g, "price", now)).toBe(own);
    const cheaper = o("90.00", { warehouse: "Партнерский склад" });
    expect(
      defaultOffer(fx.partGroup({ offers: [own, cheaper] }), "price", now),
    ).toBe(cheaper);
  });

  it("defaultOffer returns a lone variants offer, but ranks it last", () => {
    const v = o("627.84", { kind: "variants" });
    expect(defaultOffer(fx.partGroup({ offers: [v] }), "price", now)).toBe(v);
    const n = o("900.00");
    expect(defaultOffer(fx.partGroup({ offers: [v, n] }), "price", now)).toBe(
      n,
    );
  });

  it("sortGroups orders by default offer, empty last", () => {
    const g = (price: string | null) =>
      fx.partGroup({
        key: `K|${price ?? "none"}`,
        offers: price === null ? [] : [o(price)],
      });
    const sorted = sortGroups(
      [g("217.71"), g(null), g("126.00"), g("165.00")],
      "price",
      now,
    );
    expect(sorted.map((x) => x.key)).toEqual([
      "K|126.00",
      "K|165.00",
      "K|217.71",
      "K|none",
    ]);
  });

  it("supplierBest picks cheapest and fastest by reference", () => {
    const geely = o("126.00", { delivery_from: at(30) });
    const big = o("165.00", { delivery_from: at(22, 12) });
    const v = o("1.00", { kind: "variants" });
    const g1 = fx.partGroup({ key: "G|1", offers: [geely, v] });
    const g2 = fx.partGroup({ key: "B|1", offers: [big] });
    const b = supplierBest([g1, g2], now);
    expect(b.cheapest?.offer).toBe(geely);
    expect(b.cheapest?.group).toBe(g1);
    expect(b.fastest?.offer).toBe(big);
    expect(b.fastest?.group).toBe(g2);
    expect(supplierBest([], now)).toEqual({ cheapest: null, fastest: null });
  });

  it("stockQty sums positive qty by brand key and number", () => {
    const items = [
      fx.stockItem(1, {
        brand: "MANN",
        brand_key: "MANN",
        number_norm: "W683",
        qty: 14,
      }),
      fx.stockItem(2, {
        brand: "MANN-FILTER",
        brand_key: "MANN",
        number_norm: "W683",
        qty: 1,
      }),
      fx.stockItem(3, { brand_key: "MANN", number_norm: "W683", qty: 0 }),
      fx.stockItem(4, { brand_key: "BOSCH", number_norm: "W683", qty: 5 }),
    ];
    expect(stockQty(items, "MANN|W683")).toBe(15);
    expect(stockQty(items, "OTHER|W683")).toBe(0);
  });
});
