import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SettlementDocument } from "@/api/settlements";

import { DocumentsTable } from "./DocumentsTable";

const payment: SettlementDocument = {
  date: "2026-10-20T09:15:28Z",
  name: "Оплата картой ТЕСТ0001",
  amount: "0.00",
  balance: "67.54",
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
  balance: "-1132.46",
  payer: "ИП Тестов",
  status: "Оплачено",
  order_id: 100000001,
  days_remaining: null,
  items: [
    { name: "HCZB-003 Клапан впускной PARTS-MALL", count: 4, price: "213.00" },
    { name: "PGB-N016 Прокладка PARTS-MALL", count: 1, price: "339.00" },
  ],
};

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

function cells(r: HTMLElement): (string | null)[] {
  return within(r)
    .getAllByRole("cell")
    .map((c) => c.textContent);
}

describe("DocumentsTable", () => {
  it("has the Rossko columns", () => {
    render(<DocumentsTable documents={[payment]} paid={[null]} />);
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual([
      "Дата",
      "Операция",
      "Оплачено",
      "Отгружено",
      "Статус оплаты",
      "Баланс, ₽",
      "",
    ]);
  });

  it("puts a payment into «Оплачено» and a sale into «Отгружено»", () => {
    render(
      <DocumentsTable documents={[payment, sale]} paid={["1200.00", null]} />,
    );
    const p = cells(row("Оплата картой ТЕСТ0001"));
    expect(p.slice(2, 6)).toEqual(["1 200,00", "", "Проведено", "67,54"]);
    const s = cells(row("Реализация товаров ТЕСТ0002"));
    expect(s.slice(2, 6)).toEqual(["", "1 191,00", "Оплачено", "−1 132,46"]);
  });

  it("expands a sale by clicking the row and shows items with a total", () => {
    render(<DocumentsTable documents={[sale]} paid={[null]} />);
    expect(screen.queryByRole("table", { name: "Товары" })).toBeNull();
    fireEvent.click(row("Реализация товаров ТЕСТ0002"));
    const items = screen.getByRole("table", { name: "Товары" });
    expect(
      within(items)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Наименование", "Заказано", "Сумма, ₽"]);
    expect(
      cells(
        within(items)
          .getByText("HCZB-003 Клапан впускной PARTS-MALL")
          .closest("tr") as HTMLElement,
      ),
    ).toEqual(["HCZB-003 Клапан впускной PARTS-MALL", "4 шт.", "852,00"]);
    expect(
      cells(within(items).getByText("ИТОГО:").closest("tr") as HTMLElement),
    ).toEqual(["ИТОГО:", "5 шт.", "1 191,00"]);
    expect(screen.getByRole("button", { name: "Товары" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("has no expander for a document without items", () => {
    render(<DocumentsTable documents={[payment]} paid={[null]} />);
    expect(screen.queryByRole("button", { name: "Товары" })).toBeNull();
  });

  it("sums negative item prices of a return correctly", () => {
    const ret: SettlementDocument = {
      ...sale,
      name: "Возврат ТЕСТ0003",
      items: [{ name: "Фильтр", count: 2, price: "-5.50" }],
    };
    render(<DocumentsTable documents={[ret]} paid={[null]} />);
    fireEvent.click(row("Возврат ТЕСТ0003"));
    const items = screen.getByRole("table", { name: "Товары" });
    expect(
      cells(within(items).getByText("Фильтр").closest("tr") as HTMLElement),
    ).toEqual(["Фильтр", "2 шт.", "−11,00"]);
    expect(
      cells(within(items).getByText("ИТОГО:").closest("tr") as HTMLElement),
    ).toEqual(["ИТОГО:", "2 шт.", "−11,00"]);
  });
});
