import { describe, expect, it } from "vitest";

import { order } from "@/test/ordersFixtures";

import { deliveryLine, formatDay } from "./format";

describe("formatDay", () => {
  it("formats a date without zone shift", () => {
    expect(formatDay("2026-10-19")).toBe("19 окт 2026");
  });
});

describe("deliveryLine", () => {
  it("courier with address", () => {
    expect(deliveryLine(order())).toBe(
      "Курьерская доставка: село Тестовое, ул. Примерная, 19 окт 2026",
    );
  });
  it("pickup without address", () => {
    expect(
      deliveryLine(
        order({
          delivery_type: "Самовывоз",
          delivery_address: null,
          delivery_date: "2026-09-26",
        }),
      ),
    ).toBe("Самовывоз, 26 сен 2026");
  });
  it("type only", () => {
    expect(
      deliveryLine(
        order({
          delivery_type: "Самовывоз",
          delivery_address: null,
          delivery_date: null,
        }),
      ),
    ).toBe("Самовывоз");
  });
});
