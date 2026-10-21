import { afterEach, describe, expect, it, vi } from "vitest";

import { getLastSearch, setLastSearch } from "./lastSearch";

afterEach(() => {
  vi.restoreAllMocks();
  setLastSearch("");
  sessionStorage.clear();
});

describe("lastSearch", () => {
  it("is empty at first and keeps the last search in the tab", () => {
    expect(getLastSearch()).toBe("");
    setLastSearch("?q=W68%2F3&part=MANN%7CW683");
    expect(getLastSearch()).toBe("?q=W68%2F3&part=MANN%7CW683");
    expect(sessionStorage.getItem("avto.lastSearch")).toBe(
      "?q=W68%2F3&part=MANN%7CW683",
    );
  });

  it("reads what an earlier page load saved", () => {
    sessionStorage.setItem("avto.lastSearch", "?q=333114");
    expect(getLastSearch()).toBe("?q=333114");
  });

  it("falls back to memory when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setLastSearch("?q=333114");
    expect(getLastSearch()).toBe("?q=333114");
  });

  it("prefers memory when a storage write failed", () => {
    setLastSearch("?q=OLD");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    setLastSearch("?q=NEW");
    expect(sessionStorage.getItem("avto.lastSearch")).toBe("?q=OLD");
    expect(getLastSearch()).toBe("?q=NEW");
  });
});
