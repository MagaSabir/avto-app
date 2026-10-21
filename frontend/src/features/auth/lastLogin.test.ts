import { afterEach, describe, expect, it, vi } from "vitest";

import { getLastLogin, setLastLogin } from "./lastLogin";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("lastLogin", () => {
  it("is empty at first and keeps the stored login", () => {
    expect(getLastLogin()).toBe("");
    setLastLogin("sabir");
    expect(getLastLogin()).toBe("sabir");
    expect(localStorage.getItem("lastLogin")).toBe("sabir");
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => {
      setLastLogin("sabir");
    }).not.toThrow();
    expect(getLastLogin()).toBe("");
  });
});
