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
    order_code: null,
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
  // Cart returned by GET /api/cart once refresh has run (server-side price update).
  itemsAfter?: CartItem[];
  // Holds the refresh response until released.
  gate?: Promise<void>;
  failDelete?: boolean;
};

function setup({
  items = [item(1)],
  total = "412.00",
  refresh,
  itemsAfter,
  gate,
  failDelete,
}: Setup = {}) {
  const calls: string[] = [];
  const bodies: Record<string, unknown> = {};
  let cart = items;
  let refreshed = false;
  mockApi({
    "GET /api/cart": () => ({
      items: refreshed && itemsAfter ? itemsAfter : cart,
      total,
    }),
    "POST /api/cart/refresh": () => {
      calls.push("refresh");
      refreshed = true;
      return refresh ?? { status: "ok", message: null, items: [] };
    },
    "PATCH /api/cart/items/1": (init) => {
      calls.push("PATCH");
      bodies.patch = JSON.parse(init.body as string);
      return { ...cart[0], qty: 4 };
    },
    "DELETE /api/cart/items/1": () => {
      calls.push("DELETE item");
      if (failDelete) {
        return new Response(JSON.stringify({ detail: "Строка не найдена" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      cart = [];
      return new Response(null, { status: 204 });
    },
    "DELETE /api/cart": () => {
      calls.push("DELETE cart");
      if (failDelete) {
        return new Response(JSON.stringify({ detail: "Не удалось очистить" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      cart = [];
      return new Response(null, { status: 204 });
    },
  });
  if (gate) {
    const inner = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/api/cart/refresh")) await gate;
        return inner(input, init);
      },
    );
  }
  renderWithProviders(<CartPage />, { route: "/cart" });
  return { calls, bodies };
}

describe("CartPage", () => {
  it("shows saved items then refreshed price", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup({
      gate,
      itemsAfter: [item(1, { price: "450.00", sum: "450.00" })],
      refresh: {
        status: "ok",
        message: null,
        items: [ref(1, { price: "450.00", previous_price: "412.00" })],
      },
    });
    // price and sum cells
    expect(await screen.findAllByText("412 ₽")).toHaveLength(2);
    expect(screen.getByText("проверяем цены…")).toBeInTheDocument();
    release();
    // price span + sum cell (from the refetched cart)
    expect(await screen.findAllByText("450 ₽")).toHaveLength(2);
    // Still struck through after the cart refetch brought the new price.
    await waitFor(() => {
      expect(screen.getByText("412").tagName).toBe("S");
    });
    expect(screen.queryByText("проверяем цены…")).not.toBeInTheDocument();
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
    expect(await screen.findByText("нет в наличии")).toHaveClass(
      "text-status-out",
    );
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

  it("saves qty on blur", async () => {
    const { bodies } = setup();
    const field = await screen.findByLabelText("Количество N1");
    fireEvent.change(field, { target: { value: "4" } });
    fireEvent.blur(field);
    await waitFor(() => {
      expect(bodies.patch).toEqual({ qty: 4 });
    });
  });

  it("shows remove error", async () => {
    setup({ failDelete: true });
    await screen.findByText("N1");
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(await screen.findByText("Строка не найдена")).toBeInTheDocument();
    expect(screen.getByText("N1")).toBeInTheDocument();
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

  it("shows clear error inside the dialog", async () => {
    setup({ failDelete: true });
    await screen.findByText("N1");
    fireEvent.click(screen.getByRole("button", { name: "Очистить корзину" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Очистить" }));
    expect(
      await within(dialog).findByText("Не удалось очистить"),
    ).toBeInTheDocument();
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

  it("breaks brand only after a slash", async () => {
    setup({ items: [item(1, { brand: "CITROEN/PEUGEOT" })] });
    const brand = await screen.findByText(/CITROEN\//);
    expect(brand.querySelectorAll("wbr")).toHaveLength(1);
    expect(brand).toHaveTextContent("CITROEN/PEUGEOT");
  });

  it("links number to search", async () => {
    setup();
    expect(await screen.findByRole("link", { name: "N1" })).toHaveAttribute(
      "href",
      "/?q=N1",
    );
  });
});
