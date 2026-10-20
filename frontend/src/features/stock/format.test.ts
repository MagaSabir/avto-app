import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatMoney, formatPrice } from "./format";

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

  it("formatDateTime and formatDate use local time", () => {
    const d = new Date(2026, 9, 20, 14, 32);
    expect(formatDateTime(d.toISOString())).toBe("20.10.2026 14:32");
    expect(formatDate(d.toISOString())).toBe("20.10.2026");
  });
});
