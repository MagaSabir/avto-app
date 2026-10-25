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
  localStorage.clear();
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
    expect(screen.getByLabelText("OEM/Номер или артикул")).toBeVisible();
    expect(screen.queryByText("Мой склад")).not.toBeInTheDocument();
  });

  it("shows a waiting card while the supplier is still answering", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
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
    expect(await screen.findByText("Росско · ждём ответ…")).toBeInTheDocument();
    // The blocks belong to a chosen part (step 2).
    expect(
      screen.queryByRole("region", { name: "Мой склад" }),
    ).not.toBeInTheDocument();
  });

  it("re-requests the supplier and shows loading again on the same number", async () => {
    let lists = 0;
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
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
      return calls === 1 ? json(supplierResult()) : second.promise;
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    expect(
      await screen.findByRole("region", { name: "Дешевле всего" }),
    ).toHaveAttribute("aria-busy", "false");
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    expect(screen.getByText("Росско · ждём ответ…")).toBeInTheDocument();
    expect(lists).toBe(1);
  });

  it("orders analog groups by delivery with «Срок»", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3_600_000).toISOString();
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          groups: [
            partGroup(),
            partGroup({
              brand: "SLOWCHEAP",
              number_norm: "S1",
              key: "SLOWCHEAP|S1",
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
              key: "FASTDEAR|F1",
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
    fireEvent.change(screen.getByRole("combobox", { name: "Сортировка" }), {
      target: { value: "time" },
    });
    expect(
      isBefore(screen.getByText("FASTDEAR"), screen.getByText("SLOWCHEAP")),
    ).toBe(true);
  });

  it("hides the analogs table with «Показывать аналоги»", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [stockItem(1)] }),
      "GET /api/search/stock": (_init, url) => {
        expect(url.searchParams.getAll("numbers")).toEqual(["290074"]);
        return [
          stockItem(9, {
            number_raw: "290 074",
            number_norm: "290074",
            brand: "ANALOGBRAND",
            brand_key: "ANALOGBRAND",
          }),
        ];
      },
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          groups: [
            partGroup(),
            partGroup({
              brand: "ANALOGBRAND",
              number_norm: "290074",
              key: "ANALOGBRAND|290074",
              is_requested: false,
              analog_of: ["KYB|333114"],
            }),
          ],
        }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    expect(await screen.findByText("ANALOGBRAND")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Аналоги · 1" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("у вас 3 шт")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Показывать аналоги" }),
    );
    expect(screen.queryByText("ANALOGBRAND")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /^Аналоги/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Оригинал" }),
    ).toBeInTheDocument();
  });

  it("refreshes analog stock after a receipt without asking Rossko again", async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { showModal: realShowModal, close: realClose } =
      HTMLDialogElement.prototype;
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
    let received = false;
    let analogCalls = 0;
    let rosskoCalls = 0;
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/stock": () => {
        analogCalls += 1;
        return received
          ? [
              stockItem(9, {
                number_norm: "290074",
                qty: 5,
                brand: "SACHS",
                brand_key: "SACHS",
              }),
            ]
          : [];
      },
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => {
        rosskoCalls += 1;
        return supplierResult({
          groups: [
            partGroup(),
            partGroup({
              brand: "SACHS",
              number: "290074",
              number_norm: "290074",
              is_requested: false,
              key: "SACHS|290074",
              analog_of: ["KYB|333114"],
            }),
          ],
        });
      },
      "GET /api/stock/lookup": () => [],
      "GET /api/stock/brands": () => ["SACHS"],
      "GET /api/stock/suppliers": () => ["Росско"],
      "GET /api/settings": () => ({ default_markup: "25.00" }),
      "POST /api/stock/receipts": () => {
        received = true;
        return new Response(JSON.stringify({ item: { id: 9 }, move: {} }), {
          status: 201,
        });
      },
    });
    try {
      renderWithProviders(<SearchPage />, { route: "/?q=333114" });
      await screen.findByText("SACHS");
      await waitFor(() => {
        expect(analogCalls).toBe(1);
      });
      expect(screen.queryByText("у вас 5 шт")).not.toBeInTheDocument();
      const buttons = screen.getAllByRole("button", {
        name: "Принять на склад",
      });
      fireEvent.click(buttons[buttons.length - 1]);
      fireEvent.change(await screen.findByLabelText("Кол-во"), {
        target: { value: "5" },
      });
      await waitFor(() => {
        expect(
          screen.getByLabelText<HTMLInputElement>("Наценка, %").value,
        ).toBe("25");
      });
      fireEvent.click(screen.getByRole("button", { name: "Принять" }));
      expect(await screen.findByText("у вас 5 шт")).toBeInTheDocument();
      expect(analogCalls).toBe(2);
      expect(rosskoCalls).toBe(1);
    } finally {
      HTMLDialogElement.prototype.showModal = realShowModal;
      HTMLDialogElement.prototype.close = realClose;
    }
  });

  it("never shows a stale supplier answer for an older number", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
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
    const input = screen.getByLabelText("OEM/Номер или артикул");
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

  it("requests the supplier again when a number is searched anew via «Найти»", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
    });
    const asked: string[] = [];
    routeSupplier((q) => {
      asked.push(q);
      return json(supplierResult({ groups: [] }));
    });
    renderWithProviders(<SearchPage />, { route: "/?q=A1" });
    const input = screen.getByLabelText("OEM/Номер или артикул");
    await waitFor(() => {
      expect(asked).toEqual(["A1"]);
    });
    fireEvent.change(input, { target: { value: "B2" } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(asked).toEqual(["A1", "B2"]);
    });
    fireEvent.change(screen.getByLabelText("OEM/Номер или артикул"), {
      target: { value: "A1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    await waitFor(() => {
      expect(asked).toEqual(["A1", "B2", "A1"]);
    });
  });

  it("shows the stock error instead of endless loading", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () =>
        new Response(JSON.stringify({ detail: "Ошибка базы" }), {
          status: 500,
        }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => supplierResult(),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    const mine = await screen.findByRole("region", { name: "Мой склад" });
    expect(
      await within(mine).findByText("Склад недоступен"),
    ).toBeInTheDocument();
    expect(mine).toHaveAttribute("aria-busy", "false");
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
          offers: [],
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
      expect(
        await screen.findByRole("heading", { name: "Найдено 2 детали" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Дешевле всего" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("BOSCHMANN")).not.toBeInTheDocument();
      expect(
        within(screen.getByRole("button", { name: /MGA W68\/3/ })).getByText(
          "—",
        ),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Mann.*W 68\/3/ }));
      expect(screen.getByLabelText("where")).toHaveTextContent(
        `supplier=rossko&part=${encodeURIComponent(mann)}`,
      );
      expect(screen.queryByText("Найдено 2 детали")).not.toBeInTheDocument();
      expect(screen.getByText("BOSCHMANN")).toBeInTheDocument();
      expect(screen.queryByText("LUZARMGA")).not.toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: "Дешевле всего" }),
      ).toHaveTextContent("710 ₽");
      expect(screen.queryByText(/860/)).not.toBeInTheDocument();

      expect(
        screen.getByRole("heading", { name: /Mann W 68\/3.*Росско/ }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("heading", { name: /Mann W 68\/3/ })).getByText(
          "Росско",
        ),
      ).toHaveClass("bg-supplier-bg", "text-supplier");
      fireEvent.click(screen.getByRole("link", { name: "← Другие детали" }));
      expect(await screen.findByText("Найдено 2 детали")).toBeInTheDocument();
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
      expect(screen.getByLabelText("where")).not.toHaveTextContent("supplier=");
    });

    it("returns to the part list with browser Back", async () => {
      setup("/?q=W68/3");
      fireEvent.click(
        await screen.findByRole("button", {
          name: /Mann.*W 68\/3/,
        }),
      );
      expect(await screen.findByText("BOSCHMANN")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "history-back" }));
      expect(await screen.findByText("Найдено 2 детали")).toBeInTheDocument();
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
      expect(screen.getByLabelText("where")).not.toHaveTextContent("supplier=");
    });

    it("shows the part list for an unknown part", async () => {
      setup("/?q=W68/3&supplier=rossko&part=NOPE|1");
      expect(await screen.findByText("Найдено 2 детали")).toBeInTheDocument();
    });

    it("drops the part on a new number", async () => {
      setup(`/?q=W68/3&supplier=rossko&part=${encodeURIComponent(mann)}`);
      expect(await screen.findByText("BOSCHMANN")).toBeInTheDocument();
      const input = screen.getByLabelText("OEM/Номер или артикул");
      fireEvent.change(input, { target: { value: "W712" } });
      fireEvent.click(screen.getByRole("button", { name: "Найти" }));
      expect(screen.getByLabelText("where")).toHaveTextContent("?q=W712");
      expect(screen.getByLabelText("where")).not.toHaveTextContent("part=");
    });
  });

  describe("two suppliers", () => {
    const group = (brand: string, price: string, days: number) =>
      partGroup({
        brand,
        number: "W 68/3",
        number_norm: "W683",
        name: "Фильтр масляный",
        key: "MANN|W683",
        offers: [offer({ purchase_price: price, price, delivery_days: days })],
      });
    const analog = partGroup({
      brand: "BOSCHMANN",
      number_norm: "F1",
      key: "BOSCHMANN|F1",
      is_requested: false,
      analog_of: ["MANN|W683"],
      offers: [offer({ purchase_price: "50.00", price: "50.00" })],
    });

    function setup(route: string) {
      mockApi({
        "GET /api/cart": () => ({ items: [], total: "0.00" }),
        "GET /api/search": () => ({ ...stock, items: [] }),
        "GET /api/search/suppliers": () => [
          { code: "rossko", title: "Росско" },
          { code: "mikado", title: "Микадо" },
        ],
        "GET /api/search/suppliers/rossko": () =>
          supplierResult({ groups: [group("Mann", "200.00", 3), analog] }),
        "GET /api/search/suppliers/mikado": () =>
          supplierResult({
            code: "mikado",
            title: "Микадо",
            groups: [
              group("MANN-FILTER", "150.00", 1),
              partGroup({
                brand: "MIKANALOG",
                number_norm: "M1",
                key: "MIKANALOG|M1",
                is_requested: false,
                analog_of: ["MANN|W683"],
              }),
            ],
          }),
        "GET /api/search/stock": () => [],
      });
      renderWithProviders(
        <>
          <SearchPage />
          <Where />
        </>,
        { route },
      );
    }

    it("shows a card per supplier and opens the clicked one", async () => {
      setup("/?q=W68/3");
      expect(
        await screen.findByRole("heading", { name: "Найдено 2 детали" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /MANN-FILTER/ }));
      expect(screen.getByLabelText("where")).toHaveTextContent(
        "?q=W68%2F3&supplier=mikado&part=MANN%7CW683",
      );
      expect(screen.queryByText("Найдено 2 детали")).not.toBeInTheDocument();
    });

    it("shows only the chosen supplier's data on step 2", async () => {
      setup("/?q=W68/3");
      fireEvent.click(
        await screen.findByRole("button", { name: /Mann.*W 68\/3/ }),
      );
      expect(
        screen.getByRole("heading", { name: /Mann W 68\/3.*Росско/ }),
      ).toBeInTheDocument();
      expect(screen.getByText("BOSCHMANN")).toBeInTheDocument();
      expect(screen.queryByText("MIKANALOG")).not.toBeInTheDocument();
      expect(screen.queryByText("MANN-FILTER")).not.toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: "Дешевле всего" }),
      ).toHaveTextContent("50 ₽");
    });

    it("prices a card from the original when analogs are hidden", async () => {
      setup("/?q=W68/3");
      const card = await screen.findByRole("button", { name: /Mann.*W 68\/3/ });
      expect(card).toHaveTextContent("от 50 ₽");
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Показывать аналоги" }),
      );
      expect(
        screen.getByRole("button", { name: /Mann.*W 68\/3/ }),
      ).toHaveTextContent("от 200 ₽");
    });

    it("reorders the cards by delivery time", async () => {
      setup("/?q=W68/3");
      await screen.findByText("Найдено 2 детали");
      const order = () =>
        screen
          .getAllByRole("button", { name: /W 68\/3/ })
          .map((b) =>
            b.textContent.includes("MANN-FILTER") ? "mikado" : "rossko",
          );
      expect(order()).toEqual(["rossko", "mikado"]);
      fireEvent.change(screen.getByRole("combobox", { name: "Сортировка" }), {
        target: { value: "time" },
      });
      expect(order()).toEqual(["mikado", "rossko"]);
    });
  });

  describe("one card with a second supplier", () => {
    function setup(mikado: () => Promise<Response> | Response) {
      mockApi({
        "GET /api/cart": () => ({ items: [], total: "0.00" }),
        "GET /api/search": () => ({ ...stock, items: [] }),
        "GET /api/search/suppliers": () => [
          { code: "rossko", title: "Росско" },
          { code: "mikado", title: "Микадо" },
        ],
        "GET /api/search/suppliers/rossko": () => supplierResult(),
        "GET /api/search/stock": () => [],
      });
      const base = globalThis.fetch;
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        (input instanceof Request ? input.url : input.toString()).includes(
          "/api/search/suppliers/mikado",
        )
          ? Promise.resolve(mikado())
          : base(input, init),
      );
      return renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    }

    it("shows the picker with a skeleton while the other supplier answers", async () => {
      setup(() => new Promise<Response>(() => undefined));
      expect(
        await screen.findByRole("heading", { name: "Найдено 1 деталь" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Микадо · ждём ответ…")).toBeInTheDocument();
    });

    it("stays on step 2 when the other supplier is refetched", async () => {
      const again = deferred();
      let calls = 0;
      const { queryClient } = setup(() => {
        calls += 1;
        return calls === 1
          ? json(
              supplierResult({ code: "mikado", title: "Микадо", groups: [] }),
            )
          : again.promise;
      });
      expect(
        await screen.findByRole("heading", { name: /KYB 333114/ }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/^Найдено/)).not.toBeInTheDocument();
      void queryClient.refetchQueries({ queryKey: ["search", "supplier"] });
      await waitFor(() => {
        expect(calls).toBe(2);
      });
      expect(screen.queryByText(/^Найдено/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /KYB 333114/ }),
      ).toBeInTheDocument();
    });
  });

  it("goes straight to the offers with a single part", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => supplierResult(),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    expect(
      await screen.findByRole("heading", { name: /KYB 333114/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Найдено/)).not.toBeInTheDocument();
    expect(screen.queryByText("← Другие детали")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Оригинал" })).getByText(
        "Стойка амортизационная",
      ),
    ).toBeInTheDocument();
  });

  it("shows the cheapest or the fastest offer in each row", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3_600_000).toISOString();
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
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
    const original = await screen.findByRole("region", { name: "Оригинал" });
    expect(
      within(original).getByRole("button", { name: "и ещё 1 склад ▾" }),
    ).toBeInTheDocument();
    const shown = () => within(original).getByText(/^\d+ ₽$/).textContent;
    expect(shown()).toBe("500 ₽");
    fireEvent.change(screen.getByRole("combobox", { name: "Сортировка" }), {
      target: { value: "time" },
    });
    expect(shown()).toBe("900 ₽");
  });

  function renderApp(route: string) {
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
      { route },
    );
  }

  it("keeps the last search when coming back from the stock screen", async () => {
    let calls = 0;
    let stockCalls = 0;
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/health": () => ({ status: "ok", database: "ok" }),
      "GET /api/search": () => {
        stockCalls += 1;
        return stock;
      },
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
    renderApp("/?q=W68/3");
    fireEvent.click(await screen.findByRole("button", { name: /^Mann/ }));
    expect(
      await screen.findByRole("heading", { name: /^Mann/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Склад" }));
    expect(await screen.findByText("STOCK")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: "Поиск" })[0]);
    expect(
      await screen.findByRole("heading", { name: /^Mann/ }),
    ).toBeInTheDocument();
    const where = screen.getByLabelText("where").textContent;
    expect(new URLSearchParams(where).get("q")).toBe("W68/3");
    expect(new URLSearchParams(where).get("part")).toBe("MANN|W683");
    // My stock is refetched (quantities may have changed), Rossko is not.
    await waitFor(() => {
      expect(stockCalls).toBe(2);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
  });

  it("points the «Поиск» link at the current search right away", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/health": () => ({ status: "ok", database: "ok" }),
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": (_init, url) =>
        url.searchParams.get("q") === "W68/3"
          ? supplierResult({
              groups: [
                partGroup({ brand: "Mann", key: "MANN|W683", name: "Фильтр" }),
                partGroup({ brand: "MGA", key: "MGA|W683", name: "Насос" }),
              ],
            })
          : supplierResult(),
    });
    renderApp("/?q=W68/3");
    const link = () => {
      const href =
        screen
          .getAllByRole("link", { name: "Поиск" })[0]
          .getAttribute("href") ?? "";
      return new URLSearchParams(href.slice(href.indexOf("?")));
    };
    fireEvent.click(await screen.findByRole("button", { name: /^Mann/ }));
    expect(link().get("q")).toBe("W68/3");
    expect(link().get("part")).toBe("MANN|W683");
    const input = screen.getByLabelText("OEM/Номер или артикул");
    fireEvent.change(input, { target: { value: "333114" } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    expect(link().get("q")).toBe("333114");
    expect(link().get("part")).toBeNull();
  });
});

