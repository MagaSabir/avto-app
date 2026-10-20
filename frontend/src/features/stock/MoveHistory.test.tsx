import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    expect(screen.getByText(/было 7, факт 6/)).toBeInTheDocument();
    expect(screen.getByText(/пересчёт/)).toBeInTheDocument();
    expect(screen.getByText("−1")).toBeInTheDocument();
  });

  it("shows a receipt with supplier and a positive delta", () => {
    render(<MoveHistory moves={[base]} />);
    expect(screen.getByText("Приход")).toBeInTheDocument();
    expect(screen.getByText("Росско")).toBeInTheDocument();
    const delta = screen.getByText("+4");
    expect(delta).toHaveClass("text-status-ok");
  });

  it("shows an empty state", () => {
    render(<MoveHistory moves={[]} />);
    expect(screen.getByText("Движений пока нет")).toBeInTheDocument();
  });
});
