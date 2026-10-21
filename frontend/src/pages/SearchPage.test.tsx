import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import {
  offer,
  partGroup,
  stockItem,
  supplierResult,
} from "@/test/searchFixtures";

import { Route, Routes, useLocation, useNavigate } from "react-router";

import { Layout } from "@/app/Layout";
import { setLastSearch } from "@/features/search/lastSearch";

import { SearchPage } from "./SearchPage";

function Where() {
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="where">{useLocation().search}</output>
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
      >
        history-back
      </button>
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  setLastSearch("");
});

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// Lets a test answer supplier requests itself (e.g. hold one back).
function routeSupplier(
  answer: (q: string) => Promise<Response> | Response,
): void {
  const base = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
      "http://localhost",
    );
    return url.pathname === "/api/search/suppliers/rossko"
      ? Promise.resolve(answer(url.searchParams.get("q") ?? ""))
      : base(input, init);
  });
}

function deferred() {
  let resolve: (r: Response) => void = () => undefined;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const isBefore = (a: HTMLElement, b: HTMLElement) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

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

  it("re-requests the supplier and shows loading again on the same number", async () => {
    let lists = 0;
    mockApi({
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => {
        lists += 1;
        return [{ code: "rossko", title: "Росско" }];
      },
    });
    let calls = 0;
    const second = deferred();
    routeSupplier(() => {
      calls += 1;
      return calls === 1
        ? json(supplierResult({ groups: [] }))
        : second.promise;
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    const cheap = screen.getByRole("region", { name: "Дешевле всего" });
    await waitFor(() => {
      expect(cheap).toHaveAttribute("aria-busy", "false");
    });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    expect(
      screen.getByRole("region", { name: "Дешевле всего" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Росско · ждём ответ…")).toBeInTheDocument();
    expect(lists).toBe(1);
  });

  it("orders analog groups by delivery with «Срок»", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3_600_000).toISOString();
    mockApi({
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          groups: [
            partGroup(),
            partGroup({
              brand: "SLOWCHEAP",
              number_norm: "S1",
              is_requested: false,
              analog_of: ["KYB|333114"],
              offers: [
                offer({
                  purchase_price: "1000.00",
                  price: "9000.00",
                  delivery_days: 6,
                }),
              ],
            }),
            partGroup({
              brand: "FASTDEAR",
              number_norm: "F1",
              is_requested: false,
              analog_of: ["KYB|333114"],
              offers: [
                offer({
                  purchase_price: "5000.00",
                  price: "100.00",
                  delivery_from: soon,
                }),
              ],
            }),
          ],
        }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    const slow = await screen.findByText("SLOWCHEAP");
    expect(isBefore(slow, screen.getByText("FASTDEAR"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Срок" }));
    expect(
      isBefore(screen.getByText("FASTDEAR"), screen.getByText("SLOWCHEAP")),
    ).toBe(true);
  });

  it("hides analogs in my stock and at the supplier with «Аналоги»", async () => {
    mockApi({
      "GET /api/search": () => ({ ...stock, items: [stockItem(1)] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          groups: [
            partGroup(),
            partGroup({
              brand: "ANALOGBRAND",
              number_norm: "290074",
              is_requested: false,
              analog_of: ["KYB|333114"],
            }),
          ],
          stock_matches: [
            stockItem(9, {
              number_raw: "290 074",
              number_norm: "290074",
              brand: "SACHS",
            }),
          ],
        }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    expect(await screen.findByText("ANALOGBRAND")).toBeInTheDocument();
    expect(screen.getAllByText("290 074").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Аналоги" }));
    expect(screen.queryByText("ANALOGBRAND")).not.toBeInTheDocument();
    expect(screen.queryByText("290 074")).not.toBeInTheDocument();
  });

  it("never shows a stale supplier answer for an older number", async () => {
    mockApi({
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
    });
    const late = deferred();
    routeSupplier((q) =>
      q === "A1"
        ? late.promise
        : json(
            supplierResult({
              groups: [partGroup({ brand: "BRAND-B2", number: "B2" })],
            }),
          ),
    );
    renderWithProviders(<SearchPage />, { route: "/?q=A1" });
    await screen.findByText("Росско · ждём ответ…");
    const input = screen.getByLabelText("OEM-номер или артикул");
    fireEvent.change(input, { target: { value: "B2" } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    expect(await screen.findByText("BRAND-B2")).toBeInTheDocument();
    late.resolve(
      json(
        supplierResult({
          groups: [partGroup({ brand: "BRAND-A1", number: "A1" })],
        }),
      ),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("BRAND-A1")).not.toBeInTheDocument();
    expect(screen.getByText("BRAND-B2")).toBeInTheDocument();
  });

  it("shows the stock error instead of endless loading", async () => {
    mockApi({
      "GET /api/search": () =>
        new Response(JSON.stringify({ detail: "Ошибка базы" }), {
          status: 500,
        }),
      "GET /api/search/suppliers": () => [],
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    expect(await screen.findByText("Ошибка базы")).toBeInTheDocument();
    const mine = screen.getByRole("region", { name: "Мой склад" });
    expect(mine).toHaveAttribute("aria-busy", "false");
    expect(within(mine).getByText("—")).toBeInTheDocument();
  });

  describe("two parts under one number", () => {
    const mann = "MANN|W683";
    const answer = supplierResult({
      groups: [
        partGroup({
          brand: "Mann",
          number: "W 68/3",
          number_norm: "W683",
          name: "Фильтр масляный",
          key: mann,
          offers: [offer({ purchase_price: "710.00", price: "860.00" })],
        }),
        partGroup({
          brand: "MGA",
          number: "W68/3",
          number_norm: "W683",
          name: "Насос водяной",
          key: "MGA|W683",
          offers: [],
        }),
        partGroup({
          brand: "BOSCHMANN",
          number_norm: "F1",
          key: "BOSCHMANN|F1",
          is_requested: false,
          analog_of: [mann],
        }),
        partGroup({
          brand: "LUZARMGA",
          number_norm: "L1",
          key: "LUZARMGA|L1",
          is_requested: false,
          analog_of: ["MGA|W683"],
        }),
      ],
    });

    function setup(route: string) {
      mockApi({
        "GET /api/search": () => stock,
        "GET /api/search/suppliers": () => [
          { code: "rossko", title: "Росско" },
        ],
        "GET /api/search/suppliers/rossko": () => answer,
      });
      renderWithProviders(
        <>
          <SearchPage />
          <Where />
        </>,
        { route },
      );
    }

    it("asks to pick a part first, then shows only its offers", async () => {
      setup("/?q=W68/3");
      expect(await screen.findByText("Результаты поиска")).toBeInTheDocument();
      expect(screen.getByText("Росско · 2 детали")).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: "Дешевле всего" }),
      ).toHaveTextContent("выберите деталь");
      expect(
        screen.getByRole("region", { name: "Быстрее всего" }),
      ).toHaveTextContent("выберите деталь");
      expect(
        within(screen.getByRole("table")).getByText("W 68/3"),
      ).toBeInTheDocument();
      expect(screen.queryByText("BOSCHMANN")).not.toBeInTheDocument();
      expect(
        within(screen.getByRole("button", { name: /MGA W68\/3/ })).getByText(
          "нет в наличии",
        ),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Mann W 68\/3 Фильтр масляный/ }),
      );
      expect(screen.getByLabelText("where")).toHaveTextContent(
        `part=${encodeURIComponent(mann)}`,
      );
      expect(screen.queryByText("Результаты поиска")).not.toBeInTheDocument();
      expect(screen.getByText("BOSCHMANN")).toBeInTheDocument();
      expect(screen.queryByText("LUZARMGA")).not.toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: "Дешевле всего" }),
      ).toHaveTextContent("710 ₽");
      expect(screen.queryByText(/860/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("link", { name: "← все детали" }));
      expect(await screen.findByText("Результаты поиска")).toBeInTheDocument();
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
    });

    it("returns to the part list with browser Back", async () => {
      setup("/?q=W68/3");
      fireEvent.click(
        await screen.findByRole("button", {
          name: /Mann W 68\/3 Фильтр масляный/,
        }),
      );
      expect(await screen.findByText("BOSCHMANN")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "history-back" }));
      expect(await screen.findByText("Результаты поиска")).toBeInTheDocument();
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
    });

    it("shows supplier prices in my stock only for a chosen part", async () => {
      setup("/?q=W68/3");
      await screen.findByText("Результаты поиска");
      const row = within(screen.getByRole("table"))
        .getByText("W 68/3")
        .closest("tr");
      expect(row).not.toBeNull();
      expect(row?.lastElementChild).toHaveTextContent(/^—$/);
      expect(screen.queryByText(/дешевле/)).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: /Mann W 68\/3 Фильтр масляный/ }),
      );
      const [mine] = screen.getAllByRole("table");
      const chosen = within(mine).getByText("W 68/3").closest("tr");
      expect(chosen?.lastElementChild).toHaveTextContent("710 ₽");
      expect(chosen).toHaveTextContent("на 1 739,85 ₽ дешевле закупки");
    });

    it("shows the part list for an unknown part", async () => {
      setup("/?q=W68/3&part=NOPE|1");
      expect(await screen.findByText("Результаты поиска")).toBeInTheDocument();
    });

    it("drops the part on a new number", async () => {
      setup(`/?q=W68/3&part=${encodeURIComponent(mann)}`);
      expect(await screen.findByText("BOSCHMANN")).toBeInTheDocument();
      const input = screen.getByLabelText("OEM-номер или артикул");
      fireEvent.change(input, { target: { value: "W712" } });
      fireEvent.click(screen.getByRole("button", { name: "Найти" }));
      expect(screen.getByLabelText("where")).toHaveTextContent("?q=W712");
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
    });
  });

  it("goes straight to the offers with a single part", async () => {
    mockApi({
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => supplierResult(),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    expect(await screen.findByText("Росско · 1 деталь")).toBeInTheDocument();
    expect(screen.queryByText("Результаты поиска")).not.toBeInTheDocument();
    expect(screen.queryByText("← все детали")).not.toBeInTheDocument();
    expect(screen.getByText("Стойка амортизационная")).toBeInTheDocument();
  });

  it("shows the cheapest or the fastest offer in each row", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3_600_000).toISOString();
    mockApi({
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          groups: [
            partGroup({
              offers: [
                offer({
                  purchase_price: "900.00",
                  price: "100.00",
                  delivery_from: soon,
                }),
                offer({
                  purchase_price: "500.00",
                  price: "9000.00",
                  delivery_days: 6,
                }),
              ],
            }),
          ],
        }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    const toggle = await screen.findByRole("button", {
      name: "показать др. склады (1)",
    });
    const row = toggle.closest("li") as HTMLElement;
    expect(row).toHaveTextContent("500 ₽");
    expect(row).not.toHaveTextContent("900 ₽");
    fireEvent.click(screen.getByRole("button", { name: "Срок" }));
    expect(row).toHaveTextContent("900 ₽");
    expect(row).not.toHaveTextContent("500 ₽");
  });

  it("keeps the last search when coming back from the stock screen", async () => {
    let calls = 0;
    mockApi({
      "GET /api/health": () => ({ status: "ok", database: "ok" }),
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => {
        calls += 1;
        return supplierResult({
          groups: [
            partGroup({ brand: "Mann", key: "MANN|W683", name: "Фильтр" }),
            partGroup({ brand: "MGA", key: "MGA|W683", name: "Насос" }),
          ],
        });
      },
    });
    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <>
                <SearchPage />
                <Where />
              </>
            }
          />
          <Route path="/stock" element={<p>STOCK</p>} />
        </Route>
      </Routes>,
      { route: "/?q=W68/3" },
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Mann/ }));
    expect(await screen.findByText("Фильтр")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Склад" }));
    expect(await screen.findByText("STOCK")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Поиск" }));
    expect(await screen.findByText("Фильтр")).toBeInTheDocument();
    const where = screen.getByLabelText("where").textContent;
    expect(new URLSearchParams(where).get("q")).toBe("W68/3");
    expect(new URLSearchParams(where).get("part")).toBe("MANN|W683");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
  });
});
