import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadSupplierChoice,
  saveSupplierChoice,
  selectedSuppliers,
} from "./supplierChoice";

const R = { code: "rossko", title: "Росско" };
const M = { code: "mikado", title: "Микадо" };

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("selectedSuppliers", () => {
  it("all when nothing saved", () => {
    expect(selectedSuppliers([R, M], null)).toEqual([R, M]);
  });

  it("keeps saved in supplier order", () => {
    expect(selectedSuppliers([R, M], ["mikado"])).toEqual([M]);
  });

  it("drops unknown codes; none left → all", () => {
    expect(selectedSuppliers([R, M], ["unknown"])).toEqual([R, M]);
  });

  it("empty saved → all", () => {
    expect(selectedSuppliers([R, M], [])).toEqual([R, M]);
  });
});

describe("supplier choice storage", () => {
  it("round-trips", () => {
    saveSupplierChoice(["mikado"]);
    expect(loadSupplierChoice()).toEqual(["mikado"]);
  });

  it("broken JSON → null", () => {
    localStorage.setItem("search.suppliers", "oops");
    expect(loadSupplierChoice()).toBeNull();
  });

  it("not a string array → null", () => {
    localStorage.setItem("search.suppliers", "[1]");
    expect(loadSupplierChoice()).toBeNull();
  });

  it("storage throws → null, save does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadSupplierChoice()).toBeNull();
    expect(() => {
      saveSupplierChoice(["rossko"]);
    }).not.toThrow();
  });
});
