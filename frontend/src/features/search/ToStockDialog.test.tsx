import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStockSearch } from "@/api/search";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup } from "@/test/searchFixtures";

import { ToStockDialog } from "./ToStockDialog";

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

function Probe() {
  useStockSearch("333114");
  return null;
}

describe("ToStockDialog", () => {
  it("opens prefilled, then closes and refreshes stock search after receipt", async () => {
    let searches = 0;
    mockApi({
      "GET /api/search": () => {
        searches += 1;
        return { items: [] };
      },
      "GET /api/stock/lookup": () => [],
      "GET /api/stock/brands": () => ["KYB"],
      "GET /api/stock/suppliers": () => ["Росско"],
      "GET /api/settings": () => ({ default_markup: "25.00" }),
      "POST /api/stock/receipts": () =>
        new Response(
          JSON.stringify({
            item: {
              id: 1,
              number_raw: "333114",
              brand: "KYB",
              qty: 2,
            },
            move: {},
          }),
          { status: 201 },
        ),
    });
    const onClose = vi.fn();
    renderWithProviders(
      <>
        <Probe />
        <ToStockDialog
          supplierTitle="Росско"
          target={{ group: partGroup(), offer: offer() }}
          onClose={onClose}
        />
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Принять на склад" }),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Номер").value).toBe(
      "333114",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Закупка").value).toBe(
      "2449.85",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Поставщик").value).toBe(
      "Росско",
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Кол-во"));
    await waitFor(() => {
      expect(searches).toBe(1);
    });
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>("Наценка, %").value).toBe(
        "25",
      );
    });
    fireEvent.change(screen.getByLabelText("Кол-во"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Принять" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(searches).toBe(2);
    });
  });
});
