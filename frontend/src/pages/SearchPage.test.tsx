import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import { stockItem, supplierResult } from "@/test/searchFixtures";

import { SearchPage } from "./SearchPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stock = {
  query: "W68/3",
  number_norm: "W683",
  items: [
    stockItem(1, { number_raw: "W 68/3", number_norm: "W683", brand: "MANN" }),
    stockItem(2, {
      number_raw: "W68/3",
      number_norm: "W683",
      brand: "FILTRON",
      qty: 0,
      status: "out",
    }),
  ],
};

describe("SearchPage", () => {
  it("shows only the form without a query", () => {
    mockApi({});
    renderWithProviders(<SearchPage />, { route: "/" });
    expect(screen.getByLabelText("OEM-номер или артикул")).toBeVisible();
    expect(screen.queryByText("На моём складе")).not.toBeInTheDocument();
  });

  it("shows my stock while the supplier is still answering", async () => {
    mockApi({
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
    });
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      (input instanceof Request ? input.url : input.toString()).includes(
        "/api/search/suppliers/rossko",
      )
        ? new Promise<Response>(() => undefined)
        : base(input, init),
    );
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    const t = await screen.findByRole("table");
    expect(within(t).getByText("W 68/3")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Дешевле всего" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("hides zero stock with «В наличии»", async () => {
    mockApi({
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [],
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    const t = await screen.findByRole("table");
    expect(within(t).getByText("FILTRON")).toBeInTheDocument();
    const pill = screen.getByRole("button", { name: "В наличии" });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(within(t).queryByText("FILTRON")).not.toBeInTheDocument();
    expect(within(t).getByText("MANN")).toBeInTheDocument();
  });

  it("re-requests the supplier when the same number is searched again", async () => {
    let calls = 0;
    mockApi({
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => {
        calls += 1;
        return supplierResult({ groups: [] });
      },
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    await waitFor(() => {
      expect(calls).toBe(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(calls).toBe(2);
    });
  });
});
