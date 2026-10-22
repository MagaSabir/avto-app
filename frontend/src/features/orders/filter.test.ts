import { describe, expect, it } from "vitest";

import type { Order, OrderPart } from "@/api/orders";

import { defaultPeriod, filterOrders, normalizeNumber } from "./filter";

function part(over: Partial<OrderPart>): OrderPart {
  return {
    guid: "g",
    brand: "Brand",
    number: "N1",
    name: "Деталь",
    price: "10.00",
    count: 1,
    delivery_days: null,
    comment: null,
    status_code: 0,
    ...over,
  };
}

function order(id: number, parts: OrderPart[]): Order {
  return { id, parts } as Order;
}

const a = order(1000000, [
  part({
    number: "HCZB-003",
    name: "Клапан",
    brand: "Parts-Mall",
    status_code: 7,
  }),
  part({ number: "X1", status_code: 0 }),
]);
const b = order(1000001, [part({ number: "Y2", status_code: 2 })]);
const orders = [a, b];

describe("filterOrders", () => {
  it("returns all without filters", () => {
    expect(filterOrders(orders, null, "")).toEqual(orders);
    expect(filterOrders(orders, null, "   ")).toEqual(orders);
  });

  it("filters by group keeping all parts", () => {
    const res = filterOrders(orders, "refused", "");
    expect(res).toHaveLength(1);
    expect(res[0].parts).toHaveLength(2);
  });

  it("searches by number, name, brand and id", () => {
    expect(filterOrders(orders, null, "hczb003")).toEqual([a]);
    expect(filterOrders(orders, null, "HCZB 003")).toEqual([a]);
    expect(filterOrders(orders, null, "клАпан")).toEqual([a]);
    expect(filterOrders(orders, null, "parts-mall")).toEqual([a]);
    expect(filterOrders(orders, null, "1000001")).toEqual([b]);
  });

  it("intersects group and text", () => {
    expect(filterOrders(orders, "issued", "hczb")).toEqual([]);
    expect(filterOrders(orders, "refused", "hczb")).toEqual([a]);
  });
});

describe("normalizeNumber", () => {
  it("normalizes", () => {
    expect(normalizeNumber("bkr5ekb-11@7804")).toBe("BKR5EKB11");
  });
});

describe("defaultPeriod", () => {
  it("goes back three months", () => {
    expect(defaultPeriod(new Date(2026, 9, 22))).toEqual({
      start: "2026-07-22",
      end: "2026-10-22",
    });
    expect(defaultPeriod(new Date(2026, 4, 31)).start).toBe("2026-02-28");
    expect(defaultPeriod(new Date(2026, 0, 15)).start).toBe("2025-10-15");
  });
});
