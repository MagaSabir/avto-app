import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer, CustomerSaved, HistoryRow } from "@/api/customers";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CustomerPage } from "./CustomerPage";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

const customer: Customer = {
  id: 5,
  name: "Иван Тест",
  comment: "тестовый комментарий",
  phones: ["79000000001", "123"],
  cars: [
    {
      id: 11,
      make: "Test",
      model: "X1",
      engine: "1.6",
      vin: "TESTVIN0000000001",
      plate: "А000АА",
      year: 2010,
    },
    {
      id: 12,
      make: "Demo",
      model: "Y2",
      engine: null,
      vin: null,
      plate: null,
      year: null,
    },
  ],
  created_at: "2026-10-29T10:00:00Z",
};

const row: HistoryRow = {
  move_id: 1,
  type: "sale",
  created_at: "2026-10-28T10:00:00Z",
  item_id: 77,
  number_raw: "TEST-123",
  brand: "TESTBRAND",
  name: "Тестовая деталь",
  qty: 2,
  price: "100.00",
  amount: "200.00",
  payment: "cash",
  car: { id: 11, make: "Test", model: "X1", plate: "А000АА" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(
  extra: Record<
    string,
    (init: RequestInit, url: URL) => Response | object
  > = {},
  route: string | { pathname: string; state: unknown } = "/customers/5",
) {
  const historyQueries: (string | null)[] = [];
  mockApi({
    "GET /api/customers/5": () => customer,
    "GET /api/customers/5/history": (_init, url) => {
      historyQueries.push(url.searchParams.get("car_id"));
      return [row];
    },
    ...extra,
  });
  renderWithProviders(
    <Routes>
      <Route path="/customers/:id" element={<CustomerPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route },
  );
  return historyQueries;
}

describe("CustomerPage header", () => {
  it("shows name, tel links and comment", async () => {
    setup();
    expect(
      await screen.findByRole("heading", { name: "Иван Тест" }),
    ).toBeInTheDocument();
    const tel = screen.getByRole("link", { name: "+7 900 000-00-01" });
    expect(tel).toHaveAttribute("href", "tel:79000000001");
    expect(screen.getByRole("link", { name: "123" })).toHaveAttribute(
      "href",
      "tel:123",
    );
    expect(screen.getByText("тестовый комментарий")).toBeInTheDocument();
  });

  it("shows not found for an unknown customer", async () => {
    setup({
      "GET /api/customers/5": () => json({ message: "Клиент не найден" }, 404),
    });
    expect(await screen.findByText("Клиент не найден")).toBeInTheDocument();
  });

  it("shows creation warnings from navigation state", async () => {
    setup(
      {},
      {
        pathname: "/customers/5",
        state: {
          warnings: ["Телефон +7 900 000-00-01 уже есть у клиента «Пётр»"],
        },
      },
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "уже есть у клиента «Пётр»",
    );
  });
});

describe("CustomerPage editing", () => {
  it("edits name, phones and comment and shows warnings", async () => {
    const bodies: unknown[] = [];
    const saved: CustomerSaved = {
      ...customer,
      name: "Иван Новый",
      phones: ["79000000003"],
      comment: null,
      warnings: ["Телефон +7 900 000-00-03 уже есть у клиента «Пётр»"],
    };
    setup({
      "PATCH /api/customers/5": (init) => {
        bodies.push(JSON.parse(init.body as string));
        return saved;
      },
    });
    await screen.findByRole("heading", { name: "Иван Тест" });
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Иван Новый" },
    });
    // remove the second phone, change the first, add a new empty one (ignored)
    fireEvent.click(
      screen.getAllByRole("button", { name: "Убрать телефон" })[1],
    );
    fireEvent.change(screen.getByLabelText("Телефон 1"), {
      target: { value: "+7 900 000-00-03" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ телефон" }));
    fireEvent.change(screen.getByLabelText("Комментарий"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Телефон +7 900 000-00-03 уже есть",
    );
    expect(bodies).toEqual([
      { name: "Иван Новый", comment: null, phones: ["+7 900 000-00-03"] },
    ]);
    expect(
      screen.queryByRole("button", { name: "Сохранить" }),
    ).not.toBeInTheDocument();
  });

  it("shows the server message when saving fails", async () => {
    setup({
      "PATCH /api/customers/5": () =>
        json({ message: "Неверный телефон" }, 422),
    });
    await screen.findByRole("heading", { name: "Иван Тест" });
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный телефон",
    );
  });
});

describe("CustomerPage cars", () => {
  it("lists cars", async () => {
    setup();
    const list = await screen.findByRole("list", { name: "Машины" });
    expect(list).toHaveTextContent("Test X1 2010");
    expect(list).toHaveTextContent("1.6");
    expect(list).toHaveTextContent("TESTVIN0000000001");
    expect(list).toHaveTextContent("А000АА");
  });

  it("adds a car", async () => {
    const bodies: unknown[] = [];
    setup({
      "POST /api/customers/5/cars": (init) => {
        bodies.push(JSON.parse(init.body as string));
        return json({ ...customer.cars[0], id: 13 }, 201);
      },
    });
    await screen.findByRole("list", { name: "Машины" });
    fireEvent.click(screen.getByRole("button", { name: "Добавить машину" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Марка"), {
      target: { value: "Test" },
    });
    fireEvent.change(within(dialog).getByLabelText("Год"), {
      target: { value: "2015" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => {
      expect(bodies).toEqual([
        {
          make: "Test",
          model: null,
          year: 2015,
          engine: null,
          vin: null,
          plate: null,
        },
      ]);
    });
  });

  it("edits a car", async () => {
    const bodies: unknown[] = [];
    setup({
      "PATCH /api/customers/5/cars/12": (init) => {
        bodies.push(JSON.parse(init.body as string));
        return customer.cars[1];
      },
    });
    await screen.findByRole("list", { name: "Машины" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Изменить машину" })[1],
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Марка")).toHaveValue("Demo");
    fireEvent.change(within(dialog).getByLabelText("Госномер"), {
      target: { value: "В111ВВ" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => {
      expect(bodies).toEqual([
        {
          make: "Demo",
          model: "Y2",
          year: null,
          engine: null,
          vin: null,
          plate: "В111ВВ",
        },
      ]);
    });
  });

  it("shows the server message when a car is rejected", async () => {
    setup({
      "POST /api/customers/5/cars": () =>
        json({ message: "Укажите марку, VIN или госномер" }, 422),
    });
    await screen.findByRole("list", { name: "Машины" });
    fireEvent.click(screen.getByRole("button", { name: "Добавить машину" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Укажите марку, VIN или госномер",
    );
  });

  it("deletes a car after confirmation", async () => {
    let deleted = 0;
    setup({
      "DELETE /api/customers/5/cars/11": () => {
        deleted += 1;
        return new Response(null, { status: 204 });
      },
    });
    await screen.findByRole("list", { name: "Машины" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Удалить машину" })[0],
    );
    expect(deleted).toBe(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Test X1 А000АА");
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => {
      expect(deleted).toBe(1);
    });
  });
});

describe("CustomerPage history", () => {
  it("shows purchases linking to the stock item", async () => {
    setup();
    const link = await screen.findByRole("link", { name: /TEST-123/ });
    expect(link).toHaveAttribute("href", "/stock?item=77");
    expect(link).toHaveTextContent("TESTBRAND");
    expect(link).toHaveTextContent("Тестовая деталь");
    expect(link).toHaveTextContent("Test X1 А000АА");
  });

  it("filters by car", async () => {
    const queries = setup();
    await screen.findByRole("link", { name: /TEST-123/ });
    expect(queries).toEqual([null]);
    fireEvent.change(screen.getByLabelText("Машина"), {
      target: { value: "11" },
    });
    await waitFor(() => {
      expect(queries).toEqual([null, "11"]);
    });
  });

  it("shows the empty state", async () => {
    setup({ "GET /api/customers/5/history": () => [] });
    expect(await screen.findByText("Покупок пока нет")).toBeInTheDocument();
  });
});

describe("CustomerPage deletion", () => {
  it("asks for confirmation then deletes and goes to the list", async () => {
    let deleted = 0;
    setup({
      "DELETE /api/customers/5": () => {
        deleted += 1;
        return new Response(null, { status: 204 });
      },
    });
    await screen.findByRole("heading", { name: "Иван Тест" });
    fireEvent.click(screen.getByRole("button", { name: "Удалить клиента" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Удалить клиента «Иван Тест» с телефонами и машинами? Его продажи останутся без клиента. Действие необратимо.",
    );
    expect(deleted).toBe(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/customers");
    });
    expect(deleted).toBe(1);
  });
});
