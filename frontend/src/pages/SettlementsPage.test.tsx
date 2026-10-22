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

function setup(answer: (url: URL) => object) {
  const urls: URL[] = [];
  mockApi({
    "GET /api/suppliers/rossko/settlements": (_init, url) => {
      urls.push(url);
      return answer(url);
    },
  });
  renderWithProviders(<SettlementsPage />, { route: "/settlements" });
  return urls;
}

describe("SettlementsPage", () => {
  it("shows the title, settlement kind, balance and the contractor tab", async () => {
    setup(() =>
      settlements({
        balance: "-1250.40",
        kind: "Лимит кредит",
        customers: [{ id: "c1", name: "ЧАСТНОЕ ЛИЦО", balance: "-1250.40" }],
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Взаиморасчёты" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Лимит кредит")).toBeInTheDocument();
    expect(screen.getAllByText(/^−1\s250,40 ₽$/).length).toBe(1);
    const tab = screen.getByRole("tab");
    expect(tab).toHaveTextContent("−1 250,40");
    expect(tab).toHaveTextContent("ЧАСТНОЕ ЛИЦО");
  });

  it("filters by status from the first page", async () => {
    const urls = setup(() =>
      settlements({ documents_total: 1, documents: [doc(1)] }),
    );
    await screen.findByText("Документ 1");
    fireEvent.change(screen.getByLabelText("Статус"), {
      target: { value: "Оплачено" },
    });
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get("status")).toBe("Оплачено");
    });
    expect(urls.at(-1)?.searchParams.get("page")).toBe("0");
  });

  it("filters by period only when both dates are set, and resets", async () => {
    const urls = setup(() =>
      settlements({ documents_total: 1, documents: [doc(1)] }),
    );
    await screen.findByText("Документ 1");
    fireEvent.change(screen.getByLabelText("Период с"), {
      target: { value: "2026-10-01" },
    });
    expect(urls.at(-1)?.searchParams.has("start")).toBe(false);
    fireEvent.change(screen.getByLabelText("по"), {
      target: { value: "2026-10-22" },
    });
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get("start")).toBe("2026-10-01");
    });
    expect(urls.at(-1)?.searchParams.get("end")).toBe("2026-10-22");
    fireEvent.click(screen.getByRole("button", { name: "Сбросить период" }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.has("start")).toBe(false);
    });
  });

  it("shows the overdue line only with data", async () => {
    setup(() =>
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
    );
    expect(await screen.findByText(/^Просрочено:/)).toHaveTextContent(
      "Просрочено: 500,00 ₽ · 3 дн.",
    );
    expect(screen.getByText(/График платежей/)).toHaveTextContent(
      "25.10.2026 — 750,40 ₽",
    );
  });

  it("hides the overdue line without data", async () => {
    setup(() => settlements());
    await screen.findByText("Оплата по факту");
    expect(screen.queryByText(/^Просрочено:/)).not.toBeInTheDocument();
  });

  it("loads more documents until all are shown", async () => {
    setup((url) =>
      url.searchParams.get("page") === "1"
        ? settlements({ documents_total: 3, page: 1, documents: [doc(3)] })
        : settlements({ documents_total: 3, documents: [doc(1), doc(2)] }),
    );
    expect(await screen.findByText("Документ 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText("Документ 3")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Показать ещё" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes from the first page", async () => {
    const urls = setup(() =>
      settlements({ documents_total: 1, documents: [doc(1)] }),
    );
    await screen.findByText("Документ 1");
    const before = urls.length;
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => {
      expect(urls.length).toBeGreaterThan(before);
    });
    expect(urls.every((u) => u.searchParams.get("page") === "0")).toBe(true);
  });

  it("shows the Rossko error with a retry button", async () => {
    let fail = true;
    setup(() =>
      fail
        ? {
            ...settlements(),
            status: "error",
            message: "Росско не ответил за 15 с",
            data: null,
          }
        : settlements({ documents_total: 1, documents: [doc(1)] }),
    );
    expect(
      await screen.findByText("Росско не ответил за 15 с"),
    ).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Документ 1")).toBeInTheDocument();
  });
});
