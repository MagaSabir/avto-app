import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockMove } from "@/api/stock";

import { MoveDetailDialog } from "./MoveDetailDialog";

const MOVE: StockMove = {
  id: 1,
  type: "writeoff",
  qty_delta: -2,
  qty_after: 5,
  price: null,
  supplier: null,
  comment: "первая строка\nвторая строка",
  cost: null,
  payment: null,
  user: null,
  cancels_move_id: null,
  cancelled: false,
  cancellable: false,
  created_at: "2026-10-15T09:30:00Z",
};

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
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

describe("MoveDetailDialog", () => {
  it("shows badge, balance and the full multi-line comment", () => {
    render(<MoveDetailDialog move={MOVE} onClose={() => undefined} />);
    expect(screen.getByText("Списание")).toBeInTheDocument();
    expect(screen.getByText("Остаток после")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("−2")).toBeInTheDocument();
    const comment = screen.getByText(/первая строка/);
    expect(comment.textContent).toBe("первая строка\nвторая строка");
    expect(comment).toHaveClass("whitespace-pre-wrap");
    expect(screen.getByText("Цена").nextSibling).toHaveTextContent("0 ₽");
  });

  it("shows was/actual for an adjustment", () => {
    render(
      <MoveDetailDialog
        move={{
          ...MOVE,
          type: "adjustment",
          qty_delta: -1,
          qty_after: 4,
          comment: null,
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("было 5, факт 4")).toBeInTheDocument();
    expect(screen.getByText("Комментарий").nextSibling).toHaveTextContent("—");
  });

  it("shows supplier for a receipt", () => {
    render(
      <MoveDetailDialog
        move={{
          ...MOVE,
          type: "receipt",
          qty_delta: 4,
          price: "412.00",
          supplier: "Росско",
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Поставщик")).toBeInTheDocument();
    expect(screen.getByText("Росско")).toBeInTheDocument();
    expect(screen.getByText("412,00 ₽")).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<MoveDetailDialog move={MOVE} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows payment, cost, profit and author of a sale", () => {
    render(
      <MoveDetailDialog
        move={{
          ...MOVE,
          type: "sale",
          price: "540.00",
          cost: "412.00",
          payment: "cash",
          user: "ivan",
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Оплата").nextSibling).toHaveTextContent("Нал");
    expect(screen.getByText("Закупка").nextSibling).toHaveTextContent("412 ₽");
    expect(screen.getByText("Прибыль").nextSibling).toHaveTextContent("256 ₽");
    expect(screen.getByText("Кто").nextSibling).toHaveTextContent("ivan");
  });

  it("shows a loss with a minus sign", () => {
    render(
      <MoveDetailDialog
        move={{ ...MOVE, type: "sale", price: "400.00", cost: "412.50" }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Прибыль").nextSibling).toHaveTextContent("-25 ₽");
  });

  it("handles an old sale without cost, payment and author", () => {
    render(
      <MoveDetailDialog
        move={{ ...MOVE, type: "sale", price: "540.00" }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Закупка").nextSibling).toHaveTextContent(
      "закупка неизвестна",
    );
    expect(screen.queryByText("Прибыль")).not.toBeInTheDocument();
    expect(screen.getByText("Оплата").nextSibling).toHaveTextContent("—");
    expect(screen.getByText("Кто").nextSibling).toHaveTextContent("—");
  });

  it("shows a negative profit for a return", () => {
    render(
      <MoveDetailDialog
        move={{
          ...MOVE,
          type: "return",
          qty_delta: 2,
          price: "540.00",
          cost: "412.00",
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Прибыль").nextSibling).toHaveTextContent("-256 ₽");
  });

  it("shows a kopeck loss", () => {
    render(
      <MoveDetailDialog
        move={{
          ...MOVE,
          type: "sale",
          qty_delta: -3,
          price: "99.50",
          cost: "100.00",
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Прибыль").nextSibling).toHaveTextContent(
      "-1,50 ₽",
    );
  });

  it("links the customer with the car", () => {
    render(
      <MemoryRouter>
        <MoveDetailDialog
          move={{
            ...MOVE,
            type: "sale",
            customer: { id: 5, name: "Иван Тест" },
            car: { id: 9, make: "Lada", model: "Vesta", plate: "A000AA" },
          }}
          onClose={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Клиент")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Иван Тест · Lada Vesta A000AA",
    });
    expect(link).toHaveAttribute("href", "/customers/5");
  });

  it("omits the car part when there is no car", () => {
    render(
      <MemoryRouter>
        <MoveDetailDialog
          move={{
            ...MOVE,
            type: "return",
            customer: { id: 5, name: "Иван Тест" },
            car: null,
          }}
          onClose={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Иван Тест" })).toHaveAttribute(
      "href",
      "/customers/5",
    );
  });

  it("has no customer row without a customer", () => {
    render(
      <MoveDetailDialog
        move={{ ...MOVE, type: "sale", customer: null }}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText("Клиент")).not.toBeInTheDocument();
  });
});
