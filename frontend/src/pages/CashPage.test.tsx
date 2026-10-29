import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CashOperation, CashOut, CashTotals } from "@/api/cash";
import { formatPrice } from "@/features/stock/format";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CashPage } from "./CashPage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 12));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const totals: CashTotals = {
  sales: "1580.00",
  returns: "540.00",
  revenue: "1040.00",
  cash: "540.00",
  transfer: "500.00",
  profit: "240.00",
  no_cost_count: 0,
  no_payment_count: 0,
  writeoffs: "0.00",
  writeoffs_no_cost_count: 0,
  profit_after_writeoffs: "240.00",
};

const sale: CashOperation = {
  move_id: 11,
  type: "sale",
  created_at: "2026-10-29T09:15:00Z",
  item_id: 7,
  number_raw: "W 68/3",
  brand: "MANN-FILTER",
  name: "Oil filter",
  qty: 2,
  price: "540.00",
  amount: "1080.00",
  payment: "cash",
  cost: "400.00",
  profit: "280.00",
  user: "demo",
};

function cashOut(over: Partial<CashOut> = {}): CashOut {
  return { totals, operations: [sale], ...over };
}

function setup(answer: () => CashOut, route = "/cash") {
  const urls: URL[] = [];
  mockApi({
    "GET /api/cash": (_init, url) => {
      urls.push(url);
      return answer();
    },
  });
  renderWithProviders(<CashPage />, { route });
  return urls;
}

// toHaveTextContent collapses non-breaking spaces from the number formatter.
function rub(v: string): string {
  return `${formatPrice(v)} ₽`.replace(/\s/g, " ");
}

function tile(label: string): HTMLElement {
  const el = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tile]"),
  ).find((t) => t.firstElementChild?.textContent === label);
  if (!el) throw new Error(`no tile ${label}`);
  return el;
}

describe("CashPage", () => {
  it("requests today by default", async () => {
    const urls = setup(() => cashOut());
    await screen.findByRole("link", { name: /W 68\/3/ });
    expect(urls[0].searchParams.get("start")).toBe("2026-10-29");
    expect(urls[0].searchParams.get("end")).toBe("2026-10-29");
    expect(screen.getByRole("button", { name: "Сегодня" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("с")).toHaveValue("2026-10-29");
    expect(screen.getByLabelText("по")).toHaveValue("2026-10-29");
  });

  it("switches to a preset period", async () => {
    const urls = setup(() => cashOut());
    await screen.findByRole("link", { name: /W 68\/3/ });
    fireEvent.click(screen.getByRole("button", { name: "Неделя" }));
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls[1].searchParams.get("start")).toBe("2026-10-23");
    expect(urls[1].searchParams.get("end")).toBe("2026-10-29");
    expect(screen.getByRole("button", { name: "Неделя" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("changing a date refetches", async () => {
    const urls = setup(() => cashOut());
    await screen.findByRole("link", { name: /W 68\/3/ });
    fireEvent.change(screen.getByLabelText("с"), {
      target: { value: "2026-10-01" },
    });
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls[1].searchParams.get("start")).toBe("2026-10-01");
  });

  it("moves the end along when the start passes it", async () => {
    const urls = setup(() => cashOut());
    await screen.findByRole("link", { name: /W 68\/3/ });
    fireEvent.change(screen.getByLabelText("с"), {
      target: { value: "2026-11-05" },
    });
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls[1].searchParams.get("start")).toBe("2026-11-05");
    expect(urls[1].searchParams.get("end")).toBe("2026-11-05");
  });

  it("moves the start back when the end goes before it", async () => {
    const urls = setup(() => cashOut());
    await screen.findByRole("link", { name: /W 68\/3/ });
    fireEvent.change(screen.getByLabelText("по"), {
      target: { value: "2026-10-20" },
    });
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls[1].searchParams.get("start")).toBe("2026-10-20");
    expect(urls[1].searchParams.get("end")).toBe("2026-10-20");
  });

  it("labels amounts in the phone card", async () => {
    setup(() => cashOut());
    const link = await screen.findByRole("link", { name: /W 68\/3/ });
    expect(link).toHaveTextContent(
      `2 шт × ${rub("540.00")} = ${rub("1080.00")}`,
    );
    expect(link).toHaveTextContent(`прибыль ${rub("280.00")}`);
  });

  it("shows the totals", async () => {
    setup(() =>
      cashOut({
        totals: {
          ...totals,
          no_cost_count: 2,
          writeoffs: "800.00",
          writeoffs_no_cost_count: 1,
          profit_after_writeoffs: "-560.00",
        },
      }),
    );
    await screen.findByRole("link", { name: /W 68\/3/ });
    expect(tile("Выручка")).toHaveTextContent(rub("1040.00"));
    expect(tile("Выручка")).toHaveTextContent(
      `продажи ${rub("1580.00")} · возвраты ${rub("540.00")}`,
    );
    expect(tile("Наличные")).toHaveTextContent(rub("540.00"));
    expect(tile("Перевод")).toHaveTextContent(rub("500.00"));
    expect(tile("Прибыль")).toHaveTextContent("без 2 старых операций");
    expect(tile("Списано")).toHaveTextContent("без 1 старых");
    const after = within(tile("Прибыль с учётом списаний")).getByText(
      rub("-560.00"),
    );
    expect(after).toHaveClass("text-status-out");
  });

  it("lists operations linking to the stock item", async () => {
    setup(() => cashOut());
    const link = await screen.findByRole("link", { name: /W 68\/3/ });
    expect(link).toHaveAttribute("href", "/stock?item=7");
    expect(link).toHaveTextContent("Продажа");
    expect(link).toHaveTextContent("Нал");
    expect(link).toHaveTextContent("demo");
    expect(link).toHaveTextContent(rub("1080.00"));
    expect(link).toHaveTextContent(rub("280.00"));
  });

  it("shows a dash for unknown profit", async () => {
    setup(() =>
      cashOut({
        operations: [{ ...sale, cost: null, profit: null, payment: null }],
      }),
    );
    const link = await screen.findByRole("link", { name: /W 68\/3/ });
    expect(within(link).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("says when there are no sales", async () => {
    setup(() => cashOut({ operations: [] }));
    expect(
      await screen.findByText("За этот период продаж нет"),
    ).toBeInTheDocument();
    expect(screen.getByText("Выручка")).toBeInTheDocument();
  });
});
