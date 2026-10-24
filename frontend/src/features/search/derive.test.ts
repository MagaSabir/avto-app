import { describe, expect, it } from "vitest";

import type { Offer } from "../../api/search";
import {
  stockForPart,
  cents,
  deliveryRank,
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

describe("stockForPart", () => {
  it("keeps items of the part's canonical brand", () => {
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
