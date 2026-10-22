import { describe, expect, it } from "vitest";

import type { SettlementDocument } from "@/api/settlements";

import { paidAmounts } from "./derive";

function doc(amount: string, balance: string): SettlementDocument {
  return {
    date: "2026-10-20T09:15:28Z",
    name: "d",
    amount,
    balance,
    payer: "p",
    status: "s",
    order_id: null,
    days_remaining: null,
    items: [],
  };
}

// Newest first, as Rossko returns them.
const docs = [
  doc("0.00", "67.54"), // payment after the sale below
  doc("1191.00", "-1132.46"), // sale
  doc("0.00", "58.54"), // oldest loaded: no older document to compare
];

describe("paidAmounts", () => {
  it("derives a payment from the balance change", () => {
    expect(paidAmounts(docs, false)[0]).toBe("1200.00");
  });

  it("leaves sales empty", () => {
    expect(paidAmounts(docs, false)[1]).toBeNull();
  });

  it("leaves the oldest loaded document empty", () => {
    expect(paidAmounts(docs, false)[2]).toBeNull();
  });

  it("leaves everything empty when filtered by status", () => {
    expect(paidAmounts(docs, true)).toEqual([null, null, null]);
  });

  it("keeps kopecks exact", () => {
    expect(paidAmounts([doc("0", "0.30"), doc("0", "0.10")], false)[0]).toBe(
      "0.20",
    );
  });
});
