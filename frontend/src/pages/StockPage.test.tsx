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

const panel = () => screen.getByTestId("item-panel");

it("opens the panel overlay on row click and closes it keeping selection", async () => {
  mockPage();
  renderWithProviders(<StockPage />);
  expect(await screen.findByText("OC-4")).toBeTruthy();
  expect(panel()).toHaveAttribute("data-open", "false");
  fireEvent.click(screen.getByText("OC-4"));
  await waitFor(() => {
    expect(panel()).toHaveAttribute("data-open", "true");
  });
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(await screen.findByRole("button", { name: "Закрыть" }));
  expect(document.body.style.overflow).toBe("");
  expect(panel()).toHaveAttribute("data-open", "false");
  expect(screen.getAllByRole("row")[1]).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await screen.findByRole("button", { name: "Продать" })).toBeTruthy();
});

it("does not open the overlay when loaded with ?item=", async () => {
  mockPage();
  renderWithProviders(<StockPage />, { route: "/stock?item=5" });
  await screen.findByRole("button", { name: "Продать" });
  expect(panel()).toHaveAttribute("data-open", "false");
});

it("does not open the overlay after a receipt is accepted", async () => {
  mockApi({
    "GET /api/settings": () => ({ default_markup: "30.00" }),
    "GET /api/stock/items": () => ({
      items: [mk(4)],
      counts: { all: 1, low: 0, out: 0 },
    }),
    "GET /api/stock/brands": () => ["MANN"],
    "GET /api/stock/suppliers": () => [],
    "GET /api/stock/lookup": () => [],
    "POST /api/stock/receipts": () =>
      new Response(JSON.stringify({ item: mk(4), move: {} }), { status: 201 }),
    "GET /api/stock/items/4": () => detail(4),
    "GET /api/stock/items/4/moves": () => [],
  });
  renderWithProviders(<StockPage />);
  await waitFor(() => {
    expect(screen.getByLabelText<HTMLInputElement>("Наценка, %").value).toBe(
      "30",
    );
  });
  const type = (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  };
  type("Номер", "OC-4");
  type("Бренд", "MANN");
  type("Название", "Фильтр");
  type("Кол-во", "4");
  type("Закупка", "400");
  fireEvent.click(screen.getByRole("button", { name: "Принять" }));
  await screen.findByRole("button", { name: "Продать" });
  expect(panel()).toHaveAttribute("data-open", "false");
});

it("makes the table header sticky", async () => {
  mockPage();
  renderWithProviders(<StockPage />);
  await screen.findByText("OC-4");
  const th = screen.getByText("Статус").closest("th");
  expect(th).toHaveClass("sticky", "top-0", "bg-card");
});
