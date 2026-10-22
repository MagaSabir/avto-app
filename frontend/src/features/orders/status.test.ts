import { describe, expect, it } from "vitest";

import { ORDER_GROUPS, partStatus } from "./status";

describe("partStatus", () => {
  it("maps known codes", () => {
    expect(partStatus(2)).toEqual({
      label: "Передан покупателю",
      group: "issued",
      tone: "neutral",
    });
    expect(partStatus(31)).toEqual({
      label: "Ждём возврата на склад",
      group: "returns",
      tone: "neutral",
    });
    expect(partStatus(7)).toMatchObject({ group: "refused", tone: "out" });
    expect(partStatus(0)).toMatchObject({ group: "active", tone: "low" });
    expect(partStatus(6)).toMatchObject({ group: "ready", tone: "ok" });
  });

  it("handles unknown code", () => {
    expect(partStatus(99)).toEqual({
      label: "Статус 99",
      group: null,
      tone: "neutral",
    });
  });

  it("covers every group", () => {
    const used = new Set<string | null>();
    for (let code = 0; code <= 40; code++) used.add(partStatus(code).group);
    for (const g of ORDER_GROUPS) expect(used.has(g.value)).toBe(true);
  });
});
