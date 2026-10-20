import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useNavigationType } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { StockPage } from "./StockPage";

afterEach(() => vi.unstubAllGlobals());

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

const detail = (id: number) => ({
  ...mk(id),
  last_receipt_at: null,
  last_receipt_supplier: null,
  last_sale_at: null,
  sold_30d: 0,
});

function mockPage() {
  mockApi({
    "GET /api/settings": () => ({ default_markup: "30.00" }),
    "GET /api/stock/items": () => ({
      items: [mk(4), mk(5)],
      counts: { all: 2, low: 0, out: 0 },
    }),
    "GET /api/stock/brands": () => [],
    "GET /api/stock/suppliers": () => [],
    "GET /api/stock/lookup": () => [],
    "GET /api/stock/items/4": () => detail(4),
    "GET /api/stock/items/4/moves": () => [],
    "GET /api/stock/items/5": () => detail(5),
    "GET /api/stock/items/5/moves": () => [],
  });
}

it("marks the item from the URL as selected", async () => {
  mockPage();
  renderWithProviders(<StockPage />, { route: "/stock?item=5" });
  const cell = await screen.findByText("OC-5");
  expect(cell.closest("tr")).toHaveAttribute("aria-selected", "true");
  expect(await screen.findByRole("button", { name: "Продать" })).toBeVisible();
});

function NavigationType() {
  return <output aria-label="navigation">{useNavigationType()}</output>;
}

it("replaces the history entry when a row is selected", async () => {
  mockPage();
  renderWithProviders(
    <>
      <StockPage />
      <NavigationType />
    </>,
  );
  fireEvent.click(await screen.findByText("OC-4"));
  await waitFor(() => {
    expect(screen.getByText("OC-4").closest("tr")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  expect(screen.getByLabelText("navigation")).toHaveTextContent("REPLACE");
});
