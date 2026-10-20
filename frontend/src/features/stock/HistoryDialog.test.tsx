import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockMove } from "@/api/stock";

import { HistoryDialog } from "./HistoryDialog";

const MOVES: StockMove[] = [
  {
    id: 1,
    type: "receipt",
    qty_delta: 4,
    qty_after: 7,
    price: "412.00",
    supplier: "Росско",
    comment: null,
    created_at: "2026-10-15T09:30:00Z",
  },
  {
    id: 2,
    type: "sale",
    qty_delta: -2,
    qty_after: 5,
    price: "540.00",
    supplier: null,
    comment: null,
    created_at: "2026-10-16T09:30:00Z",
  },
];

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HistoryDialog", () => {
  it("renders rows with the balance column", () => {
    render(
      <HistoryDialog
        open
        onClose={() => undefined}
        moves={MOVES}
        title="История: W 68/3 · MANN-FILTER"
      />,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(
      screen.getByText("История: W 68/3 · MANN-FILTER"),
    ).toBeInTheDocument();
    expect(screen.getByText("Остаток")).toBeInTheDocument();
    expect(screen.getByText("Приход")).toBeInTheDocument();
    expect(screen.getByText("Продажа")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(screen.getByText("−2")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<HistoryDialog open onClose={onClose} moves={MOVES} title="T" />);
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalled();
  });
});
