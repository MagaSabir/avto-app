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

function pressed(name: string): string | null {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

describe("ThemeToggle", () => {
  it("starts from the stored value", () => {
    localStorage.setItem("theme", "dark");
    mockSystemDark(false);
    render(<ThemeToggle />);
    expect(pressed("Тёмная тема")).toBe("true");
    expect(pressed("Светлая тема")).toBe("false");
  });

  it("starts from the system preference when nothing is stored", () => {
    mockSystemDark(true);
    render(<ThemeToggle />);
    expect(pressed("Тёмная тема")).toBe("true");
  });

  it("starts from the system preference when stored value is legacy system", () => {
    localStorage.setItem("theme", "system");
    mockSystemDark(false);
    render(<ThemeToggle />);
    expect(pressed("Светлая тема")).toBe("true");
  });

  it("switches with the moon and sun buttons", () => {
    mockSystemDark(false);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Тёмная тема" }));
    expect(pressed("Тёмная тема")).toBe("true");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Светлая тема" }));
    expect(pressed("Светлая тема")).toBe("true");
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
    fireEvent.click(screen.getByRole("button", { name: "Тёмная тема" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Светлая тема" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