describe("SearchPage step 2 supplier error", () => {
  it("shows the chosen supplier's error, not another supplier's card", async () => {
    let rossko = 0;
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [
        { code: "rossko", title: "Росско" },
        { code: "mikado", title: "Микадо" },
      ],
      "GET /api/search/suppliers/rossko": () => {
        rossko += 1;
        return supplierResult({
          status: "error",
          message: "Росско не отвечает",
          groups: [],
        });
      },
      "GET /api/search/suppliers/mikado": () =>
        supplierResult({
          code: "mikado",
          title: "Микадо",
          groups: [partGroup({ brand: "MIKABRAND" })],
        }),
      "GET /api/search/stock": () => [],
    });
    renderWithProviders(
      <>
        <SearchPage />
        <Where />
      </>,
      { route: "/?q=333114&supplier=rossko&part=KYB%7C333114" },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Росско не отвечает",
    );
    expect(
      screen.getByRole("heading", { name: /KYB 333114.*Росско/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Оригинал" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("MIKABRAND")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(rossko).toBe(2);
    });
    fireEvent.click(screen.getByRole("link", { name: "← Другие детали" }));
    expect(screen.getByLabelText("where")).toHaveTextContent("?q=333114");
    expect(screen.getByLabelText("where")).not.toHaveTextContent("supplier=");
  });
});

