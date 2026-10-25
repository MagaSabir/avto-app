import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer } from "@/test/searchFixtures";

import { WarehousePicker } from "./WarehousePicker";

const now = new Date(2026, 9, 24, 9, 0);

describe("WarehousePicker", () => {
  it("lists the offers as keyboard-reachable options", () => {
    mockApi({});
    const a = offer({ warehouse: "Москва", stock_id: "a" });
    const b = offer({ warehouse: "Партнерский склад", stock_id: "b" });
    const onSelect = vi.fn();
    renderWithProviders(
      <WarehousePicker
        supplier="rossko"
        offers={[a, b]}
        current={a}
        onSelect={onSelect}
        onReset={vi.fn()}
        now={now}
      />,
      { route: "/" },
    );
    const toggle = screen.getByRole("button", { name: "и ещё 1 склад ▾" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute(
      "aria-controls",
      screen.getByRole("listbox").id,
    );
    const option = screen.getByRole("option", { name: /склад партнёра/ });
    option.focus();
    expect(option).toHaveFocus();
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(b);
  });

  it("shows the supplier error for variants", async () => {
    const row = offer({
      kind: "variants",
      warehouse: "Варианты поставки",
      stock_id: "",
      order_code: "x1",
    });
    mockApi({
      "GET /api/search/suppliers/mikado/variants": () => ({
        code: "mikado",
        title: "Микадо",
        status: "error",
        message: "Лимит запросов",
        markup: "20.00",
        offers: [],
      }),
    });
    renderWithProviders(
      <WarehousePicker
        supplier="mikado"
        offers={[row]}
        current={row}
        onSelect={vi.fn()}
        onReset={vi.fn()}
        now={now}
      />,
      { route: "/" },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "варианты поставки ▾" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Лимит запросов",
    );
  });

  it("marks only the chosen one of variants sharing a stock id", async () => {
    const row = offer({
      kind: "variants",
      warehouse: "Варианты поставки",
      stock_id: "",
      order_code: "x1",
    });
    const v = (price: string, days: string) =>
      offer({
        kind: "order",
        stock_id: "x1#1",
        warehouse: "Склад",
        delivery_from: days,
        purchase_price: price,
        order_code: "x1",
      });
    const a = v("100.00", new Date(2026, 9, 25, 10).toISOString());
    const b = v("120.00", new Date(2026, 9, 26, 10).toISOString());
    mockApi({
      "GET /api/search/suppliers/mikado/variants": () => ({
        code: "mikado",
        title: "Микадо",
        status: "ok",
        message: null,
        markup: "20.00",
        offers: [a, b],
      }),
    });
    renderWithProviders(
      <WarehousePicker
        supplier="mikado"
        offers={[row]}
        current={{ ...b }}
        onSelect={vi.fn()}
        onReset={vi.fn()}
        now={now}
      />,
      { route: "/" },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "варианты поставки ▾" }),
    );
    const [first, second] = await screen.findAllByRole("option");
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
  });
});
