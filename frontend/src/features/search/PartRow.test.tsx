import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { offer, partGroup } from "@/test/searchFixtures";

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

function renderRow(props: Partial<Parameters<typeof PartRow>[0]> = {}) {
  return render(
    <ul>
      <PartRow group={group} stockQty={undefined} now={now} {...props} />
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
    const more = screen.getByRole("button", {
      name: "показать др. склады (2)",
    });
    fireEvent.click(more);
    const others = within(
      screen.getByRole("list", { name: "Другие склады" }),
    ).getAllByRole("listitem");
    expect(others).toHaveLength(2);
    expect(others[0]).toHaveTextContent("склад партнёра");
    expect(others[0]).toHaveTextContent("2 500 ₽");
    expect(others[0]).not.toHaveTextContent("KYB");
    expect(others[1]).toHaveTextContent("2 600 ₽");
    fireEvent.click(screen.getByRole("button", { name: "скрыть" }));
    expect(
      screen.queryByRole("list", { name: "Другие склады" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "показать др. склады (2)" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("marks analogs and my stock", () => {
    renderRow({
      group: partGroup({ is_requested: false }),
      stockQty: 3,
    });
    expect(screen.getByText("аналог")).toBeInTheDocument();
    expect(screen.getByText("у вас 3 шт")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("notes multiplicity and an unusual offer type", () => {
    renderRow({
      group: partGroup({
        offers: [offer({ multiplicity: 4, kind: "sale", kind_code: "1" })],
      }),
    });
    expect(screen.getByText("по 4 шт")).toBeInTheDocument();
    expect(screen.getByText("распродажа")).toBeInTheDocument();
  });

  it("says when a part is not in stock", () => {
    renderRow({ group: partGroup({ offers: [] }) });
    expect(screen.getByText("KYB")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("нет в наличии")).toBeInTheDocument();
  });
});
