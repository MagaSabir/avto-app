import { describe, expect, it } from "vitest";

import { markupFromSale, parseMoney, parsePercent, salePrice } from "./pricing";

describe("salePrice", () => {
  it.each([
    ["412.00", "30", "540.00"],
    ["415.38", "30", "540.00"],
    ["400", "35", "540.00"],
    ["415.39", "30", "550.00"],
    ["100", "0", "100.00"],
    ["101", "0", "110.00"],
    ["100", "33.33", "140.00"],
    ["0.01", "0", "10.00"],
  ])("%s + %s%% -> %s", (purchase, markup, expected) => {
    expect(salePrice(purchase, markup)).toBe(expected);
  });
});

describe("markupFromSale", () => {
  it.each([
    ["412.00", "540.00", "31.07"],
    ["400", "540", "35.00"],
    ["500", "400", "-20.00"],
  ])("%s -> %s = %s", (purchase, sale, expected) => {
    expect(markupFromSale(purchase, sale)).toBe(expected);
  });
});

describe("parseMoney", () => {
  it.each([
    ["412,5", "412.50"],
    ["1 234,00", "1234.00"],
    ["412", "412.00"],
    ["0,01", "0.01"],
  ])("%s -> %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["abc", "-5", "0", "0,00", "1.234", ""])("%s -> null", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("parsePercent", () => {
  it("accepts zero", () => {
    expect(parsePercent("0")).toBe("0.00");
  });
  it("accepts comma decimals", () => {
    expect(parsePercent("33,3")).toBe("33.30");
  });
  it.each(["-1", "x", "1.234", ""])("%s -> null", (input) => {
    expect(parsePercent(input)).toBeNull();
  });
});
