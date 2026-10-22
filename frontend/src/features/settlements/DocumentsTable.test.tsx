import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SettlementDocument } from "@/api/settlements";

import { DocumentsTable } from "./DocumentsTable";

const payment: SettlementDocument = {
  date: "2026-10-20T09:15:28Z",
  name: "Оплата картой ТЕСТ0001",
  amount: "0.00",
  balance: "-1250.40",
  payer: "ИП Тестов",
  status: "Проведено",
  order_id: null,
  days_remaining: null,
  items: [],
};

const sale: SettlementDocument = {
  date: "2026-10-19T03:41:05Z",
  name: "Реализация товаров ТЕСТ0002",
  amount: "1191.00",
  balance: "-2450.40",
  payer: "ИП Тестов",
  status: "Не оплачено",
  order_id: 100000001,
  days_remaining: 11,
  items: [
    {
      name: "W 68/3 Фильтр масляный MANN-FILTER",
      count: 2,
      price: "412.00",
    },
  ],
};

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

describe("DocumentsTable", () => {
  it("leaves the amount empty for a payment but shows the balance after", () => {
    render(<DocumentsTable documents={[payment]} />);
    const cells = within(row("Оплата картой ТЕСТ0001")).getAllByRole("cell");
    const texts = cells.map((c) => c.textContent);
    expect(texts).toContain("−1 250,40 ₽");
    expect(texts).not.toContain("0,00 ₽");
    expect(
      within(row("Оплата картой ТЕСТ0001")).queryByRole("button"),
    ).toBeNull();
  });

  it("shows order number and expands the sold items", () => {
    render(<DocumentsTable documents={[sale]} />);
    const r = row("Реализация товаров ТЕСТ0002");
    expect(r).toHaveTextContent("100000001");
    expect(r).toHaveTextContent(/1\s191,00 ₽/);
    expect(
      screen.queryByText("W 68/3 Фильтр масляный MANN-FILTER"),
    ).not.toBeInTheDocument();
    fireEvent.click(within(r).getByRole("button", { name: "Товары: 1" }));
    const item = row("W 68/3 Фильтр масляный MANN-FILTER");
    expect(item).toHaveTextContent("2");
    expect(item).toHaveTextContent("412,00 ₽");
  });

  it("lists sold items under their own headers, not the document columns", () => {
    render(<DocumentsTable documents={[sale]} />);
    fireEvent.click(screen.getByRole("button", { name: "Товары: 1" }));
    const items = screen.getByRole("table", { name: "Товары" });
    expect(
      within(items)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Товар", "Кол-во", "Цена"]);
    const cells = within(items)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells).toEqual([
      "W 68/3 Фильтр масляный MANN-FILTER",
      "2",
      "412,00 ₽",
    ]);
  });
});
