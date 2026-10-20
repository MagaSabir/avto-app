import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useReceipt, useStockItems } from "./stock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stock hooks", () => {
  it("useReceipt invalidates stock queries", async () => {
    let listCalls = 0;
    mockApi({
      "GET /api/stock/items": () => {
        listCalls += 1;
        return { items: [], counts: { all: 0, low: 0, out: 0 } };
      },
      "POST /api/stock/receipts": () => ({}),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ list: useStockItems("", "all"), receipt: useReceipt() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(listCalls).toBe(1);
    });

    await act(async () => {
      await result.current.receipt.mutateAsync({
        number: "A1",
        brand: "B",
        name: "N",
        qty: 1,
        purchase_price: "10.00",
        markup: "30.00",
        sale_price: "20.00",
        price_policy: "update",
      });
    });

    await waitFor(() => {
      expect(listCalls).toBe(2);
    });
  });
});
