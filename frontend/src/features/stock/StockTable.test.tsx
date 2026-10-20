import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { StockItem, StockItemList } from "@/api/stock";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { StockTable } from "./StockTable";

afterEach(() => vi.unstubAllGlobals());

function item(id: number, over: Partial<StockItem> = {}): StockItem {
  return {
    id,
    number_raw: `OC-${String(id)}`,
    number_norm: `OC${String(id)}`,
    brand: "MANN",
    name: "Фильтр масляный",
    qty: 5,
    min_qty: 2,
    cell: "A1",
    purchase_price: "400.00",
    markup: "30.00",
    sale_price: "520.00",
    status: "ok",
    ...over,
  };
}

function list(items: StockItem[]): StockItemList {
  return {
    items,
    counts: { all: items.length, low: 1, out: 0 },
  };
}

it("renders rows with statuses and counts", async () => {
  mockApi({
    "GET /api/stock/items": () =>
      list([item(1), item(2, { qty: 1, status: "low" })]),
  });
  renderWithProviders(<StockTable selectedId={null} onSelect={() => {}} />);
  expect(await screen.findByText("OC-1")).toBeInTheDocument();
  expect(screen.getByText("в наличии")).toBeInTheDocument();
  expect(screen.getByText("мало")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Мало · 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Все · 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("requests status=low on pill click", async () => {
  const urls: string[] = [];
  mockApi({
    "GET /api/stock/items": (_i, url) => {
      urls.push(url.search);
      return list([item(1)]);
    },
  });
  renderWithProviders(<StockTable selectedId={null} onSelect={() => {}} />);
  await screen.findByText("OC-1");
  fireEvent.click(screen.getByRole("button", { name: "Мало · 1" }));
  await waitFor(() => {
    expect(urls.some((u) => u.includes("status=low"))).toBe(true);
  });
});

it("sends q after debounce", async () => {
  const urls: string[] = [];
  mockApi({
    "GET /api/stock/items": (_i, url) => {
      urls.push(url.search);
      return list([item(1)]);
    },
  });
  renderWithProviders(<StockTable selectedId={null} onSelect={() => {}} />);
  await screen.findByText("OC-1");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "man" } });
  await new Promise((r) => setTimeout(r, 100));
  expect(urls.some((u) => u.includes("q=man"))).toBe(false);
  await waitFor(() => {
    expect(urls.some((u) => u.includes("q=man"))).toBe(true);
  });
});

it("calls onSelect on row click and marks selected", async () => {
  const onSelect = vi.fn();
  mockApi({ "GET /api/stock/items": () => list([item(1), item(2)]) });
  renderWithProviders(<StockTable selectedId={2} onSelect={onSelect} />);
  fireEvent.click(await screen.findByText("OC-1"));
  expect(onSelect).toHaveBeenCalledWith(1);
  expect(screen.getByText("OC-2").closest("tr")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

it("shows empty stock text", async () => {
  mockApi({ "GET /api/stock/items": () => list([]) });
  renderWithProviders(<StockTable selectedId={null} onSelect={() => {}} />);
  expect(
    await screen.findByText(
      "На складе пока ничего нет — оформите первый приход",
    ),
  ).toBeInTheDocument();
});

it("shows nothing-found text when searching", async () => {
  mockApi({
    "GET /api/stock/items": (_i, url) =>
      url.searchParams.get("q") ? list([]) : list([item(1)]),
  });
  renderWithProviders(<StockTable selectedId={null} onSelect={() => {}} />);
  await screen.findByText("OC-1");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
  expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
});
