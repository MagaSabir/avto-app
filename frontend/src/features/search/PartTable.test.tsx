import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { PartGroup } from "@/api/search";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { offer, partGroup } from "@/test/searchFixtures";

import type { Best, SortMode } from "./derive";
import { PartTable, type OnToStock } from "./PartTable";

const now = new Date(2026, 9, 24, 9, 0);
const at = (day: number, h: number) =>
  new Date(2026, 9, day, h, 0).toISOString();
const term = (day: number) => ({
  delivery_from: at(day, 10),
  delivery_to: at(day, 18),
});

const partner = offer({
  warehouse: "Партнерский склад",
  stock_id: "p",
  qty: 1000,
  purchase_price: "513.00",
  ...term(31),
});
const grozny = offer({
  warehouse: "Грозный",
  stock_id: "g",
  qty: 2,
  purchase_price: "548.00",
  ...term(24),
});
const krasnodar = offer({
  warehouse: "Краснодар",
  stock_id: "k",
  qty: 14,
  purchase_price: "560.00",
  ...term(27),
});
const moscow = offer({
  warehouse: "Москва",
  stock_id: "m",
  qty: 40,
  purchase_price: "571.00",
  ...term(29),
});
const mann = partGroup({
  brand: "Mann",
  number: "W 68/3",
  number_norm: "W683",
  name: "Фильтр масляный",
  key: "MANN|W683",
  offers: [moscow, grozny, partner, krasnodar],
});
const big = partGroup({
  brand: "BIG",
  number: "GB-1155",
  number_norm: "GB1155",
  name: "Фильтр масляный",
  key: "BIG|GB1155",
  is_requested: false,
  analog_of: ["MANN|W683"],
  offers: [offer({ warehouse: "Грозный", purchase_price: "165.00" })],
});

const noBest = { cheapest: null, fastest: null };

type Over = {
  title?: "Оригинал" | "Аналоги";
  groups?: PartGroup[];
  supplier?: { code: string; title: string };
  sort?: SortMode;
  best?: { cheapest: Best | null; fastest: Best | null };
  stockQty?: (key: string) => number;
  limit?: number;
  onToStock?: OnToStock;
};

function table(o: Over): ReactElement {
  return (
    <PartTable
      title={o.title ?? "Оригинал"}
      groups={o.groups ?? [mann]}
      supplier={o.supplier ?? { code: "rossko", title: "Росско" }}
      sort={o.sort ?? "price"}
      best={o.best ?? noBest}
      stockQty={o.stockQty ?? (() => 0)}
      now={now}
      limit={o.limit}
      onToStock={o.onToStock ?? vi.fn()}
    />
  );
}

function setup(o: Over = {}, extra: Parameters<typeof mockApi>[0] = {}) {
  mockApi({ "GET /api/cart": () => ({ items: [], total: "0.00" }), ...extra });
  const r = renderWithProviders(table(o), { route: "/" });
  // Re-render inside the same providers.
  const update = (next: Over) => {
    r.rerender(
      <QueryClientProvider client={r.queryClient}>
        <MemoryRouter>{table(next)}</MemoryRouter>
      </QueryClientProvider>,
    );
  };
  return { ...r, update };
}

const rows = (name: string | RegExp = "Оригинал") =>
  within(screen.getByRole("region", { name })).getAllByRole("listitem");
const rowOf = (text: string) => {
  const li = screen.getByText(text).closest("li");
  if (li === null) throw new Error(`no row for ${text}`);
  return li;
};

