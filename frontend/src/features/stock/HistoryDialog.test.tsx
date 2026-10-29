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
    cost: null,
    payment: null,
    user: null,
    cancels_move_id: null,
    cancelled: false,
    cancellable: false,
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
    cost: null,
    payment: null,
    user: null,
    cancels_move_id: null,
    cancelled: false,
    cancellable: false,
    created_at: "2026-10-16T09:30:00Z",
  },
];

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

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
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
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

  it("does not close on a click inside the content", () => {
    const onClose = vi.fn();
    render(<HistoryDialog open onClose={onClose} moves={MOVES} title="T" />);
    fireEvent.click(screen.getByText("T"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the dialog backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <HistoryDialog open onClose={onClose} moves={MOVES} title="T" />,
    );
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("no dialog");
    expect(dialog).not.toHaveClass("p-4");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the header outside the scroll container", () => {
    const { container } = render(
      <HistoryDialog open onClose={() => undefined} moves={MOVES} title="T" />,
    );
    const scroll = container.querySelector("table")?.parentElement;
    expect(scroll).toHaveClass("overflow-auto");
    expect(scroll).not.toContainElement(
      screen.getByRole("button", { name: "Закрыть" }),
    );
    expect(scroll).not.toContainElement(screen.getByText("T"));
  });

  it("shows a dash for empty price and comment", () => {
    render(
      <HistoryDialog
        open
        onClose={() => undefined}
        moves={[{ ...MOVES[1], type: "writeoff", price: null }]}
        title="T"
      />,
    );
    expect(screen.getByText("0 ₽")).toBeInTheDocument();
    // price is 0 ₽; dashes are the author and the comment
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("opens the detail dialog with the full comment on a row click", () => {
    const onClose = vi.fn();
    render(
      <HistoryDialog
        open
        onClose={onClose}
        moves={[{ ...MOVES[1], comment: "длинный комментарий\nвторая строка" }]}
        title="T"
      />,
    );
    expect(screen.queryByText("Остаток после")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Продажа"));
    expect(screen.getByText("Остаток после")).toBeInTheDocument();
    expect(
      screen
        .getAllByText(/длинный комментарий/)
        .some((el) => el.className.includes("whitespace-pre-wrap")),
    ).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a fixed table layout and clamps comments", () => {
    const { container } = render(
      <HistoryDialog
        open
        onClose={() => undefined}
        moves={[{ ...MOVES[1], comment: "очень длинный" }]}
        title="T"
      />,
    );
    expect(container.querySelector("table")).toHaveClass("table-fixed");
    expect(container.querySelector("tbody .line-clamp-2")).toHaveTextContent(
      "очень длинный",
    );
  });

  it("shows the author and strikes cancelled rows", () => {
    render(
      <HistoryDialog
        open
        onClose={() => undefined}
        moves={[{ ...MOVES[1], user: "ivan", cancelled: true }]}
        title="T"
      />,
    );
    expect(screen.getByText("Кто")).toBeInTheDocument();
    expect(screen.getByText("ivan")).toBeInTheDocument();
    expect(screen.getByText("−2").closest("tr")).toHaveClass("line-through");
  });

  it("explains a cancel row with the original move", () => {
    render(
      <HistoryDialog
        open
        onClose={() => undefined}
        moves={[
          {
            ...MOVES[1],
            id: 3,
            type: "cancel",
            qty_delta: 2,
            cancels_move_id: 2,
          },
          MOVES[1],
        ]}
        title="T"
      />,
    );
    expect(screen.getByText("Отмена: продажа −2")).toBeInTheDocument();
  });
});
