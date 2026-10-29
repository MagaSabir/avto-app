import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockItemDetail } from "@/api/stock";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { ItemActions } from "./ItemActions";

const ITEM: StockItemDetail = {
  id: 3,
  number_raw: "W 68/3",
  number_norm: "W683",
  brand: "MANN-FILTER",
  name: "Фильтр масляный",
  qty: 7,
  min_qty: 1,
  cell: "A-12",
  purchase_price: "412.00",
  markup: "30.00",
  sale_price: "540.00",
  status: "ok",
  last_receipt_at: null,
  last_receipt_supplier: null,
  last_sale_at: null,
  sold_30d: 0,
};

const result = (qty: number) => ({ item: { ...ITEM, qty }, move: {} });

function input(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label);
}
function type(label: string, value: string) {
  fireEvent.change(input(label), { target: { value } });
}
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ItemActions", () => {
  it("sells with the item price and sends money as a string", async () => {
    let body: unknown;
    mockApi({
      "POST /api/stock/items/3/sales": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(JSON.stringify(result(6)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Продать");
    expect(input("Кол-во").value).toBe("1");
    expect(input("Цена").value).toBe("540");
    type("Цена", "300");
    expect(screen.getByText("Цена продажи ниже закупки")).toBeInTheDocument();
    click("Провести");
    await waitFor(() => {
      expect(body).toEqual({ qty: 1, price: "300.00", payment: "cash" });
    });
    expect(await screen.findByText("✓ Продажа: −1 → остаток 6")).toBeVisible();
    expect(screen.getByRole("button", { name: "Продать" })).toBeVisible();
  });

  it("sends payment and trimmed comment for a sale", async () => {
    let body: unknown;
    mockApi({
      "POST /api/stock/items/3/sales": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(JSON.stringify(result(6)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Продать");
    const group = screen.getByRole("radiogroup", { name: "Оплата" });
    expect(within(group).getByRole("radio", { name: "Нал" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "Перевод" }));
    type("Комментарий", "  скидка ");
    click("Провести");
    await waitFor(() => {
      expect(body).toEqual({
        qty: 1,
        price: "540.00",
        payment: "transfer",
        comment: "скидка",
      });
    });
  });

  it("has the payment group in the return form and omits empty comment", async () => {
    let body: unknown;
    mockApi({
      "POST /api/stock/items/3/returns": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(JSON.stringify(result(8)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Возврат");
    const group = screen.getByRole("radiogroup", { name: "Оплата" });
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    click("Провести");
    await waitFor(() => {
      expect(body).toEqual({ qty: 1, price: "540.00", payment: "cash" });
    });
  });

  it("shows the server message on 409 and keeps the form", async () => {
    mockApi({
      "POST /api/stock/items/3/sales": () =>
        new Response(
          JSON.stringify({ message: "Недостаточно на складе: остаток 7" }),
          {
            status: 409,
          },
        ),
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Продать");
    type("Кол-во", "9");
    click("Провести");
    expect(
      await screen.findByText("Недостаточно на складе: остаток 7"),
    ).toBeInTheDocument();
    expect(input("Кол-во").value).toBe("9");
  });

  it("requires a reason for a write-off and suggests reasons", () => {
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Списать");
    expect(screen.getByRole("button", { name: "Провести" })).toBeDisabled();
    const options = Array.from(
      document.querySelectorAll<HTMLOptionElement>("datalist option"),
    ).map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(["брак", "потеря"]));
    type("Причина", "брак");
    expect(screen.getByRole("button", { name: "Провести" })).toBeEnabled();
  });

  it("adjusts to the actual quantity", async () => {
    let body: unknown;
    mockApi({
      "POST /api/stock/items/3/adjustments": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(JSON.stringify(result(6)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Корректировка");
    expect(input("Фактическое кол-во").value).toBe("7");
    type("Фактическое кол-во", "6");
    click("Провести");
    await waitFor(() => {
      expect(body).toEqual({ actual_qty: 6 });
    });
  });

  it("sends a return", async () => {
    let body: unknown;
    mockApi({
      "POST /api/stock/items/3/returns": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(JSON.stringify(result(8)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Возврат");
    click("Провести");
    await waitFor(() => {
      expect(body).toEqual({ qty: 1, price: "540.00", payment: "cash" });
    });
  });

  it("recalculates sale from markup and patches only changed fields", async () => {
    let body: unknown;
    mockApi({
      "PATCH /api/stock/items/3": (init) => {
        body = JSON.parse(init.body as string);
        return ITEM;
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Изменить");
    expect(input("Название").value).toBe("Фильтр масляный");
    type("Наценка, %", "40");
    expect(input("Продажа").value).toBe("580.00");
    click("Сохранить");
    await waitFor(() => {
      expect(body).toEqual({ markup: "40.00", sale_price: "580.00" });
    });
    expect(await screen.findByText("✓ Сохранено")).toBeVisible();
  });

  it("blocks an edit with a markup above 9999.99", () => {
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Изменить");
    type("Закупка", "1");
    type("Продажа", "200");
    expect(
      screen.getByText("Наценка слишком большая — проверьте закупку"),
    ).toBeVisible();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" })
        .disabled,
    ).toBe(true);
  });

  it("returns to the buttons on cancel", () => {
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Списать");
    click("Отмена");
    expect(screen.getByRole("button", { name: "Продать" })).toBeVisible();
    expect(screen.queryByLabelText("Причина")).toBeNull();
  });

  describe("delete", () => {
    const deleted = vi.fn();
    function setup(handler: () => Response) {
      const calls: string[] = [];
      mockApi({
        "DELETE /api/stock/items/3": () => {
          calls.push("DELETE");
          return handler();
        },
      });
      renderWithProviders(
        <ItemActions item={ITEM} moveCount={22} onDeleted={deleted} />,
      );
      return calls;
    }

    it("asks for confirmation and sends nothing on cancel", () => {
      const calls = setup(() => new Response(null, { status: 204 }));
      click("Удалить");
      expect(
        screen.getByText(
          "Удалить W 68/3 · MANN-FILTER вместе со всей историей (22 движения)? Остаток: 7 шт. Это нельзя отменить.",
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
      expect(calls).toEqual([]);
    });

    it("deletes once and reports it", async () => {
      const calls = setup(() => new Response(null, { status: 204 }));
      click("Удалить");
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Удалить",
        }),
      );
      await waitFor(() => {
        expect(deleted).toHaveBeenCalledTimes(1);
      });
      expect(calls).toEqual(["DELETE"]);
    });

    it("keeps the dialog and shows the error on failure", async () => {
      setup(
        () =>
          new Response(JSON.stringify({ message: "Позиция не найдена" }), {
            status: 404,
          }),
      );
      click("Удалить");
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Удалить",
        }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Позиция не найдена",
      );
      expect(screen.getByRole("dialog")).toBeVisible();
    });
  });

  it("sends customer_id and car_id when a customer is picked", async () => {
    let body: Record<string, unknown> = {};
    mockApi({
      "GET /api/customers": () => [
        {
          id: 1,
          name: "Иван Тест",
          phones: ["79000000001"],
          cars: [{ id: 11, make: "Lada", model: "Vesta", plate: "A001AA" }],
        },
      ],
      "POST /api/stock/items/3/sales": (init) => {
        body = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(result(6)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Продать");
    fireEvent.change(screen.getByRole("combobox", { name: "Клиент" }), {
      target: { value: "Ив" },
    });
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    click("Провести");
    await screen.findByText(/✓ Продажа/);
    expect(body.customer_id).toBe(1);
    expect(body.car_id).toBe(11);
  });

  it("omits customer fields when no customer is picked", async () => {
    let body: Record<string, unknown> = {};
    mockApi({
      "POST /api/stock/items/3/returns": (init) => {
        body = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(result(8)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Возврат");
    click("Провести");
    await screen.findByText(/✓ Возврат/);
    expect(body).not.toHaveProperty("customer_id");
    expect(body).not.toHaveProperty("car_id");
  });

  it("creating a customer does not record the sale", async () => {
    const sales = vi.fn();
    const created = vi.fn();
    mockApi({
      "GET /api/customers": () => [],
      "POST /api/customers": () => {
        created();
        return new Response(
          JSON.stringify({
            id: 5,
            name: "Новый Тест",
            comment: null,
            phones: [],
            cars: [],
            created_at: "2026-10-29T10:00:00Z",
          }),
          { status: 201 },
        );
      },
      "POST /api/stock/items/3/sales": () => {
        sales();
        return new Response(JSON.stringify(result(6)), { status: 201 });
      },
    });
    renderWithProviders(<ItemActions item={ITEM} />);
    click("Продать");
    click("+ Новый клиент");
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Новый Тест" },
    });
    click("Создать");
    await waitFor(() => {
      expect(created).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Клиент" })).toHaveValue(
        "Новый Тест",
      );
    });
    expect(sales).not.toHaveBeenCalled();
  });
});
