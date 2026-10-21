import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle", () => {
  it("cycles light, dark, system", () => {
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Тема: как в системе" }),
    );
    expect(screen.getByRole("button", { name: "Тема: светлая" })).toBeVisible();
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Тема: светлая" }));
    expect(screen.getByRole("button", { name: "Тема: тёмная" })).toBeVisible();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Тема: тёмная" }));
    expect(
      screen.getByRole("button", { name: "Тема: как в системе" }),
    ).toHaveAttribute("title", "Тема: как в системе");
  });

  it("works when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Тема: как в системе" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Тема: светлая" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Тема: тёмная" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
