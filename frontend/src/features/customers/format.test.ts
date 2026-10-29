import { describe, expect, it } from "vitest";

import { carLabel, formatPhone, splitPlate } from "./format";

describe("formatPhone", () => {
  it("formats 11 digits starting with 7", () => {
    expect(formatPhone("79161234567")).toBe("+7 916 123-45-67");
  });

  it("returns other values as is", () => {
    expect(formatPhone("89161234567")).toBe("89161234567");
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("")).toBe("");
  });
});

describe("carLabel", () => {
  it("joins non-empty parts", () => {
    expect(
      carLabel({ id: 1, make: "Test", model: "X1", plate: "A000AA" }),
    ).toBe("Test X1 A000AA");
  });

  it("skips missing and blank parts", () => {
    expect(carLabel({ id: 1, make: null, model: " ", plate: "A000AA" })).toBe(
      "A000AA",
    );
    expect(carLabel({ id: 1, make: "Test", model: null, plate: null })).toBe(
      "Test",
    );
  });
});

describe("splitPlate", () => {
  it("splits a Russian plate into number and region", () => {
    expect(splitPlate("А123ВС77")).toEqual({
      number: "А 123 ВС",
      region: "77",
    });
    expect(splitPlate("М456ОР750")).toEqual({
      number: "М 456 ОР",
      region: "750",
    });
  });

  it("keeps other plates as they are", () => {
    expect(splitPlate("А000АА")).toEqual({ number: "А000АА", region: null });
    expect(splitPlate("AB1234")).toEqual({ number: "AB1234", region: null });
  });
});
