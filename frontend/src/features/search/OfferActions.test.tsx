import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  disabled = false,
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
      disabled={disabled}
    />,
  );
  return { posts, onToStock, group, o };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OfferActions", () => {
  it("adds offer with default multiplicity", async () => {
    const { posts } = setup();
    expect(screen.getByLabelText("Количество")).toHaveValue("2");
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
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(screen.queryByText("Добавлено")).not.toBeInTheDocument();
  });

  it("has no success state or animation after adding", async () => {
    const { posts } = setup();
    const btn = screen.getByRole("button", { name: "В корзину" });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(btn).not.toHaveAttribute("data-state");
    expect(btn.querySelector("svg")).toHaveClass("lucide-shopping-cart");
    expect(btn.className).not.toMatch(/animate/);
  });

  it("draws the cart and stock buttons filled with primary", () => {
    setup();
    for (const name of ["В корзину", "Принять на склад"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toHaveClass("bg-primary", "text-primary-foreground");
      expect(btn).not.toHaveClass("border-foreground");
      expect(btn.className).not.toMatch(/animate/);
    }
  });

  it("shows the cart count as plain text inside the button", async () => {
    setup(offer({ multiplicity: 2, qty: 10 }), [cartItem()]);
    const btn = await screen.findByRole("button", {
      name: "В корзину, в корзине 4",
    });
    const count = within(btn).getByText("4");
    expect(count.className).not.toMatch(/rounded-full|bg-/);
    expect(count).toHaveClass("text-foreground");
  });

  it("colours enabled steppers and mutes disabled ones", () => {
    setup(offer({ multiplicity: 1, qty: 10 }));
    expect(screen.getByRole("button", { name: "Увеличить" })).toHaveClass(
      "text-foreground",
    );
    const down = screen.getByRole("button", { name: "Уменьшить" });
    expect(down).toBeDisabled();
    expect(down).toHaveClass("disabled:text-muted-foreground");
    expect(down).toHaveClass("disabled:cursor-not-allowed");
  });

  it("keeps the cart button filled with a count", async () => {
    setup(offer({ multiplicity: 2, qty: 10 }), [cartItem()]);
    const btn = await screen.findByRole("button", {
      name: "В корзину, в корзине 4",
    });
    expect(btn).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("uses a text input without browser spin arrows", () => {
    setup();
    const input = screen.getByLabelText("Количество");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("shows the hint in an absolutely positioned line", () => {
    setup(offer({ multiplicity: 4, qty: 6 }));
    fireEvent.change(screen.getByLabelText("Количество"), {
      target: { value: "5" },
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("кратно 4, не больше 6");
    expect(status).toHaveClass("absolute");
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

  it("shows quantity already in cart as a badge only", async () => {
    setup(offer({ multiplicity: 2, qty: 10 }), [cartItem()]);
    const btn = await screen.findByRole("button", {
      name: "В корзину, в корзине 4",
    });
    expect(btn).toHaveTextContent("4");
    expect(screen.queryByText(/шт/)).not.toBeInTheDocument();
  });

  it("ignores cart rows of other offers", async () => {
    setup(offer(), [cartItem({ stock_id: "other" })]);
    await screen.findByRole("button", { name: "В корзину" });
    expect(
      screen.queryByRole("button", { name: /в корзине/ }),
    ).not.toBeInTheDocument();
  });

  it("matches the brand ignoring case and extra spaces", async () => {
    setup(offer(), [cartItem({ brand: "KYB  " })]);
    expect(
      await screen.findByRole("button", { name: "В корзину, в корзине 4" }),
    ).toBeInTheDocument();
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

  it("shows the cart button without a count when nothing is in the cart", async () => {
    setup(offer(), []);
    const btn = screen.getByRole("button", { name: "В корзину" });
    await waitFor(() => {
      expect(btn).not.toHaveTextContent(/\d/);
    });
  });

  it("shows the count on the cart button when the offer is in the cart", async () => {
    setup(offer(), [cartItem({ qty: 2 })]);
    const btn = await screen.findByRole("button", {
      name: "В корзину, в корзине 2",
    });
    expect(btn).toHaveTextContent("2");
  });

  it("has a disabled compare button", () => {
    setup();
    const btn = screen.getByRole("button", { name: "В сравнение" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Сравнение — позже");
  });

  it("steps the quantity by multiplicity", () => {
    setup(offer({ multiplicity: 2, qty: 10 }));
    fireEvent.click(screen.getByRole("button", { name: "Увеличить" }));
    expect(screen.getByLabelText("Количество")).toHaveValue("4");
    fireEvent.click(screen.getByRole("button", { name: "Уменьшить" }));
    fireEvent.click(screen.getByRole("button", { name: "Уменьшить" }));
    expect(screen.getByLabelText("Количество")).toHaveValue("2");
  });

  it("keeps the quantity within multiplicity and stock", () => {
    setup(offer({ multiplicity: 4, qty: 6 }));
    expect(screen.getByLabelText("Количество")).toHaveValue("4");
    expect(screen.getByRole("button", { name: "Уменьшить" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Увеличить" })).toBeDisabled();
  });

  it("rejects a typed quantity that is not a multiple and does not post", async () => {
    const { posts } = setup(offer({ multiplicity: 4, qty: 6 }));
    fireEvent.change(screen.getByLabelText("Количество"), {
      target: { value: "5" },
    });
    expect(screen.getByText("кратно 4, не больше 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "В корзину" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toHaveLength(0);
  });

  it("allows stepping up on an order offer without stock", () => {
    setup(offer({ kind: "order", qty: 0, order_code: "v1" }));
    expect(screen.getByRole("button", { name: "Увеличить" })).toBeEnabled();
  });

  it("disables everything when disabled", () => {
    setup(offer(), [], vi.fn(), true);
    for (const name of [
      "В корзину",
      "Принять на склад",
      "Уменьшить",
      "Увеличить",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByLabelText("Количество")).toBeDisabled();
  });

  it("does not mark a disabled quantity invalid", () => {
    setup(offer({ kind: "variants", qty: 0 }), [], vi.fn(), true);
    expect(screen.getByLabelText("Количество")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
