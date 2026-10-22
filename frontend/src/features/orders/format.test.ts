import { describe, expect, it } from "vitest";

import { order } from "@/test/ordersFixtures";

import { deliveryValue, formatDay } from "./format";

describe("formatDay", () => {
  it("formats a date without zone shift", () => {
    expect(formatDay("2026-10-19")).toBe("19 окт 2026");
  });
});

describe("deliveryValue", () => {
  it("courier with address", () => {
    expect(deliveryValue(order())).toBe(
      "село Тестовое, ул. Примерная, 19 окт 2026",
    );
  });
  it("pickup without address", () => {
    expect(
      deliveryValue(
        order({
          delivery_type: "Самовывоз",
          delivery_address: null,
          delivery_date: "2026-09-26",
        }),
      ),
    ).toBe("26 сен 2026");
  });
  it("address only", () => {
    expect(deliveryValue(order({ delivery_date: null }))).toBe(
      "село Тестовое, ул. Примерная",
    );
  });
  it("neither address nor date", () => {
    expect(
      deliveryValue(
        order({
          delivery_type: "Самовывоз",
          delivery_address: null,
          delivery_date: null,
        }),
      ),
    ).toBe("");
  });
});
