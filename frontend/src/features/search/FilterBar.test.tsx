import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

const both = [
  { code: "rossko", title: "Росско" },
  { code: "mikado", title: "Микадо" },
];

function setup(over: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const onChange = vi.fn();
  const onChoose = vi.fn();
  render(
    <FilterBar
      showAnalogs={false}
      sort="price"
      suppliers={both}
      chosen={["rossko", "mikado"]}
      onChoose={onChoose}
      onChange={onChange}
      {...over}
    />,
  );
  return { onChange, onChoose };
}

describe("FilterBar", () => {
  it("toggles the analogs checkbox", () => {
    const { onChange } = setup();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Показывать аналоги" }),
    );
    expect(onChange).toHaveBeenCalledWith({ showAnalogs: true });
  });

  it("has no stock or Mikado-orders checkboxes", () => {
    setup();
    expect(
      screen.queryByRole("checkbox", { name: "В наличии" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Микадо: наличие и заказ" }),
    ).not.toBeInTheDocument();
  });

  it("uses the soft color for checkbox labels", () => {
    setup();
    expect(screen.getByText("Показывать аналоги")).toHaveClass(
      "text-soft-foreground",
    );
  });

  it("changes the sort", () => {
    const { onChange } = setup();
    const select = screen.getByRole("combobox", { name: "Сортировка" });
    expect(
      screen.getByRole("option", { name: "По цене ↑" }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "time" } });
    expect(onChange).toHaveBeenCalledWith({ sort: "time" });
  });

  it("chooses suppliers from the dropdown", () => {
    const { onChoose } = setup();
    const button = screen.getByRole("button", {
      name: /Поставщик: Росско, Микадо/,
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(screen.getByRole("group", { name: "Поставщики" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Росско" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Микадо" }));
    expect(onChoose).toHaveBeenCalledWith(["rossko"]);
  });

  it("closes the dropdown on Escape and on outside click", () => {
    setup();
    const button = screen.getByRole("button", { name: /Поставщик/ });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the last chosen supplier checked", () => {
    setup({ chosen: ["rossko"] });
    fireEvent.click(screen.getByRole("button", { name: /Поставщик/ }));
    expect(screen.getByRole("checkbox", { name: "Росско" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Микадо" })).toBeEnabled();
  });

  it("has no supplier button with a single supplier", () => {
    setup({
      suppliers: [both[0]],
      chosen: ["rossko"],
    });
    expect(
      screen.queryByRole("button", { name: /Поставщик/ }),
    ).not.toBeInTheDocument();
  });
});
