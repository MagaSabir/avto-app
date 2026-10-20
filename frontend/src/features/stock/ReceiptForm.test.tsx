import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";

import { ReceiptForm } from "./ReceiptForm";

const MANN = {
  id: 1,
  number_raw: "W 68/3",
  number_norm: "W683",
  brand: "MANN-FILTER",
  name: "Фильтр масляный",
  qty: 3,
  min_qty: 2,
  cell: "A-12",
  purchase_price: "405.00",
  markup: "30.00",
  sale_price: "530.00",
  status: "ok",
};

type Handler = (init: RequestInit) => Response | object;

function handlers(lookup: object[], extra: Record<string, Handler> = {}) {
  return {
    "GET /api/stock/lookup": () => lookup,
    "GET /api/stock/brands": () => ["MANN-FILTER"],
    "GET /api/stock/suppliers": () => ["Росско"],
    "GET /api/settings": () => ({ default_markup: "25.00" }),
    ...extra,
  };
}

function created(item: object): Response {
  return new Response(JSON.stringify({ item, move: {} }), { status: 201 });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function input(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label);
}

async function fillRequired() {
  await waitFor(() => {
    expect(input("Наценка, %").value).toBe("25");
  });
  type("Номер", "W 68/3");
  type("Бренд", "MANN-FILTER");
  type("Название", "Фильтр масляный");
  type("Кол-во", "4");
  type("Закупка", "405");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReceiptForm", () => {
  it("prefills existing item", async () => {
    mockApi(handlers([MANN]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    type("Номер", "W 68/3");
    expect(
      await screen.findByText("Позиция есть на складе: данные подставлены"),
    ).toBeTruthy();
    expect(input("Бренд").value).toBe("MANN-FILTER");
    expect(input("Название").value).toBe("Фильтр масляный");
    expect(input("Ячейка").value).toBe("A-12");
    expect(input("Закупка").value).toBe("405.00");
    expect(input("Наценка, %").value).toBe("30");
    expect(input("Продажа").value).toBe("530.00");
  });

  it("new item uses default markup", async () => {
    mockApi(handlers([]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    await waitFor(() => {
      expect(input("Наценка, %").value).toBe("25");
    });
    type("Закупка", "412");
    expect(input("Продажа").value).toBe("520.00");
    expect(
      screen.getByText("412,00 + 25% = 515,00 → округлено до 520 ₽"),
    ).toBeTruthy();
  });

  it("price policy choice", async () => {
    let body: Record<string, unknown> = {};
    mockApi(
      handlers([MANN], {
        "POST /api/stock/receipts": (init) => {
          body = JSON.parse(init.body as string) as Record<string, unknown>;
          return created({ ...MANN, qty: 7 });
        },
      }),
    );
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    type("Номер", "W 68/3");
    await screen.findByText("Позиция есть на складе: данные подставлены");
    type("Кол-во", "4");
    type("Закупка", "412");
    expect(
      screen.getByLabelText<HTMLInputElement>(
        /поставить новую: 412,00 → продажа 540 ₽/,
      ).checked,
    ).toBe(true);
    fireEvent.click(
      screen.getByLabelText(/оставить старую: 405,00 → продажа 530 ₽/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Принять" }));
    await waitFor(() => {
      expect(body.price_policy).toBe("keep");
    });
    expect(body.purchase_price).toBe("412.00");
    expect(body.number).toBe("W 68/3");
  });

  it("sale below purchase warning", () => {
    mockApi(handlers([]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    type("Закупка", "412");
    type("Продажа", "300");
    expect(screen.getByText("Цена продажи ниже закупки")).toBeTruthy();
  });

  it("invalid money blocks submit", async () => {
    const post = vi.fn();
    mockApi(handlers([], { "POST /api/stock/receipts": post }));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    await fillRequired();
    type("Закупка", "abc");
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Принять",
    });
    expect(button.disabled).toBe(true);
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    expect(post).not.toHaveBeenCalled();
  });

  it("success", async () => {
    const onAccepted = vi.fn();
    mockApi(
      handlers([], {
        "POST /api/stock/receipts": () => created({ ...MANN, qty: 7 }),
      }),
    );
    renderWithProviders(<ReceiptForm onAccepted={onAccepted} />);
    await fillRequired();
    type("Поставщик", "Росско");
    fireEvent.click(screen.getByRole("button", { name: "Принять" }));
    expect(
      await screen.findByText("✓ Принято: W 68/3 · MANN-FILTER ×4 → остаток 7"),
    ).toBeTruthy();
    expect(input("Номер").value).toBe("");
    expect(document.activeElement).toBe(input("Номер"));
    expect(input("Поставщик").value).toBe("Росско");
    expect(onAccepted).toHaveBeenCalledOnce();
  });

  it("error message", async () => {
    mockApi(
      handlers([], {
        "POST /api/stock/receipts": () =>
          new Response(JSON.stringify({ message: "Позиция заблокирована" }), {
            status: 409,
          }),
      }),
    );
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Принять" }));
    expect(await screen.findByText("Позиция заблокирована")).toBeTruthy();
    expect(input("Номер").value).toBe("W 68/3");
    expect(input("Закупка").value).toBe("405");
  });

  it("keeps the markup field empty when cleared", async () => {
    mockApi(handlers([]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    await waitFor(() => {
      expect(input("Наценка, %").value).toBe("25");
    });
    type("Закупка", "412");
    type("Продажа", "600");
    type("Наценка, %", "");
    await new Promise((r) => setTimeout(r, 50));
    expect(input("Наценка, %").value).toBe("");
    expect(input("Продажа").value).toBe("600");
  });

  it("does not match when typed brand differs", async () => {
    mockApi(handlers([MANN]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    type("Бренд", "BOSCH");
    type("Номер", "W 68/3");
    await waitFor(() => {
      expect(screen.queryByText(/Позиция есть/)).toBeNull();
    });
    await new Promise((r) => setTimeout(r, 450));
    type("Закупка", "412");
    expect(screen.queryByText(/Позиция есть/)).toBeNull();
    expect(screen.queryByLabelText(/поставить новую/)).toBeNull();
    expect(input("Бренд").value).toBe("BOSCH");
  });

  it("prefills the item of the typed brand among several", async () => {
    const BOSCH = {
      ...MANN,
      id: 2,
      brand: "BOSCH",
      name: "Фильтр Bosch",
      purchase_price: "300.00",
    };
    mockApi(handlers([MANN, BOSCH]));
    renderWithProviders(<ReceiptForm onAccepted={vi.fn()} />);
    type("Номер", "W 68/3");
    await new Promise((r) => setTimeout(r, 450));
    expect(input("Название").value).toBe("");
    type("Бренд", " bosch ");
    await waitFor(() => {
      expect(input("Название").value).toBe("Фильтр Bosch");
    });
    expect(input("Закупка").value).toBe("300.00");
  });
});
