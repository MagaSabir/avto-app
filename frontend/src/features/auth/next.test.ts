import { describe, expect, it } from "vitest";

import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a local path with query", () => {
    expect(safeNext("/?q=W683")).toBe("/?q=W683");
  });

  it.each([
    null,
    "",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "/login",
  ])("falls back to /stock for %j", (raw) => {
    expect(safeNext(raw)).toBe("/stock");
  });

  it("rejects /login with query", () => {
    expect(safeNext("/login?next=%2F")).toBe("/stock");
  });
});
