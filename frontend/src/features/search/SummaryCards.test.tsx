import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  offer,
  partGroup,
  stockItem,
  supplierResult,
} from "@/test/searchFixtures";

import { SummaryCards } from "./SummaryCards";

const now = new Date(2026, 9, 21, 10, 0);
const opts = { showAnalogs: true, now };
const items = [
  stockItem(1),
  stockItem(2, {
    number_raw: "290 074",
    number_norm: "290074",
    brand: "SACHS",
    qty: 1,
    sale_price: "4130.00",
    cell: "A-2-5",
  }),
];
const results = [
  supplierResult({
    groups: [
      partGroup({
        offers: [
          offer({
            delivery_from: new Date(2026, 9, 21, 17, 0).toISOString(),
            delivery_to: new Date(2026, 9, 21, 20, 0).toISOString(),
          }),
          offer({ price: "3500.00", qty: 50, delivery_days: 6 }),
        ],
      }),
    ],
  }),
];

const card = (name: string) => screen.getByRole("region", { name });

describe("SummaryCards", () => {
  it("summarizes my stock and the best offers", () => {
    render(
      <SummaryCards
        items={items}
        results={results}
        pending={false}
        opts={opts}
      />,
    );
    const mine = card("Мой склад");
    expect(mine).toHaveTextContent("4 шт · 2 позиции");
    expect(mine).toHaveTextContent("от 3 190 ₽");
    expect(mine).toHaveTextContent("ячейки A-2-4, A-2-5");

    const cheap = card("Дешевле всего");
    expect(within(cheap).getByText("2 940 ₽")).toBeInTheDocument();
    expect(cheap).toHaveTextContent("KYB 333114 · Росско · 20 шт");

    const fast = card("Быстрее всего");
    expect(fast).toHaveTextContent("Сегодня 17:00–20:00");
    expect(fast).toHaveTextContent("KYB 333114 · 2 940 ₽");
  });

  it("shows loading placeholders while suppliers are pending", () => {
    render(
      <SummaryCards items={items} results={[]} pending={true} opts={opts} />,
    );
    expect(card("Дешевле всего")).toHaveAttribute("aria-busy", "true");
    expect(card("Быстрее всего")).toHaveAttribute("aria-busy", "true");
    expect(card("Мой склад")).toHaveAttribute("aria-busy", "false");
  });

  it("shows a dash on error or an empty answer", () => {
    render(
      <SummaryCards
        items={[]}
        results={[supplierResult({ groups: [partGroup({ offers: [] })] })]}
        pending={false}
        opts={opts}
      />,
    );
    expect(within(card("Дешевле всего")).getByText("—")).toBeInTheDocument();
    expect(within(card("Быстрее всего")).getByText("—")).toBeInTheDocument();
    expect(within(card("Мой склад")).getByText("—")).toBeInTheDocument();
  });

  it("shows a dash for my stock when the stock request failed", () => {
    render(
      <SummaryCards
        items={undefined}
        stockFailed={true}
        results={[]}
        pending={false}
        opts={opts}
      />,
    );
    expect(card("Мой склад")).toHaveAttribute("aria-busy", "false");
    expect(within(card("Мой склад")).getByText("—")).toBeInTheDocument();
  });
});
