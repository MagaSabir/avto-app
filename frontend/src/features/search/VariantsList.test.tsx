import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup } from "@/test/searchFixtures";

import { OfferActions } from "./OfferActions";

const variants = (over: object = {}) => ({
  code: "mikado",
  title: "Микадо",
  status: "ok",
  message: null,
  markup: "20.00",
  offers: [
    offer({
      stock_id: "gto90915yzzm3#1",
      kind: "order",
      qty: 0,
      delivery_days: 0,
      delivery_days_max: 4,
      rating: 100,
      purchase_price: "504.00",
      warehouse: "Москва",
    }),
  ],
  ...over,
});

function setup(answer: () => object) {
  const calls: string[] = [];
  const posts: Record<string, unknown>[] = [];
  mockApi({
    "GET /api/cart": () => ({ items: [], total: "0.00" }),
    "GET /api/search/suppliers/mikado/variants": (_init, url) => {
      calls.push(url.search);
      return answer();
    },
    "POST /api/cart/items": (init) => {
      posts.push(JSON.parse(init.body as string) as Record<string, unknown>);
      return {};
    },
  });
  renderWithProviders(
    <OfferActions
      supplier="mikado"
      group={partGroup()}
      offer={offer({
        kind: "variants",
        stock_id: "",
        order_code: "gto90915yzzm3",
      })}
      onToStock={() => undefined}
    />,
  );
  return { calls, posts };
}

describe("VariantsList", () => {
  it("asks once on opening and shows price, term, rating", async () => {
    const { calls } = setup(variants);
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /варианты поставки/ }));
    expect(await screen.findByText("504 ₽")).toBeInTheDocument();
    expect(screen.getByText("0–4 дн.")).toBeInTheDocument();
    expect(screen.getByText("100 %")).toBeInTheDocument();
    expect(screen.getByText("Под заказ")).toBeInTheDocument();
    expect(calls).toEqual(["?order_code=gto90915yzzm3"]);
  });

  it("adds a variant to the cart with its own stock_id", async () => {
    const { posts } = setup(variants);
    fireEvent.click(screen.getByRole("button", { name: /варианты поставки/ }));
    fireEvent.click(await screen.findByRole("button", { name: "В корзину" }));
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({
      supplier: "mikado",
      stock_id: "gto90915yzzm3#1",
      kind: "order",
      order_code: "gto90915yzzm3",
    });
  });

  it("shows the supplier message in grey and an error as an alert", async () => {
    setup(() => variants({ message: "Цены ориентировочные" }));
    fireEvent.click(screen.getByRole("button", { name: /варианты поставки/ }));
    expect(await screen.findByText("Цены ориентировочные")).toBeVisible();
  });

  it("shows a supplier error", async () => {
    setup(() =>
      variants({ status: "error", message: "Микадо недоступен", offers: [] }),
    );
    fireEvent.click(screen.getByRole("button", { name: /варианты поставки/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Микадо недоступен",
    );
  });
});
