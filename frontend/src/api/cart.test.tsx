import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useAddToCart, useCart, type CartItemIn } from "./cart";

afterEach(() => {
  vi.unstubAllGlobals();
});

const newItem: CartItemIn = {
  supplier: "rossko",
  stock_id: "s1",
  brand: "KYB",
  number: "333114",
  name: "Стойка амортизационная",
  warehouse: "Новосибирск",
  multiplicity: 1,
  available: 20,
  delivery_days: null,
  delivery_from: null,
  delivery_to: null,
  kind: "normal",
  kind_code: "0",
  price: "2940.00",
  qty: 2,
};

describe("cart hooks", () => {
  it("useAddToCart posts JSON and refetches the cart", async () => {
    let cartCalls = 0;
    let posted: RequestInit | undefined;
    mockApi({
      "GET /api/cart": () => {
        cartCalls += 1;
        return { items: [], total: "0.00" };
      },
      "POST /api/cart/items": (init) => {
        posted = init;
        return new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ cart: useCart(), add: useAddToCart() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(cartCalls).toBe(1);
    });

    await act(async () => {
      await result.current.add.mutateAsync(newItem);
    });

    expect(posted?.method).toBe("POST");
    expect(new Headers(posted?.headers).get("Content-Type")).toBe(
      "application/json",
    );
    await waitFor(() => {
      expect(cartCalls).toBe(2);
    });
  });
});
