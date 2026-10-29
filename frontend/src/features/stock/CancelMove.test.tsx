import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockItemDetail, StockMove } from "@/api/stock";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CancelMove } from "./CancelMove";

const ITEM: StockItemDetail = {
  id: 3,
  number_raw: "W 68/3",
  number_norm: "W683",
  brand: "MANN-FILTER",
  name: "Фильтр масляный",
  qty: 3,
  min_qty: 1,
  cell: "A-12",
  purchase_price: "412.00",
  markup: "30.00",
  sale_price: "540.00",
  status: "ok",
  last_receipt_at: null,
  last_receipt_supplier: null,
  last_sale_at: null,
  sold_30d: 0,
};

const MOVE = {
  id: 9,
  type: "sale",
  qty_delta: -2,
  qty_after: 3,
  cancellable: true,
} as StockMove;

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

describe("CancelMove", () => {
  it("asks for confirmation with the resulting stock", () => {
    renderWithProviders(
      <CancelMove move={MOVE} item={ITEM} onDone={() => undefined} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    expect(
      screen.getByText("Отменить продажу 2 шт? Остаток станет 5"),
    ).toBeInTheDocument();
  });

  it("does not bubble the click to the row", () => {
    const onRow = vi.fn();
    renderWithProviders(
      <div onClick={onRow}>
        <CancelMove move={MOVE} item={ITEM} onDone={() => undefined} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it("keeps dialog clicks out of the parent row", () => {
    const onRow = vi.fn();
    renderWithProviders(
      <div onClick={onRow}>
        <CancelMove move={MOVE} item={ITEM} onDone={() => undefined} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it("posts once on a double click and reports the new stock", async () => {
    let calls = 0;
    mockApi({
      "POST /api/stock/moves/9/cancel": () => {
        calls += 1;
        return new Response(
          JSON.stringify({ item: { ...ITEM, qty: 5 }, move: {} }),
          { status: 201 },
        );
      },
    });
    const onDone = vi.fn();
    renderWithProviders(<CancelMove move={MOVE} item={ITEM} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Отменить" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith("✓ Отменено → остаток 5");
    });
    expect(calls).toBe(1);
  });

  it("shows the server error inside the dialog", async () => {
    mockApi({
      "POST /api/stock/moves/9/cancel": () =>
        new Response(
          JSON.stringify({ message: "Это уже не последняя операция" }),
          {
            status: 409,
          },
        ),
    });
    const onDone = vi.fn();
    renderWithProviders(<CancelMove move={MOVE} item={ITEM} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Отменить" }));
    expect(
      await within(dialog).findByText("Это уже не последняя операция"),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
