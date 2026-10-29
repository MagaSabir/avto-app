import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StockMove } from "@/api/stock";

import { MoveHistory } from "./MoveHistory";

const base: StockMove = {
  id: 1,
  type: "receipt",
  qty_delta: 4,
  qty_after: 7,
  price: "412.00",
  supplier: "Росско",
  comment: null,
  cost: null,
  payment: null,
  user: null,
  cancels_move_id: null,
  cancelled: false,
  cancellable: false,
  created_at: "2026-10-15T09:30:00Z",
};

describe("MoveHistory", () => {
  it("explains an adjustment with before and after", () => {
    render(
      <MoveHistory
        moves={[
          {
            ...base,
            type: "adjustment",
            qty_delta: -1,
            qty_after: 6,
            price: null,
            supplier: null,
            comment: "пересчёт",
          },
        ]}
      />,
    );
    expect(screen.getByText("Корректировка")).toBeInTheDocument();
    expect(screen.getByText("−1")).toBeInTheDocument();
  });

  it("shows a receipt with supplier and a positive delta", () => {
    render(<MoveHistory moves={[base]} />);
    expect(screen.getByText("Приход")).toHaveClass("bg-move-receipt-bg");
    const delta = screen.getByText("+4");
    expect(delta).not.toHaveClass("text-status-ok");
  });

  it("shows an empty state", () => {
    render(<MoveHistory moves={[]} />);
    expect(screen.getByText("Движений пока нет")).toBeInTheDocument();
  });

  it("shows 0 ₽ for a write-off and a dash for an adjustment", () => {
    render(
      <MoveHistory
        moves={[{ ...base, type: "writeoff", qty_delta: -1, price: null }]}
      />,
    );
    expect(screen.getByText("0 ₽")).toBeInTheDocument();
  });

  it("shows a dash for an adjustment price", () => {
    render(
      <MoveHistory
        moves={[{ ...base, type: "adjustment", qty_delta: -1, price: null }]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows no comment line in the panel", () => {
    render(
      <MoveHistory moves={[{ ...base, type: "writeoff", comment: "брак" }]} />,
    );
    expect(screen.queryByText("брак")).not.toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", () => {
    const onSelect = vi.fn();
    render(<MoveHistory moves={[base]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Приход"));
    expect(onSelect).toHaveBeenCalledWith(base);
  });
});