describe("PartTable", () => {
  it("centres the quantity header over the actions column", () => {
    setup();
    expect(screen.getByText("Количество")).toHaveClass("text-center");
  });

  it("shows one row per part, not per warehouse", () => {
    setup({ groups: [mann, { ...big, is_requested: true }] });
    expect(rows()).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Оригинал" })).toBeVisible();
  });

  it("shows the default warehouse and a link to the others", () => {
    setup();
    const row = rowOf("W 68/3");
    expect(within(row).getByText("склад партнёра")).toBeInTheDocument();
    expect(within(row).getByText("513 ₽")).toBeInTheDocument();
    expect(within(row).getByText("1000 шт")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "и ещё 3 склада ▾" }),
    ).toBeInTheDocument();
  });

  it("renders the number in the regular font", () => {
    setup();
    expect(screen.getByText("W 68/3")).not.toHaveClass("font-mono");
  });

  it("picks another warehouse from the list", () => {
    setup();
    const row = rowOf("W 68/3");
    fireEvent.click(within(row).getByRole("button", { name: /и ещё 3/ }));
    const list = within(row).getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent("склад партнёра");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    fireEvent.click(within(list).getByRole("option", { name: /Грозный/ }));
    expect(within(row).queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(row).getByText("548 ₽")).toBeInTheDocument();
    expect(within(row).getByText("сегодня 10:00–18:00")).toBeInTheDocument();
    expect(within(row).getByText("Грозный")).toBeInTheDocument();
  });

  it("closes the list with Escape", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /и ещё 3/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list on a click outside", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /и ещё 3/ }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("has no link with a single warehouse", () => {
    setup({ groups: [big] });
    expect(
      within(rowOf("GB-1155")).queryByRole("button", { name: /и ещё/ }),
    ).not.toBeInTheDocument();
  });

  it("switches the default warehouse with the sort and drops a manual choice", () => {
    const { update } = setup();
    const row = rowOf("W 68/3");
    fireEvent.click(within(row).getByRole("button", { name: /и ещё 3/ }));
    fireEvent.click(within(row).getByRole("option", { name: /Москва/ }));
    expect(within(row).getByText("571 ₽")).toBeInTheDocument();
    update({ sort: "time" });
    expect(within(row).getByText("Грозный")).toBeInTheDocument();
    expect(within(row).getByText("548 ₽")).toBeInTheDocument();
    update({ sort: "price" });
    expect(within(row).getByText("513 ₽")).toBeInTheDocument();
  });

  it("marks the current offer when it is the best one", () => {
    setup({
      best: {
        cheapest: { group: mann, offer: partner },
        fastest: { group: mann, offer: grozny },
      },
    });
    const row = rowOf("W 68/3");
    expect(within(row).getByText("Дешевле всех")).toBeInTheDocument();
    expect(within(row).queryByText("Быстрее всех")).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: /и ещё 3/ }));
    fireEvent.click(within(row).getByRole("option", { name: /Грозный/ }));
    expect(within(row).getByText("Быстрее всех")).toBeInTheDocument();
    expect(within(row).queryByText("Дешевле всех")).not.toBeInTheDocument();
  });

  it("shows my stock of an analog", () => {
    setup({
      title: "Аналоги",
      groups: [big],
      stockQty: (key) => (key === "BIG|GB1155" ? 3 : 0),
    });
    expect(within(rowOf("GB-1155")).getByText("у вас 3 шт")).toBeVisible();
  });

  it("shows 20 analogs and more on request", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      partGroup({
        brand: `B${String(i)}`,
        number: `N${String(i)}`,
        key: `B${String(i)}|N${String(i)}`,
        is_requested: false,
        analog_of: ["MANN|W683"],
      }),
    );
    setup({ title: "Аналоги", groups: many, limit: 20 });
    expect(
      screen.getByRole("heading", { name: "Аналоги · 25" }),
    ).toBeInTheDocument();
    expect(rows(/^Аналоги/)).toHaveLength(20);
    fireEvent.click(
      screen.getByRole("button", { name: /Показать ещё 20 \(из 25\)/ }),
    );
    expect(rows(/^Аналоги/)).toHaveLength(25);
    expect(
      screen.queryByRole("button", { name: /Показать ещё/ }),
    ).not.toBeInTheDocument();
  });

  it("orders the rows by the current sort", () => {
    const slow = partGroup({
      brand: "SLOW",
      key: "SLOW|1",
      offers: [offer({ purchase_price: "100.00", delivery_days: 6 })],
    });
    const quick = partGroup({
      brand: "QUICK",
      key: "QUICK|1",
      offers: [offer({ purchase_price: "900.00", ...term(24) })],
    });
    const { update } = setup({ groups: [quick, slow] });
    const brands = () =>
      rows().map((r) => (r.textContent.includes("SLOW") ? "slow" : "quick"));
    expect(brands()).toEqual(["slow", "quick"]);
    update({ groups: [quick, slow], sort: "time" });
    expect(brands()).toEqual(["quick", "slow"]);
  });

  it("shows a part without offers", () => {
    setup({ groups: [partGroup({ offers: [] })] });
    const row = rowOf("333114");
    expect(within(row).getByText("нет предложений")).toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "В корзину" }),
    ).not.toBeInTheDocument();
  });

  it("passes the part and supplier title to the receipt", () => {
    const onToStock = vi.fn();
    setup({ onToStock });
    fireEvent.click(screen.getByRole("button", { name: "Принять на склад" }));
    expect(onToStock).toHaveBeenCalledWith(mann, partner, "Росско");
  });

  describe("Mikado delivery variants", () => {
    const variantsRow = offer({
      warehouse: "Варианты поставки",
      kind: "variants",
      stock_id: "",
      qty: 0,
      purchase_price: "504.00",
      order_code: "gto1",
    });
    const answer = {
      code: "mikado",
      title: "Микадо",
      status: "ok",
      message: "Цены на сегодня",
      markup: "20.00",
      offers: [
        offer({
          stock_id: "gto1#1",
          kind: "order",
          qty: 0,
          warehouse: "Склад №1004",
          delivery_days: 2,
          rating: 97,
          purchase_price: "520.00",
        }),
        offer({
          stock_id: "gto1#2",
          kind: "normal",
          warehouse: "Москва",
          delivery_days: 1,
          rating: 100,
          purchase_price: "530.00",
        }),
      ],
    };

    function mikado(calls: string[] = []) {
      setup(
        {
          supplier: { code: "mikado", title: "Микадо" },
          groups: [partGroup({ brand: "TOYOTA", offers: [variantsRow] })],
        },
        {
          "GET /api/search/suppliers/mikado/variants": (_i, url) => {
            calls.push(url.searchParams.get("order_code") ?? "");
            return answer;
          },
        },
      );
      return rowOf("333114");
    }

    it("waits for a variant before the actions work", () => {
      const row = mikado();
      expect(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      ).toBeInTheDocument();
      expect(within(row).getByText("от 504 ₽")).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "В корзину" }),
      ).toBeDisabled();
      expect(
        within(row).getByRole("button", { name: "Принять на склад" }),
      ).toBeDisabled();
    });

    it("returns from the variants to all warehouses", async () => {
      const ekb = offer({
        warehouse: "Екатеринбург",
        stock_id: "e",
        purchase_price: "490.00",
        ...term(26),
      });
      setup(
        {
          supplier: { code: "mikado", title: "Микадо" },
          groups: [partGroup({ brand: "TOYOTA", offers: [variantsRow, ekb] })],
        },
        { "GET /api/search/suppliers/mikado/variants": () => answer },
      );
      const row = rowOf("333114");
      expect(within(row).getByText("490 ₽")).toBeInTheDocument();
      fireEvent.click(
        within(row).getByRole("button", { name: "и ещё 1 склад ▾" }),
      );
      fireEvent.click(
        within(row).getByRole("option", { name: /варианты поставки/ }),
      );
      fireEvent.click(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      );
      fireEvent.click(
        await within(row).findByRole("option", { name: /Под заказ/ }),
      );
      expect(within(row).getByText("520 ₽")).toBeInTheDocument();
      fireEvent.click(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      );
      const options = within(row).getAllByRole("option");
      expect(options[0]).toHaveTextContent("← все склады");
      fireEvent.click(options[0]);
      expect(within(row).getByText("490 ₽")).toBeInTheDocument();
      fireEvent.click(
        within(row).getByRole("button", { name: "и ещё 1 склад ▾" }),
      );
      expect(
        within(row).getByRole("listbox", { name: "Склады" }),
      ).toBeInTheDocument();
    });

    it("has no way back without other warehouses", async () => {
      const row = mikado();
      fireEvent.click(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      );
      await within(row).findByRole("option", { name: /Под заказ/ });
      expect(
        within(row).queryByRole("option", { name: "← все склады" }),
      ).not.toBeInTheDocument();
    });

    it("asks for the variants on opening and takes the chosen one", async () => {
      const calls: string[] = [];
      const row = mikado(calls);
      fireEvent.click(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      );
      const option = await within(row).findByRole("option", {
        name: /Под заказ/,
      });
      expect(calls).toEqual(["gto1"]);
      expect(within(row).getByText("Цены на сегодня")).toBeInTheDocument();
      expect(option).toHaveTextContent("97 %");
      fireEvent.click(option);
      expect(within(row).queryByRole("listbox")).not.toBeInTheDocument();
      expect(within(row).getByText("520 ₽")).toBeInTheDocument();
      expect(within(row).getByText("2 дн.")).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "В корзину" }),
      ).toBeEnabled();
      fireEvent.click(
        within(row).getByRole("button", { name: "варианты поставки ▾" }),
      );
      expect(
        within(row).getByRole("option", { name: /Под заказ/ }),
      ).toHaveAttribute("aria-selected", "true");
    });
  });
});
