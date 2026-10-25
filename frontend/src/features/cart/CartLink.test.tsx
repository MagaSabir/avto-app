import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/api/cart";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CartLink } from "./CartLink";

afterEach(() => {
  vi.unstubAllGlobals();
});

function cartItem(id: number): CartItem {
  return {
    id,
    supplier: "rossko",
    stock_id: `s${String(id)}`,
    brand: "KYB",
    number: "333114",
    number_norm: "333114",
    name: "Стойка амортизационная",
    warehouse: "Новосибирск",
    multiplicity: 1,
    qty: 1,
    available: 20,
    delivery_days: null,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    order_code: null,
    price: "2940.00",
    sum: "2940.00",
  };
}

describe("CartLink", () => {
  it("shows the row count and links to /cart", async () => {
    mockApi({
      "GET /api/cart": () => ({
        items: [cartItem(1), cartItem(2), cartItem(3)],
        total: "0.00",
      }),
    });
    renderWithProviders(<CartLink />);
    const link = await screen.findByRole("link", { name: "Корзина: 3" });
    expect(link).toHaveAttribute("href", "/cart");
    expect(link).toHaveTextContent("3");
  });

  it("has no badge for an empty cart", async () => {
    mockApi({ "GET /api/cart": () => ({ items: [], total: "0.00" }) });
    renderWithProviders(<CartLink />);
    const link = await screen.findByRole("link", { name: "Корзина: 0" });
    expect(link.textContent).toBe("");
  });
});
