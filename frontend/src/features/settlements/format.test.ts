import { describe, expect, it } from "vitest";

import { formatDocDate, formatSigned } from "./format";

describe("formatSigned", () => {
  it("adds a plus to an overpayment", () => {
    expect(formatSigned("67.54")).toBe("+67,54 ₽");
  });

  it("uses a real minus and groups thousands for a debt", () => {
    expect(formatSigned("-1250.40")).toBe("−1\u00a0250,40 ₽");
  });

  it("shows zero without a sign", () => {
    expect(formatSigned("0.00")).toBe("0,00 ₽");
  });
});

describe("formatDocDate", () => {
  it("shows a short month and local time like Rossko", () => {
    const iso = new Date(2026, 9, 20, 12, 15).toISOString();
    expect(formatDocDate(iso)).toBe("20 окт 2026, 12:15");
  });

  it("does not pad the hour", () => {
    const iso = new Date(2026, 9, 19, 6, 41).toISOString();
    expect(formatDocDate(iso)).toBe("19 окт 2026, 6:41");
  });
});
