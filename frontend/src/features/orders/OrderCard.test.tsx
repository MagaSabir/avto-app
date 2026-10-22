import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDocDate } from "@/features/settlements/format";
import { order, part } from "@/test/ordersFixtures";

import { OrderCard } from "./OrderCard";

describe("OrderCard", () => {
  it("shows the header", () => {
    const o = order();
    render(<OrderCard order={o} />);
    expect(screen.getByText("№ 100000001")).toBeInTheDocument();
    expect(
      screen.getByText(`Заказано: ${formatDocDate(o.created_at)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Курьерская доставка: село Тестовое, ул. Примерная, 19 окт 2026",
      ),
    ).toBeInTheDocument();
    const stock = screen.getByText("Со склада: г. Тестовый, ул. Складская, 1");
    expect(stock).toHaveAttribute("title", "г. Тестовый, ул. Складская, 1");
    const pay = screen.getByText(
      "Оплата: Оплата наличными при получении товара",
    );
    expect(pay).toHaveAttribute(
      "title",
      "Оплата наличными при получении товара",
    );
    expect(screen.getAllByText("1 191,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Тестовый комментарий")).toBeInTheDocument();
  });

  it("shows a part row", () => {
    render(<OrderCard order={order()} />);
    expect(screen.getByText("PARTS-MALL")).toBeInTheDocument();
    expect(screen.getByText("HCZB-003").className).toContain("font-mono");
    expect(screen.getByText("Клапан впускной")).toBeInTheDocument();
    expect(screen.getByText("Позвонить")).toBeInTheDocument();
    expect(screen.getAllByText("1 дн.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Передан покупателю").length).toBeGreaterThan(0);
    expect(screen.getByText("213,00")).toBeInTheDocument();
    expect(screen.getAllByText("4 шт.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("852,00").length).toBeGreaterThan(0);
  });

  it("shows a dash without delivery days", () => {
    render(
      <OrderCard order={order({ parts: [part({ delivery_days: null })] })} />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows totals", () => {
    const o = order({
      parts: [part(), part({ guid: "g2", count: 1, price: "339.00" })],
    });
    render(<OrderCard order={o} />);
    const footer = screen.getByText("ИТОГО:").parentElement as HTMLElement;
    expect(within(footer).getByText("5 шт.")).toBeInTheDocument();
    expect(within(footer).getByText("1 191,00")).toBeInTheDocument();
  });

  it.each([
    [7, "text-status-out"],
    [6, "text-status-ok"],
    [0, "text-status-low"],
    [2, "text-muted-foreground"],
  ])("badge for code %i has %s", (code, cls) => {
    render(
      <OrderCard order={order({ parts: [part({ status_code: code })] })} />,
    );
    const badge = screen.getAllByTestId("part-status")[0];
    expect(badge.className).toContain(cls);
  });
});
