import { describe, expect, it } from "vitest";

import { formatSigned } from "./format";

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
