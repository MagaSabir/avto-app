import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup } from "@/test/searchFixtures";

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
        group={partGroup({ offers: [a, b] })}
        offers={[a, b]}
        current={a}
        onSelect={onSelect}
        now={now}
      />,
      { route: "/" },
    );
    const toggle = screen.getByRole("button", { name: "и ещё 1 склад ▾" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
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
        group={partGroup({ offers: [row] })}
        offers={[row]}
        current={row}
        onSelect={vi.fn()}
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
});
