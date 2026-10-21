import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPrice,
  formatShortDateTime,
  movesLabel,
} from "./format";

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("format", () => {
  it("formatMoney groups thousands and uses comma", () => {
    expect(plain(formatMoney("2449.85"))).toBe("2 449,85");
    expect(plain(formatMoney("540.00"))).toBe("540,00");
  });

  it("formatPrice drops zero kopecks", () => {
    expect(formatPrice("540.00")).toBe("540");
    expect(formatPrice("540.50")).toBe("540,50");
    expect(plain(formatPrice("12540.00"))).toBe("12 540");
  });

  it("formatShortDateTime omits the year", () => {
    const d = new Date(2026, 9, 20, 23, 43);
    expect(formatShortDateTime(d.toISOString())).toBe("20.10 23:43");
  });

  it("formatDateTime and formatDate use local time", () => {
    const d = new Date(2026, 9, 20, 14, 32);
    expect(formatDateTime(d.toISOString())).toBe("20.10.2026 14:32");
    expect(formatDate(d.toISOString())).toBe("20.10.2026");
  });
});

describe("movesLabel", () => {
  it.each([
    [1, "1 движение"],
    [2, "2 движения"],
    [4, "4 движения"],
    [5, "5 движений"],
    [11, "11 движений"],
    [12, "12 движений"],
    [14, "14 движений"],
    [21, "21 движение"],
    [22, "22 движения"],
    [25, "25 движений"],
    [0, "0 движений"],
  ])("%i", (n, text) => {
    expect(movesLabel(n)).toBe(text);
  });
});
