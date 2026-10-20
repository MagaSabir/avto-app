import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { ItemPanel } from "./ItemPanel";

const DETAIL = {
  id: 3,
  number_raw: "W 68/3",
  number_norm: "W683",
  brand: "MANN-FILTER",
  name: "Фильтр масляный",
  qty: 7,
  min_qty: 1,
  cell: "A-12",
  purchase_price: "412.00",
  markup: "30.00",
  sale_price: "540.00",
  status: "ok",
  last_receipt_at: "2026-10-15T09:30:00Z",
  last_receipt_supplier: "Росско",
  last_sale_at: null,
  sold_30d: 4,
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

describe("ItemPanel", () => {
  it("shows a hint without an item", () => {
    renderWithProviders(<ItemPanel itemId={null} />);
    expect(screen.getByText("Выберите позицию в таблице")).toBeInTheDocument();
  });

  it("shows the item summary", async () => {
    mockApi({
      "GET /api/stock/items/3": () => DETAIL,
      "GET /api/stock/items/3/moves": () => [],
    });
    renderWithProviders(<ItemPanel itemId={3} />);
    expect(await screen.findByText("W 68/3")).toBeInTheDocument();
    expect(screen.getByText("в наличии")).toBeInTheDocument();
    expect(screen.getByText("7 шт")).toBeInTheDocument();
    expect(screen.getByText("мин. 1")).toBeInTheDocument();
    expect(screen.getByText("540 ₽")).toBeInTheDocument();
    expect(screen.getByText("нац. 30%")).toBeInTheDocument();
    expect(screen.getByText(/15\.10\.2026 · Росско/)).toBeInTheDocument();
    expect(screen.getByText(/Продано за 30 дн/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продать" })).toBeInTheDocument();
  });

  it("opens the full history dialog", async () => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    mockApi({
      "GET /api/stock/items/3": () => DETAIL,
      "GET /api/stock/items/3/moves": () => [
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
      ],
    });
    renderWithProviders(<ItemPanel itemId={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Вся история" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("История: W 68/3 · MANN-FILTER"),
    ).toBeVisible();
    expect(within(dialog).getByText("Остаток")).toBeVisible();
  });

  it("opens operation details from a panel history row", async () => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    mockApi({
      "GET /api/stock/items/3": () => DETAIL,
      "GET /api/stock/items/3/moves": () => [
        {
          id: 1,
          type: "writeoff",
          qty_delta: -1,
          qty_after: 6,
          price: null,
          supplier: null,
          comment: "полный комментарий",
          created_at: "2026-10-15T09:30:00Z",
        },
      ],
    });
    renderWithProviders(<ItemPanel itemId={3} />);
    fireEvent.click((await screen.findAllByText("−1"))[0]);
    expect(await screen.findByText("Остаток после")).toBeVisible();
    expect(
      screen
        .getAllByText("полный комментарий")
        .some((el) => el.className.includes("whitespace-pre-wrap")),
    ).toBe(true);
  });
});
