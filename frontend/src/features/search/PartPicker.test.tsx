import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { offer, partGroup } from "@/test/searchFixtures";

import type { PartCard } from "./derive";
import { PartPicker } from "./PartPicker";

const now = new Date(2026, 9, 21, 10, 0);

const mann: PartCard = {
  supplier: "rossko",
  title: "Росско",
  group: partGroup({
    brand: "Mann",
    number: "W 68/3",
    name: "Фильтр масляный",
    key: "MANN|W683",
  }),
  analogs: 86,
  minPrice: "126.00",
  fastest: offer({
    purchase_price: "140.00",
    delivery_from: new Date(2026, 9, 21, 18, 0).toISOString(),
  }),
};

const mikado: PartCard = {
  supplier: "mikado",
  title: "Микадо",
  group: partGroup({
    brand: "MANN-FILTER",
    number: "W 68/3",
    name: "Фильтр масляный",
    key: "MANN|W683",
  }),
  analogs: 41,
  minPrice: "130.00",
  fastest: null,
};

const empty: PartCard = {
  ...mann,
  supplier: "other",
  title: "Другой",
  group: partGroup({ brand: "MGA", number: "W68/3", key: "MGA|W683" }),
  analogs: 0,
  minPrice: null,
  fastest: null,
};

function setup(over: Partial<Parameters<typeof PartPicker>[0]> = {}) {
  const props = {
    cards: [mann, mikado],
    stockQty: (key: string) => (key === "MANN|W683" ? 15 : 0),
    now,
    pending: [],
    errors: [],
    onPick: vi.fn(),
    ...over,
  };
  render(<PartPicker {...props} />);
  return props;
}

describe("PartPicker", () => {
  it("shows the count and a card per supplier part", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Найдено 2 детали" }),
    ).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Mann.*W 68\/3/ });
    expect(card).toHaveTextContent("Росско · 86 аналогов · у вас 15 шт");
    expect(card).toHaveTextContent("от 126 ₽");
    expect(card).toHaveTextContent("сегодня 18:00");
    expect(card).toHaveTextContent("Фильтр масляный");
  });

  it("omits the stock part when nothing is in stock", () => {
    setup({ stockQty: () => 0 });
    const card = screen.getByRole("button", { name: /MANN-FILTER/ });
    expect(card).toHaveTextContent("Микадо · 41 аналог");
    expect(card).not.toHaveTextContent("у вас");
  });

  it("shows a dash and dims a card without offers", () => {
    setup({ cards: [empty] });
    const card = screen.getByRole("button", { name: /MGA/ });
    expect(card).toHaveClass("opacity-60");
    expect(within(card).getByText("—")).toBeInTheDocument();
  });

  it("says «варианты поставки» when only variants are offered", () => {
    setup({ cards: [mikado] });
    expect(
      screen.getByRole("button", { name: /MANN-FILTER/ }),
    ).toHaveTextContent("варианты поставки");
  });

  it("shows a skeleton for a supplier still answering", () => {
    setup({ pending: [{ title: "Микадо" }] });
    expect(screen.getByText("Микадо · ждём ответ…")).toBeInTheDocument();
  });

  it("shows a supplier error with retry", () => {
    const retry = vi.fn();
    setup({ errors: [{ title: "Микадо", message: "Лимит исчерпан", retry }] });
    expect(screen.getByText("Лимит исчерпан")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalled();
  });

  it("picks a card by supplier and key", () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Mann.*W 68\/3/ }));
    expect(onPick).toHaveBeenCalledWith("rossko", "MANN|W683");
  });
});
