import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: dark })),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle", () => {
  it("starts from the stored value", () => {
    localStorage.setItem("theme", "dark");
    mockSystemDark(false);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Тема: тёмная" })).toBeVisible();
  });

  it("starts from the system preference when nothing is stored", () => {
    mockSystemDark(true);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Тема: тёмная" })).toBeVisible();
  });

  it("starts from the system preference when stored value is legacy system", () => {
    localStorage.setItem("theme", "system");
    mockSystemDark(false);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Тема: светлая" })).toBeVisible();
  });

  it("toggles between light and dark", () => {
    mockSystemDark(false);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Тема: светлая" }));
    const button = screen.getByRole("button", { name: "Тема: тёмная" });
    expect(button).toHaveAttribute("title", "Тема: тёмная");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Тема: светлая" })).toBeVisible();
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("works when localStorage throws", () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Тема: светлая" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Тема: тёмная" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
