import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import type { PartGroup } from "@/api/search";
import { offer, partGroup, supplierResult } from "@/test/searchFixtures";

import { mergeGroups } from "./derive";
import { PartRow } from "./PartRow";

const now = new Date(2026, 9, 21, 10, 0);
const today = (h: number) => new Date(2026, 9, 21, h, 0).toISOString();
const address = "г. Грозный, Старопромысловское шоссе, 21А, лит.Б4";

const group = partGroup({
  offers: [
    offer({
      warehouse: address,
      qty: 20,
      delivery_from: today(17),
      delivery_to: today(20),
      purchase_price: "2449.85",
      price: "2940.00",
    }),
    offer({
      warehouse: "Партнерский склад",
      qty: 5,
      delivery_days: 3,
      purchase_price: "2500.00",
      price: "3000.00",
    }),
    offer({ qty: 7, delivery_days: 6, purchase_price: "2600.00" }),
  ],
});

const merged = (g: PartGroup) =>
  mergeGroups([supplierResult({ groups: [g] })])[0];

function renderRow(
  props: Partial<Parameters<typeof PartRow>[0]> & { part?: PartGroup } = {},
) {
  const { part = group, ...rest } = props;
  mockApi({ "GET /api/cart": () => ({ items: [], total: "0.00" }) });
  return renderWithProviders(
    <ul>
      <PartRow
        group={merged(part)}
        stockQty={undefined}
        now={now}
        onToStock={vi.fn()}
        {...rest}
      />
    </ul>,
  );
}

describe("PartRow", () => {
  it("shows the part with its best offer only", () => {
    renderRow();
    const row = within(screen.getAllByRole("listitem")[0]);
    expect(row.getByText("KYB")).toBeInTheDocument();
    expect(row.getByText("333114")).toHaveClass("font-mono");
    expect(row.getByText("Стойка амортизационная")).toBeInTheDocument();
    expect(row.getByText("сегодня 17:00–20:00")).toBeInTheDocument();
    expect(row.getByText(address)).toBeInTheDocument();
    expect(row.getByText("20 шт")).toBeInTheDocument();
    expect(row.getByText("2 449,85 ₽")).toBeInTheDocument();
    expect(screen.queryByText("2 500 ₽")).not.toBeInTheDocument();
    expect(screen.queryByText(/2 940/)).not.toBeInTheDocument();
    expect(screen.queryByText("аналог")).not.toBeInTheDocument();
    expect(screen.queryByText(/по \d+ шт/)).not.toBeInTheDocument();
    expect(screen.queryByText("обычное")).not.toBeInTheDocument();
  });

  it("expands the other warehouses and hides them again", () => {
    renderRow();
    const more = screen.getByRole("button", { name: "Другие склады: 2" });
    expect(more).toHaveTextContent("показать др. склады (2)");
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(more).toHaveTextContent("скрыть");
    const others = within(
      screen.getByRole("list", { name: "Другие склады" }),
    ).getAllByRole("listitem");
    expect(others).toHaveLength(2);
    expect(others[0]).toHaveTextContent("склад партнёра");
    expect(others[0]).toHaveTextContent("2 500 ₽");
    expect(others[0]).not.toHaveTextContent("KYB");
    expect(others[1]).toHaveTextContent("2 600 ₽");
    fireEvent.click(more);
    expect(
      screen.queryByRole("list", { name: "Другие склады" }),
    ).not.toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveTextContent("показать др. склады (2)");
  });

  it("marks analogs and my stock", () => {
    renderRow({
      part: partGroup({ is_requested: false }),
      stockQty: 3,
    });
    expect(screen.getByText("аналог")).toBeInTheDocument();
    expect(screen.getByText("у вас 3 шт")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Другие склады/ }),
    ).not.toBeInTheDocument();
  });

  it("notes multiplicity and an unusual offer type", () => {
    renderRow({
      part: partGroup({
        offers: [offer({ multiplicity: 4, kind: "sale", kind_code: "1" })],
      }),
    });
    expect(screen.getByText("по 4 шт")).toBeInTheDocument();
    expect(screen.getByText("распродажа")).toBeInTheDocument();
  });

  it("offers cart actions for the best offer and each other warehouse", () => {
    renderRow();
    expect(screen.getAllByRole("button", { name: "В корзину" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "Другие склады: 2" }));
    expect(screen.getAllByRole("button", { name: "В корзину" })).toHaveLength(
      3,
    );
  });

  it("heads the offers with the supplier, count and lowest price", () => {
    renderRow();
    expect(
      screen.getByText("Росско · 3 склада · от 2 449,85 ₽"),
    ).toBeInTheDocument();
  });

  it("says when a part is not in stock", () => {
    renderRow({ part: partGroup({ offers: [] }) });
    expect(screen.getByText("KYB")).toBeInTheDocument();
    expect(screen.getByText("Росско · нет в наличии")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "В корзину" }),
    ).not.toBeInTheDocument();
  });

  it("shows an order offer and a delivery variants offer", () => {
    renderRow({
      part: partGroup({
        offers: [
          offer({
            warehouse: "Склад №1004",
            kind: "order",
            qty: 0,
            delivery_days: 3,
            purchase_price: "557.28",
          }),
          offer({
            warehouse: "",
            kind: "variants",
            qty: 0,
            purchase_price: "504.00",
          }),
        ],
      }),
    });
    expect(screen.getByText("Склад №1004")).toBeInTheDocument();
    expect(screen.getByText("под заказ")).toBeInTheDocument();
    expect(screen.getByText("3 дн.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Другие склады: 1" }));
    expect(screen.getByText("от 504 ₽")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "варианты поставки ▾" }),
    ).toBeDisabled();
  });
});
