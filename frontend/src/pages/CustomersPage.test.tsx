import { act, fireEvent, screen, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerBrief, CustomerSaved } from "@/api/customers";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CustomersPage } from "./CustomersPage";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ivan: CustomerBrief = {
  id: 5,
  name: "Иван Тест",
  phones: ["79000000001"],
  cars: [{ id: 1, make: "Test", model: "X1", plate: "A000AA" }],
  last_purchase_at: null,
  last_car_id: null,
};

const petr: CustomerBrief = {
  id: 6,
  name: "Пётр Тест",
  phones: [],
  cars: [
    { id: 2, make: "Demo", model: "A", plate: null },
    { id: 3, make: "Demo", model: "B", plate: "А123ВС77" },
    { id: 4, make: "Demo", model: "C", plate: null },
  ],
  last_purchase_at: "2026-10-28T09:00:00Z",
  last_car_id: 3,
};

function Where() {
  const location = useLocation();
  return (
    <>
      <p data-testid="where">{location.pathname}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </>
  );
}

function setup(list: (q: string) => CustomerBrief[], extra = {}) {
  const queries: string[] = [];
  mockApi({
    "GET /api/customers/count": () => ({ total: 128 }),
    "GET /api/customers": (_init, url) => {
      const q = url.searchParams.get("q") ?? "";
      queries.push(q);
      return list(q);
    },
    ...extra,
  });
  renderWithProviders(
    <Routes>
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route: "/customers" },
  );
  return queries;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("CustomersPage", () => {
  it("lists customers linking to the card", async () => {
    setup(() => [ivan]);
    await flush();
    const link = screen.getByRole("link", { name: /Иван Тест/ });
    expect(link).toHaveAttribute("href", "/customers/5");
    expect(link).toHaveTextContent("+7 900 000-00-01");
    expect(link).toHaveTextContent("Test X1 A000AA");
  });

  it("shows labelled columns, a make badge and a plate frame", async () => {
    setup(() => [ivan]);
    await flush();
    expect(screen.getByText("Клиент")).toBeInTheDocument();
    expect(screen.getByText("Телефоны")).toBeInTheDocument();
    expect(screen.getByText("Машина")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Иван Тест/ });
    expect(within(link).getByText("Test")).toHaveClass("bg-info-bg");
    expect(
      within(link).getByText("A000AA").closest("[data-plate]"),
    ).not.toBeNull();
  });

  it("numbers the rows and shows the total", async () => {
    setup(() => [ivan, petr]);
    await flush();
    expect(screen.getByText("всего 128")).toBeInTheDocument();
    const rows = screen.getAllByRole("link", { name: /Тест/ });
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
  });

  it("shows only the car of the last purchase and how many more", async () => {
    setup(() => [petr]);
    await flush();
    const row = screen.getByRole("link", { name: /Пётр Тест/ });
    expect(row).toHaveTextContent("Demo B");
    expect(row).not.toHaveTextContent("Demo A");
    expect(row).toHaveTextContent("+2");
    expect(within(row).getByText("28.10.2026")).toBeInTheDocument();
  });

  it("falls back to the first car and a dash without purchases", async () => {
    setup(() => [ivan]);
    await flush();
    const row = screen.getByRole("link", { name: /Иван Тест/ });
    expect(row).toHaveTextContent("Test X1");
    expect(within(row).queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    expect(screen.getByText("Последняя покупка")).toBeInTheDocument();
    expect(within(row).getAllByText("—").length).toBe(1);
  });

  it("loads more customers and keeps numbering", async () => {
    const many: CustomerBrief[] = Array.from({ length: 53 }, (_, i) => ({
      ...ivan,
      id: 100 + i,
      name: `Клиент Тест ${String(i + 1)}`,
    }));
    const offsets: string[] = [];
    mockApi({
      "GET /api/customers/count": (_init, url) => ({
        total: url.searchParams.get("q") ? 53 : 128,
      }),
      "GET /api/customers": (_init, url) => {
        const offset = Number(url.searchParams.get("offset") ?? "0");
        offsets.push(String(offset));
        return many.slice(offset, offset + 50);
      },
    });
    renderWithProviders(<CustomersPage />, { route: "/customers" });
    await flush();
    expect(screen.getAllByRole("link", { name: /Клиент Тест/ })).toHaveLength(
      50,
    );
    expect(screen.getByText("показано 50 из 128")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await flush();
    const rows = screen.getAllByRole("link", { name: /Клиент Тест/ });
    expect(rows).toHaveLength(53);
    expect(within(rows[50]).getByText("51")).toBeInTheDocument();
    expect(offsets).toEqual(["0", "50"]);
    expect(
      screen.queryByRole("button", { name: "Показать ещё" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer more when everything fits", async () => {
    setup(() => [ivan]);
    await flush();
    expect(
      screen.queryByRole("button", { name: "Показать ещё" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    setup(() => []);
    await flush();
    expect(screen.getByText("Клиентов пока нет")).toBeInTheDocument();
  });

  it("searches with debounce and shows the not-found state", async () => {
    const queries = setup((q) => (q === "" ? [ivan] : []));
    await flush();
    fireEvent.change(screen.getByLabelText("Поиск клиента"), {
      target: { value: "  000  " },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(queries).toEqual([""]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(queries).toEqual(["", "000"]);
    await flush();
    expect(screen.getByText("Никого не нашли")).toBeInTheDocument();
  });

  it("creates a customer and opens the card", async () => {
    const bodies: unknown[] = [];
    const saved: CustomerSaved = {
      id: 9,
      name: "Пётр Тест",
      comment: null,
      phones: ["79000000002"],
      cars: [],
      created_at: "2026-10-29T10:00:00Z",
      warnings: ["Телефон +7 900 000-00-02 уже есть у клиента «Пётр»"],
    };
    setup(() => [], {
      "POST /api/customers": (init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify(saved), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Новый клиент" }));
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Пётр Тест" },
    });
    fireEvent.change(screen.getByLabelText("Телефон"), {
      target: { value: "+7 900 000-00-02" },
    });
    fireEvent.change(screen.getByLabelText("Комментарий"), {
      target: { value: "тест" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    await flush();
    expect(screen.getByTestId("where")).toHaveTextContent("/customers/9");
    expect(JSON.parse(screen.getByTestId("state").textContent)).toEqual({
      warnings: saved.warnings,
    });
    expect(bodies).toEqual([
      { name: "Пётр Тест", comment: "тест", phones: ["+7 900 000-00-02"] },
    ]);
  });

  it("shows the server message when creation fails", async () => {
    setup(() => [], {
      "POST /api/customers": () =>
        new Response(JSON.stringify({ message: "Неверный телефон" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Новый клиент" }));
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Пётр Тест" },
    });
    fireEvent.change(screen.getByLabelText("Телефон"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Неверный телефон");
    expect(screen.queryByTestId("where")).toBeNull();
  });
});
