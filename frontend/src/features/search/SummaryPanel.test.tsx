import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { StockSearchItem } from "@/api/search";
import { offer, partGroup, stockItem } from "@/test/searchFixtures";

import type { Best } from "./derive";
import { SummaryPanel } from "./SummaryPanel";

const now = new Date(2026, 9, 24, 9, 0);
const at = (day: number, h: number) =>
  new Date(2026, 9, day, h, 0).toISOString();

const items = [
  stockItem(5, {
    brand: "MANN",
    brand_key: "MANN",
    number_raw: "W 68/3",
    number_norm: "W683",
    qty: 14,
    cell: "B-1-3",
  }),
  stockItem(6, {
    brand: "MANN-FILTER",
    brand_key: "MANN",
    number_raw: "W68/3",
    number_norm: "W683",
    qty: 1,
    cell: "B-1-2",
  }),
  stockItem(7, {
    brand: "MGA",
    brand_key: "MGA",
    number_norm: "W683",
    qty: 4,
    cell: "C-1-1",
  }),
];

const geely = partGroup({ brand: "Geely", number: "E020800005" });
const cheap = offer({
  warehouse: "Партнерский склад",
  purchase_price: "126.00",
  delivery_from: at(31, 10),
  delivery_to: at(31, 18),
});
const big = partGroup({ brand: "BIG", number: "GB-1155" });
const fast = offer({
  warehouse: "Грозный",
  purchase_price: "165.00",
  delivery_from: at(24, 10),
  delivery_to: at(24, 18),
});
const best: { cheapest: Best | null; fastest: Best | null } = {
  cheapest: { group: geely, offer: cheap },
  fastest: { group: big, offer: fast },
};
const none = { cheapest: null, fastest: null };

function show(
  over: {
    stock?: StockSearchItem[] | undefined;
    stockError?: boolean;
    best?: typeof best;
    pending?: boolean;
  } = {},
) {
  render(
    <MemoryRouter>
      <SummaryPanel
        stock={"stock" in over ? over.stock : items}
        stockError={over.stockError ?? false}
        partKey="MANN|W683"
        best={over.best ?? best}
        pending={over.pending ?? false}
        now={now}
      />
    </MemoryRouter>,
  );
}

const block = (name: string) => screen.getByRole("region", { name });

describe("SummaryPanel", () => {
  it("sums my stock of the part across brand spellings", () => {
    show();
    const mine = block("Мой склад");
    expect(within(mine).getByText("15 шт")).toBeInTheDocument();
    expect(within(mine).getByText("B-1-3, B-1-2")).toHaveClass("font-mono");
    expect(
      within(mine).getByRole("link", { name: "Открыть на складе →" }),
    ).toHaveAttribute("href", "/stock?item=5");
  });

  it("falls back to every item with the number when no brand matches", () => {
    show({ stock: [items[2]] });
    expect(within(block("Мой склад")).getByText("4 шт")).toBeInTheDocument();
  });

  it("shows a dash without stock positions", () => {
    show({ stock: [] });
    const mine = block("Мой склад");
    expect(within(mine).getByText("—")).toBeInTheDocument();
    expect(within(mine).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says the stock is unavailable on error", () => {
    show({ stock: undefined, stockError: true });
    const mine = block("Мой склад");
    expect(mine).toHaveAttribute("aria-busy", "false");
    expect(within(mine).getByText("Склад недоступен")).toHaveClass(
      "text-destructive",
    );
  });

  it("shows the cheapest and the fastest offers", () => {
    show();
    const c = block("Дешевле всего");
    expect(within(c).getByText("126 ₽")).toBeInTheDocument();
    expect(c).toHaveTextContent(
      "Geely E020800005 · склад партнёра · 31.10 10:00–18:00",
    );
    const f = block("Быстрее всего");
    expect(within(f).getByText("сегодня 10:00–18:00")).toBeInTheDocument();
    expect(f).toHaveTextContent("165 ₽ · BIG GB-1155 · Грозный");
  });

  it("shows skeletons while the supplier answers", () => {
    show({ pending: true });
    expect(block("Дешевле всего")).toHaveAttribute("aria-busy", "true");
    expect(block("Быстрее всего")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("126 ₽")).not.toBeInTheDocument();
    expect(block("Мой склад")).toHaveAttribute("aria-busy", "false");
  });

  it("shows skeletons for my stock while it loads", () => {
    show({ stock: undefined });
    expect(block("Мой склад")).toHaveAttribute("aria-busy", "true");
  });

  it("shows dashes without best offers", () => {
    show({ best: none });
    expect(within(block("Дешевле всего")).getByText("—")).toBeInTheDocument();
    expect(within(block("Быстрее всего")).getByText("—")).toBeInTheDocument();
  });
});
