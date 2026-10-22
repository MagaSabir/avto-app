import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDocDate } from "@/features/settlements/format";
import { order, part } from "@/test/ordersFixtures";

import { OrderCard } from "./OrderCard";

describe("OrderCard", () => {
  it("shows the header in columns", () => {
    const o = order();
    render(<OrderCard order={o} />);
    expect(screen.getByText("№ 100000001")).toBeInTheDocument();
    expect(screen.getByText("Заказано:")).toBeInTheDocument();
    expect(screen.getByText(formatDocDate(o.created_at))).toBeInTheDocument();
    expect(screen.getByText("Курьерская доставка:")).toBeInTheDocument();
    expect(
      screen.getByText("село Тестовое, ул. Примерная, 19 окт 2026"),
    ).toBeInTheDocument();
    expect(screen.getByText("Со склада:")).toBeInTheDocument();
    const stock = screen.getByText("г. Тестовый, ул. Складская, 1");
    expect(stock).toHaveAttribute("title", "г. Тестовый, ул. Складская, 1");
    expect(screen.getByText("Оплата:")).toBeInTheDocument();
    const pay = screen.getByText("Оплата наличными при получении товара");
    expect(pay).toHaveAttribute(
      "title",
      "Оплата наличными при получении товара",
    );
    expect(screen.getAllByText("1 191,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Тестовый комментарий")).toBeInTheDocument();
  });

  it("shows pickup without address as the date only", () => {
    render(
      <OrderCard
        order={order({
          delivery_type: "Самовывоз",
          delivery_address: null,
          delivery_date: "2026-09-26",
        })}
      />,
    );
    expect(screen.getByText("Самовывоз:")).toBeInTheDocument();
    expect(screen.getByText("26 сен 2026")).toBeInTheDocument();
  });

  it("is expanded by default", () => {
    render(<OrderCard order={order()} />);
    const btn = screen.getByRole("button", { name: "Свернуть заказ" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("ИТОГО:")).toBeInTheDocument();
  });

  it("collapses and expands with the button", () => {
    render(<OrderCard order={order()} />);
    fireEvent.click(screen.getByRole("button", { name: "Свернуть заказ" }));
    const btn = screen.getByRole("button", { name: "Развернуть заказ" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ИТОГО:")).not.toBeInTheDocument();
    expect(screen.queryByText("Клапан впускной")).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText("ИТОГО:")).toBeInTheDocument();
    expect(screen.getByText("Клапан впускной")).toBeInTheDocument();
  });

  it("toggles on a click anywhere in the header", () => {
    render(<OrderCard order={order()} />);
    fireEvent.click(screen.getByText("№ 100000001"));
    expect(screen.queryByText("ИТОГО:")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("№ 100000001"));
    expect(screen.getByText("ИТОГО:")).toBeInTheDocument();
  });

  it("shows a part row", () => {
    render(<OrderCard order={order()} />);
    const brand = screen.getByText("PARTS-MALL");
    expect(brand.closest(".font-mono")).not.toBeNull();
    expect(
      brand.compareDocumentPosition(screen.getByText("Клапан впускной")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("HCZB-003").closest(".font-mono")).not.toBeNull();
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
