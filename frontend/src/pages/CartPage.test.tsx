import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem, CartRefreshItem } from "@/api/cart";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CartPage } from "./CartPage";

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
  vi.unstubAllGlobals();
});

function item(id: number, over: Partial<CartItem> = {}): CartItem {
  return {
    id,
    supplier: "rossko",
    stock_id: `s${String(id)}`,
    brand: "KYB",
    number: `N${String(id)}`,
    number_norm: `N${String(id)}`,
    name: `Деталь ${String(id)}`,
    warehouse: "Новосибирск",
    multiplicity: 1,
    qty: 1,
    available: 20,
    delivery_days: 2,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    price: "412.00",
    sum: "412.00",
    ...over,
  };
}

function ref(id: number, over: Partial<CartRefreshItem> = {}): CartRefreshItem {
  return {
    id,
    state: "ok",
    price: "412.00",
    previous_price: null,
    available: 20,
    ...over,
  };
}

type Setup = {
  items?: CartItem[];
  total?: string;
  refresh?: {
    status: "ok" | "error";
    message: string | null;
    items: CartRefreshItem[];
  };
};

function setup({ items = [item(1)], total = "412.00", refresh }: Setup = {}) {
  const calls: string[] = [];
  const bodies: Record<string, unknown> = {};
  let cart = items;
  mockApi({
    "GET /api/cart": () => ({ items: cart, total }),
    "POST /api/cart/refresh": () => {
      calls.push("refresh");
      return refresh ?? { status: "ok", message: null, items: [] };
    },
    "PATCH /api/cart/items/1": (init) => {
      calls.push("PATCH");
      bodies.patch = JSON.parse(init.body as string);
      return { ...cart[0], qty: 4 };
    },
    "DELETE /api/cart/items/1": () => {
      calls.push("DELETE item");
      cart = [];
      return new Response(null, { status: 204 });
    },
    "DELETE /api/cart": () => {
      calls.push("DELETE cart");
      cart = [];
      return new Response(null, { status: 204 });
    },
  });
  renderWithProviders(<CartPage />, { route: "/cart" });
  return { calls, bodies };
}

describe("CartPage", () => {
  it("shows saved items then refreshed price", async () => {
    setup({
      refresh: {
        status: "ok",
        message: null,
        items: [ref(1, { price: "450.00", previous_price: "412.00" })],
      },
    });
    await screen.findByText("N1");
    expect(screen.getByText("412").tagName).toBe("S");
    expect(await screen.findByText("450 ₽")).toBeInTheDocument();
  });

  it("refreshes once per mount", async () => {
    const { calls } = setup();
    await screen.findByText("N1");
    await waitFor(() => {
      expect(calls).toEqual(["refresh"]);
    });
  });

  it("marks gone offers", async () => {
    setup({
      refresh: {
        status: "ok",
        message: null,
        items: [ref(1, { state: "gone", available: 0 })],
      },
    });
    expect(await screen.findByText("нет в наличии")).toBeInTheDocument();
  });

  it("warns when qty exceeds available", async () => {
    setup({
      items: [item(1, { qty: 4 })],
      refresh: {
        status: "ok",
        message: null,
        items: [ref(1, { available: 2 })],
      },
    });
    expect(await screen.findByText("в наличии 2 шт")).toBeInTheDocument();
  });

  it("shows supplier error", async () => {
    setup({
      refresh: { status: "error", message: "Росско недоступен", items: [] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Росско недоступен",
    );
    expect(screen.getByText("N1")).toBeInTheDocument();
  });

  it("saves qty on Enter", async () => {
    const { bodies } = setup({ items: [item(1, { multiplicity: 2 })] });
    const field = await screen.findByLabelText("Количество N1");
    fireEvent.change(field, { target: { value: "4" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => {
      expect(bodies.patch).toEqual({ qty: 4 });
    });
  });

  it("does not save invalid qty", async () => {
    const { calls } = setup({ items: [item(1, { multiplicity: 2 })] });
    const field = await screen.findByLabelText("Количество N1");
    fireEvent.change(field, { target: { value: "3" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("кратно 2, не больше 20")).toBeInTheDocument();
    expect(calls).not.toContain("PATCH");
  });

  it("removes item", async () => {
    const { calls } = setup();
    await screen.findByText("N1");
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    await waitFor(() => {
      expect(calls).toContain("DELETE item");
    });
    expect(await screen.findByText("Корзина пуста")).toBeInTheDocument();
  });

  it("clears cart after confirmation", async () => {
    const { calls } = setup();
    await screen.findByText("N1");
    fireEvent.click(screen.getByRole("button", { name: "Очистить корзину" }));
    expect(calls).not.toContain("DELETE cart");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Очистить корзину?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Очистить" }));
    await waitFor(() => {
      expect(calls).toContain("DELETE cart");
    });
  });

  it("empty cart", async () => {
    setup({ items: [], total: "0.00" });
    expect(await screen.findByText("Корзина пуста")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Перейти к поиску" }),
    ).toHaveAttribute("href", "/");
  });

  it("shows total", async () => {
    setup({
      items: [item(1, { sum: "824.00", qty: 2 }), item(2, { sum: "450.00" })],
      total: "1274.00",
    });
    expect(await screen.findByText(/2 позиции · 1\s274 ₽/)).toBeInTheDocument();
  });

  it("links number to search", async () => {
    setup();
    expect(await screen.findByRole("link", { name: "N1" })).toHaveAttribute(
      "href",
      "/?q=N1",
    );
  });
});
