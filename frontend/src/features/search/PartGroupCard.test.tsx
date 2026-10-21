import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { offer, partGroup } from "@/test/searchFixtures";

import { PartGroupCard } from "./PartGroupCard";

const now = new Date(2026, 9, 21, 10, 0);
const today = (h: number) => new Date(2026, 9, 21, h, 0).toISOString();

const group = partGroup({
  offers: [
    offer({
      warehouse: "Краснодар",
      qty: 20,
      multiplicity: 2,
      delivery_from: today(17),
      delivery_to: today(20),
      purchase_price: "2449.85",
      price: "2940.00",
    }),
  ],
});

describe("PartGroupCard", () => {
  it("renders the header and offer columns", () => {
    render(
      <PartGroupCard
        group={group}
        supplier="Росско"
        stockQty={undefined}
        now={now}
      />,
    );
    expect(screen.getByText("искомый номер")).toBeInTheDocument();
    expect(screen.queryByText(/у вас/)).not.toBeInTheDocument();
    const t = within(screen.getByRole("table"));
    for (const h of [
      "Склад",
      "Наличие",
      "Кратн.",
      "Срок",
      "Тип",
      "Закупка",
      "Цена",
    ])
      expect(t.getByRole("columnheader", { name: h })).toBeInTheDocument();
    const cells = t
      .getAllByRole("cell")
      .map((c) => c.textContent.replace(/\s+/g, " "));
    expect(cells).toEqual([
      "Краснодар",
      "20 шт",
      "2",
      "сегодня 17:00–20:00",
      "обычное",
      "2 449,85",
      "2 940 ₽",
    ]);
  });

  it("renders compact rows for phones", () => {
    render(
      <PartGroupCard
        group={group}
        supplier="Росско"
        stockQty={undefined}
        now={now}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("2 940 ₽ · Росско");
    expect(
      within(item).getByText("20 шт · сегодня 17:00–20:00 · Краснодар"),
    ).toBeInTheDocument();
  });

  it("marks analogs and shows my stock", () => {
    render(
      <PartGroupCard
        group={partGroup({ is_requested: false })}
        supplier="Росско"
        stockQty={3}
        now={now}
      />,
    );
    expect(screen.getByText("аналог")).toBeInTheDocument();
    expect(screen.getByText("у вас 3 шт")).toBeInTheDocument();
  });

  it("labels an unknown offer type by its code", () => {
    render(
      <PartGroupCard
        group={partGroup({
          offers: [offer({ kind: "other", kind_code: "3" })],
        })}
        supplier="Росско"
        stockQty={undefined}
        now={now}
      />,
    );
    expect(
      within(screen.getByRole("table")).getByText("тип 3"),
    ).toBeInTheDocument();
  });

  it("says when a part has no offers", () => {
    render(
      <PartGroupCard
        group={partGroup({ offers: [] })}
        supplier="Росско"
        stockQty={undefined}
        now={now}
      />,
    );
    expect(screen.getByText("KYB")).toBeInTheDocument();
    expect(screen.getByText("нет предложений")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
