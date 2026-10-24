import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { offer } from "@/test/searchFixtures";

import type { PartChoice } from "./derive";
import { PartPicker } from "./PartPicker";

const now = new Date(2026, 9, 21, 10, 0);

const parts: PartChoice[] = [
  {
    key: "MANN|W683",
    brand: "Mann",
    number: "W 68/3",
    name: "Фильтр масляный",
    offers: 3,
    minPrice: "540.00",
    fastest: offer({
      purchase_price: "696.00",
      price: "840.00",
      delivery_days: 1,
    }),
    analogs: 80,
    suppliers: 1,
  },
  {
    key: "MGA|W683",
    brand: "MGA",
    number: "W68/3",
    name: "Насос водяной",
    offers: 0,
    minPrice: null,
    fastest: null,
    analogs: 1,
    suppliers: 1,
  },
  {
    key: "BIG|W683",
    brand: "BIG",
    number: "W683",
    name: " фильтр масляный",
    offers: 0,
    minPrice: null,
    fastest: null,
    analogs: 0,
    suppliers: 1,
  },
];

describe("PartPicker", () => {
  it("shows cards by part name with the fastest offer", () => {
    render(<PartPicker parts={parts} now={now} onPick={() => undefined} />);
    expect(
      screen.getByRole("heading", { name: "Результаты поиска" }),
    ).toBeInTheDocument();
    const filters = screen.getByRole("region", { name: "Фильтр масляный" });
    expect(within(filters).getByText("Бренд")).toBeInTheDocument();
    expect(
      within(filters).getByText("Артикул / Наименование"),
    ).toBeInTheDocument();
    expect(within(filters).getByText("Цена")).toBeInTheDocument();
    const mann = within(filters).getByRole("button", {
      name: /Mann W 68\/3 Фильтр масляный/,
    });
    expect(within(mann).getByText("Mann")).toBeInTheDocument();
    expect(within(mann).getByText("W 68/3")).toHaveClass("font-mono");
    expect(within(mann).getByText("696 ₽")).toBeInTheDocument();
    expect(within(mann).getByText("1 дн.")).toBeInTheDocument();
    expect(within(mann).getByText("+ 80 аналогов")).toBeInTheDocument();
    expect(mann).not.toHaveTextContent("840");
    expect(
      within(filters).getByRole("button", { name: /BIG W683/ }),
    ).toBeInTheDocument();

    const pump = screen.getByRole("region", { name: "Насос водяной" });
    const mga = within(pump).getByRole("button", { name: /MGA W68\/3/ });
    expect(within(mga).getByText("—")).toBeInTheDocument();
    expect(within(mga).getByText("нет в наличии")).toBeInTheDocument();
    expect(within(mga).getByText("+ 1 аналог")).toBeInTheDocument();
  });

  it("picks a part by key", () => {
    const onPick = vi.fn();
    render(<PartPicker parts={parts} now={now} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /MGA W68\/3/ }));
    expect(onPick).toHaveBeenCalledWith("MGA|W683");
  });
});
