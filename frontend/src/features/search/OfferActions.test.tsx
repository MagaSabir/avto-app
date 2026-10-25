import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/api/cart";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup } from "@/test/searchFixtures";

import { OfferActions } from "./OfferActions";

function cartItem(over: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    supplier: "rossko",
    stock_id: "s1",
    brand: "KYB",
    number: "333114",
    number_norm: "333114",
    name: "Стойка",
    warehouse: "Новосибирск",
    multiplicity: 1,
    qty: 4,
    available: 20,
    delivery_days: null,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    order_code: null,
    price: "2449.85",
    sum: "9799.40",
    ...over,
  };
}

function setup(
  o = offer({ multiplicity: 2, qty: 10 }),
  items: CartItem[] = [],
  onToStock = vi.fn(),
) {
  const posts: unknown[] = [];
  mockApi({
    "GET /api/cart": () => ({ items, total: "0.00" }),
    "POST /api/cart/items": (init) => {
      posts.push(JSON.parse(init.body as string));
      return cartItem();
    },
  });
  const group = partGroup();
  renderWithProviders(
    <OfferActions
      supplier="rossko"
      group={group}
      offer={o}
      onToStock={onToStock}
    />,
  );
  return { posts, onToStock, group, o };
}

describe("OfferActions", () => {
  it("adds offer with default multiplicity", async () => {
    const { posts } = setup();
    expect(screen.getByLabelText("Количество")).toHaveValue(2);
    fireEvent.click(screen.getByRole("button", { name: "В корзину" }));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({
      supplier: "rossko",
      stock_id: "s1",
      brand: "KYB",
      number: "333114",
      qty: 2,
      available: 10,
      multiplicity: 2,
      price: "2449.85",
    });
    expect(await screen.findByText("Добавлено")).toBeInTheDocument();
  });

  it("adds on Enter in the quantity field", async () => {
    const { posts } = setup();
    fireEvent.submit(screen.getByLabelText("Количество"));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
  });

  it.each(["0", "3", "12", "", "abc"])(
    "rejects invalid quantity %j",
    async (value) => {
      const { posts } = setup();
      const input = screen.getByLabelText("Количество");
      fireEvent.change(input, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "В корзину" }));
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("кратно 2, не больше 10")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(posts).toHaveLength(0);
    },
  );

  it("shows quantity already in cart", async () => {
    setup(offer({ multiplicity: 2, qty: 10 }), [cartItem()]);
    expect(await screen.findByText("в корзине 4 шт")).toBeInTheDocument();
  });

  it("ignores cart rows of other offers", async () => {
    setup(offer(), [cartItem({ stock_id: "other" })]);
    await screen.findByRole("button", { name: "В корзину" });
    expect(screen.queryByText(/в корзине/)).not.toBeInTheDocument();
  });

  it("matches the brand ignoring case and extra spaces", async () => {
    setup(offer(), [cartItem({ brand: "KYB  " })]);
    expect(await screen.findByText("в корзине 4 шт")).toBeInTheDocument();
  });

  it("disables add without stock id", () => {
    setup(offer({ stock_id: "" }));
    expect(screen.getByRole("button", { name: "В корзину" })).toBeDisabled();
  });

  it("calls onToStock", () => {
    const { onToStock, group, o } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Принять на склад" }));
    expect(onToStock).toHaveBeenCalledWith(group, o);
  });

  it("adds an order offer regardless of stock, with its order code", async () => {
    const { posts } = setup(
      offer({ kind: "order", qty: 0, order_code: "v1004-w683" }),
    );
    const input = screen.getByLabelText("Количество");
    fireEvent.change(input, { target: { value: "5" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "В корзину" }));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({
      kind: "order",
      qty: 5,
      order_code: "v1004-w683",
    });
  });

  it("sends a null order code for Rossko offers", async () => {
    const { posts } = setup();
    fireEvent.click(screen.getByRole("button", { name: "В корзину" }));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({ order_code: null });
  });

  it("offers delivery variants instead of the cart", () => {
    setup(offer({ kind: "variants", qty: 0, order_code: "gto90915yzzm3" }));
    expect(
      screen.getByRole("button", { name: "варианты поставки ▾" }),
    ).toBeEnabled();
    expect(screen.queryByLabelText("Количество")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "В корзину" }),
    ).not.toBeInTheDocument();
  });
});
