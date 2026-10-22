import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SettlementDocument } from "@/api/settlements";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { settlements } from "@/test/settlementsFixtures";

import { SettlementsPage } from "./SettlementsPage";

function doc(n: number): SettlementDocument {
  return {
    date: "2026-10-20T09:15:28Z",
    name: `Документ ${String(n)}`,
    amount: "10.00",
    balance: "0.00",
    payer: "ИП Тестов",
    status: "Проведено",
    order_id: null,
    days_remaining: null,
    items: [],
  };
}

function setup(pages: Record<string, () => object>) {
  const calls: string[] = [];
  mockApi({
    "GET /api/suppliers/rossko/settlements": (_init, url) => {
      const page = url.searchParams.get("page") ?? "0";
      calls.push(page);
      const handler = pages[page] as (() => object) | undefined;
      if (!handler) throw new Error(`unexpected page ${page}`);
      return handler();
    },
  });
  renderWithProviders(<SettlementsPage />, { route: "/settlements" });
  return calls;
}

describe("SettlementsPage", () => {
  it("shows the account summary", async () => {
    setup({
      "0": () =>
        settlements({
          balance: "-1250.40",
          kind: "Лимит кредит",
          limit: "50000.00",
          payment_delay: 14,
        }),
    });
    expect(
      await screen.findByRole("heading", { name: "Взаиморасчёты" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Лимит кредит")).toBeInTheDocument();
    expect(screen.getByText(/^−1\s250,40 ₽$/)).toBeInTheDocument();
    expect(screen.getByText(/^50\s000,00 ₽$/)).toBeInTheDocument();
    expect(screen.getByText("14 дн.")).toBeInTheDocument();
  });

  it("hides the overdue block without data and shows it with data", async () => {
    setup({ "0": () => settlements() });
    await screen.findByText("Оплата по факту");
    expect(
      screen.queryByText("Просрочка и график платежей"),
    ).not.toBeInTheDocument();
  });

  it("shows overdue sum and payment schedule", async () => {
    setup({
      "0": () =>
        settlements({
          overdue_days: 3,
          overdue_sum: "500.00",
          payments: [
            {
              date: "2026-10-25",
              amount: "750.40",
              contractor: "ИП Тестов",
              contractor_debt: "750.40",
            },
          ],
        }),
    });
    expect(
      await screen.findByText("Просрочка и график платежей"),
    ).toBeInTheDocument();
    expect(screen.getByText("500,00 ₽ · 3 дн.")).toBeInTheDocument();
    expect(screen.getByText("25.10.2026")).toBeInTheDocument();
    expect(screen.getByText("750,40 ₽")).toBeInTheDocument();
  });

  it("loads more documents until all are shown", async () => {
    const calls = setup({
      "0": () =>
        settlements({ documents_total: 3, documents: [doc(1), doc(2)] }),
      "1": () =>
        settlements({ documents_total: 3, page: 1, documents: [doc(3)] }),
    });
    expect(await screen.findByText("Документ 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("Документ 3")).toBeInTheDocument();
    expect(calls).toContain("1");
    expect(
      screen.queryByRole("button", { name: "Показать ещё" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes from the first page", async () => {
    const calls = setup({
      "0": () => settlements({ documents_total: 1, documents: [doc(1)] }),
    });
    await screen.findByText("Документ 1");
    const before = calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(before);
    });
    expect(calls.every((p) => p === "0")).toBe(true);
  });

  it("shows the Rossko error with a retry button", async () => {
    let fail = true;
    setup({
      "0": () =>
        fail
          ? {
              ...settlements(),
              status: "error",
              message: "Росско не ответил за 15 с",
              data: null,
            }
          : settlements({ documents_total: 1, documents: [doc(1)] }),
    });
    expect(
      await screen.findByText("Росско не ответил за 15 с"),
    ).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Документ 1")).toBeInTheDocument();
  });
});
