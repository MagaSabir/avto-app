import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CartLink } from "./CartLink";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CartLink", () => {
  it("shows the row count and links to /cart", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [{}, {}, {}], total: "0.00" }),
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
    await waitFor(() => {
      expect(link).toHaveTextContent("");
    });
  });
});