describe("SearchPage Mikado orders", () => {
  it("always requests Mikado with with_orders=true", async () => {
    const calls: string[] = [];
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [
        { code: "rossko", title: "Росско" },
        { code: "mikado", title: "Микадо" },
      ],
      "GET /api/search/suppliers/rossko": (_i, url) => {
        calls.push(`rossko${url.search}`);
        return supplierResult();
      },
      "GET /api/search/suppliers/mikado": (_i, url) => {
        calls.push(`mikado${url.search}`);
        return supplierResult({ code: "mikado", title: "Микадо" });
      },
      "GET /api/search/stock": () => [],
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
    expect(calls.find((c) => c.startsWith("mikado"))).toContain(
      "with_orders=true",
    );
    expect(calls.find((c) => c.startsWith("rossko"))).not.toContain(
      "with_orders",
    );
  });
});

describe("SearchPage supplier choice", () => {
  function setup(calls: string[]) {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => stock,
      "GET /api/search/suppliers": () => [
        { code: "rossko", title: "Росско" },
        { code: "mikado", title: "Микадо" },
      ],
      "GET /api/search/suppliers/rossko": () => {
        calls.push("rossko");
        return supplierResult();
      },
      "GET /api/search/suppliers/mikado": () => {
        calls.push("mikado");
        return supplierResult({ code: "mikado", title: "Микадо" });
      },
      "GET /api/search/stock": () => [],
    });
  }

  it("does not ask a supplier that was not chosen", async () => {
    localStorage.setItem("search.suppliers", '["rossko"]');
    const calls: string[] = [];
    setup(calls);
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    await waitFor(() => {
      expect(calls).toContain("rossko");
    });
    await screen.findByRole("button", { name: /Поставщик: Росско$/ });
    expect(calls).not.toContain("mikado");
  });

  it("asks a supplier once it is checked and remembers the choice", async () => {
    localStorage.setItem("search.suppliers", '["rossko"]');
    const calls: string[] = [];
    setup(calls);
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    fireEvent.click(
      await screen.findByRole("button", { name: /Поставщик: Росско$/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Микадо" }));
    await waitFor(() => {
      expect(calls).toContain("mikado");
    });
    expect(localStorage.getItem("search.suppliers")).toBe(
      '["rossko","mikado"]',
    );
  });
});

describe("SearchPage no supplier cards", () => {
  const w683 = {
    ...stock,
    items: [
      stockItem(1, {
        number_raw: "W 68/3",
        number_norm: "W683",
        brand: "MANN",
        brand_key: "MANN",
        qty: 15,
        cell: "B-1",
      }),
    ],
  };

  it("shows my stock above «У поставщиков ничего не найдено»", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => w683,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => supplierResult({ groups: [] }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    const mine = await screen.findByRole("region", { name: "Мой склад" });
    expect(await within(mine).findByText("15 шт")).toBeInTheDocument();
    expect(within(mine).getByText("B-1")).toHaveClass("font-mono");
    expect(
      within(mine).getByRole("link", { name: "Открыть на складе →" }),
    ).toHaveAttribute("href", "/stock?item=1");
    const none = await screen.findByText("У поставщиков ничего не найдено");
    expect(isBefore(mine, none)).toBe(true);
    expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument();
  });

  it("shows my stock above the supplier errors with «Повторить»", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => w683,
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({
          status: "error",
          message: "Росско не отвечает",
          groups: [],
        }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    const error = await screen.findByText("Росско не отвечает");
    const mine = screen.getByRole("region", { name: "Мой склад" });
    expect(await within(mine).findByText("15 шт")).toBeInTheDocument();
    expect(isBefore(mine, error)).toBe(true);
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("У поставщиков ничего не найдено"),
    ).not.toBeInTheDocument();
  });

  it("says «Ничего не найдено» when my stock is empty too", async () => {
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () => supplierResult({ groups: [] }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=W68/3" });
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Мой склад" }),
    ).not.toBeInTheDocument();
  });
});

describe("SearchPage analog stock lookup", () => {
  it("asks for at most 200 analog numbers", async () => {
    const asked: string[][] = [];
    const analogs = Array.from({ length: 250 }, (_, i) =>
      partGroup({
        brand: "AN",
        number: `A${String(i)}`,
        number_norm: `A${String(i)}`,
        key: `AN|A${String(i)}`,
        is_requested: false,
        analog_of: ["KYB|333114"],
      }),
    );
    mockApi({
      "GET /api/cart": () => ({ items: [], total: "0.00" }),
      "GET /api/search": () => ({ ...stock, items: [] }),
      "GET /api/search/stock": (_init, url) => {
        asked.push(url.searchParams.getAll("numbers"));
        return [];
      },
      "GET /api/search/suppliers": () => [{ code: "rossko", title: "Росско" }],
      "GET /api/search/suppliers/rossko": () =>
        supplierResult({ groups: [partGroup(), ...analogs] }),
    });
    renderWithProviders(<SearchPage />, { route: "/?q=333114" });
    await waitFor(() => {
      expect(asked.length).toBeGreaterThan(0);
    });
    expect(asked[0]).toHaveLength(200);
    expect(asked[0]).toContain("A0");
    expect(asked[0]).not.toContain("A249");
  });
});
