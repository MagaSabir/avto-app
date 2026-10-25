import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchForm } from "./SearchForm";

function field() {
  return screen.getByLabelText("OEM/Номер или артикул");
}

describe("SearchForm", () => {
  it("submits the typed number on Enter", () => {
    const onSearch = vi.fn();
    render(<SearchForm initial="" onSearch={onSearch} />);
    expect(field()).toHaveFocus();
    fireEvent.change(field(), { target: { value: " W68/3 " } });
    fireEvent.submit(field());
    expect(onSearch).toHaveBeenCalledWith("W68/3");
  });

  it("shows the initial value", () => {
    render(<SearchForm initial="W68/3" onSearch={vi.fn()} />);
    expect(field()).toHaveValue("W68/3");
  });

  it("rejects input that is empty after normalization", () => {
    const onSearch = vi.fn();
    render(<SearchForm initial="" onSearch={onSearch} />);
    fireEvent.change(field(), { target: { value: "-/." } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    expect(screen.getByText("Введите номер")).toHaveClass("text-destructive");
    expect(field().closest(".border-destructive\\!")).not.toBeNull();
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "@abc" } });
    fireEvent.submit(field());
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("clears the field and refocuses it without searching", () => {
    const onSearch = vi.fn();
    render(<SearchForm initial="W68/3" onSearch={onSearch} />);
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(onSearch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Очистить" }),
    ).not.toBeInTheDocument();
  });

  it("has a search icon in the field and none in the button", () => {
    const { container } = render(<SearchForm initial="" onSearch={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Найти" }).querySelector("svg"),
    ).toBeNull();
    expect(
      field().parentElement?.parentElement?.querySelector("svg"),
    ).not.toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(field()).not.toHaveClass("font-mono");
  });
});
