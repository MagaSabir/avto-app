import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { StockPage } from "./StockPage";

afterEach(() => vi.unstubAllGlobals());

it("marks the item from the URL as selected", async () => {
  const mk = (id: number) => ({
    id,
    number_raw: `OC-${String(id)}`,
    number_norm: `OC${String(id)}`,
    brand: "MANN",
    name: "Фильтр",
    qty: 5,
    min_qty: 2,
    cell: null,
    purchase_price: "400.00",
    markup: "30.00",
    sale_price: "520.00",
    status: "ok",
  });
  mockApi({
    "GET /api/settings": () => ({ default_markup: "30.00" }),
    "GET /api/stock/items": () => ({
      items: [mk(4), mk(5)],
      counts: { all: 2, low: 0, out: 0 },
    }),
    "GET /api/stock/brands": () => [],
    "GET /api/stock/suppliers": () => [],
    "GET /api/stock/lookup": () => [],
  });
  renderWithProviders(<StockPage />, { route: "/stock?item=5" });
  const cell = await screen.findByText("OC-5");
  expect(cell.closest("tr")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Выберите позицию в таблице")).toBeInTheDocument();
});
