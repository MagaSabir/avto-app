import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PartPicker } from "./PartPicker";

const parts = [
  {
    key: "MANN|W683",
    brand: "Mann",
    number: "W 68/3",
    name: "Фильтр масляный",
    offers: 3,
    minPrice: "710.00",
    analogs: 80,
  },
  {
    key: "MGA|W683",
    brand: "MGA",
    number: "W68/3",
    name: "Насос водяной",
    offers: 0,
    minPrice: null,
    analogs: 1,
  },
];

describe("PartPicker", () => {
  it("lists parts with offers, price and analogs", () => {
    render(<PartPicker parts={parts} onPick={() => undefined} />);
    expect(screen.getByText("Выберите деталь")).toBeInTheDocument();
    const mann = screen.getByRole("button", {
      name: /Mann W 68\/3 Фильтр масляный/,
    });
    expect(mann).toHaveTextContent("3 предложения");
    expect(mann).toHaveTextContent("от 710 ₽");
    expect(mann).toHaveTextContent("80 аналогов");
    expect(screen.getByText("W 68/3")).toHaveClass("font-mono");
    const mga = screen.getByRole("button", { name: /MGA W68\/3/ });
    expect(mga).toHaveTextContent("нет предложений");
    expect(mga).toHaveTextContent("1 аналог");
    expect(mga).not.toHaveTextContent("от ");
  });

  it("picks a part by key", () => {
    const onPick = vi.fn();
    render(<PartPicker parts={parts} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /MGA W68\/3/ }));
    expect(onPick).toHaveBeenCalledWith("MGA|W683");
  });
});
