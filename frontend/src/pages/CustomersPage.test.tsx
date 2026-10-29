import { act, fireEvent, screen } from "@testing-library/react";
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
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(list: (q: string) => CustomerBrief[], extra = {}) {
  const queries: string[] = [];
  mockApi({
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
      warnings: [],
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
