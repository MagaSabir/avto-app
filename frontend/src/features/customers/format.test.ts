import { describe, expect, it } from "vitest";

import { carLabel, formatPhone } from "./format";

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
