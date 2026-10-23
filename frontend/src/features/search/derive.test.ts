import { describe, expect, it } from "vitest";

import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "../../api/search";
import {
  arrangeGroups,
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

describe("arrangeGroups", () => {
  const requested = group("REQ", true, [offer("5000.00"), offer("100.00")]);
  const analogs = [
    group("A3", false, [offer("20163.00")]),
    group("A1", false, [offer("2144.00")]),
    group("A2", false, [offer("2315.00")]),
  ];

  it("keeps requested first and sorts analogs by price", () => {
    const out = arrangeGroups([...analogs, requested], {
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
    const out = arrangeGroups(groups, {
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
    const out = arrangeGroups([g], { showAnalogs: true, sort: "time", now });
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
    const out = arrangeGroups([g], { showAnalogs: true, sort: "price", now });
    expect(out[0]?.offers.map((o) => o.purchase_price)).toEqual([
      "200.00",
      "300.00",
      "100.00",
    ]);
  });

  it("ranks analogs with own stock above partner-only analogs", () => {
    const partner = "Партнерский склад";
    const out = arrangeGroups(
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
    const out = arrangeGroups([...analogs, requested], {
      showAnalogs: false,
      sort: "price",
      now,
    });
    expect(out.map((g) => g.number_norm)).toEqual(["REQ"]);
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
    const parts = requestedParts(twoParts(), now).map((p) => ({
      ...p,
      fastest: p.fastest?.purchase_price ?? null,
    }));
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
      },
    ]);
  });

  it("is empty without results", () => {
    expect(requestedParts([], now)).toEqual([]);
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
    expect(merged[1].analog_of).toEqual([KEY, "OTHER|1"]);
  });

  it("requestedParts takes the minimum over both suppliers", () => {
    const [p] = requestedParts([rossko, mikado], now);
    expect(p.minPrice).toBe("700.00");
    expect(p.offers).toBe(2);
    expect(p.fastest?.purchase_price).toBe("700.00");
  });

  it("summary picks the cheapest across suppliers, never variants", () => {
    const pick = cheapest([rossko, mikado], false);
    expect(pick?.supplier).toBe("mikado");
    expect(pick?.offer.purchase_price).toBe("700.00");
    expect(fastest([rossko, mikado], false, now)?.supplier).toBe("mikado");
    expect(bestPriceFor([rossko, mikado], "W683")).toBe("700.00");
  });
});
