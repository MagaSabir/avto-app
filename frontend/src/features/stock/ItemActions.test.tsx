import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => vi.unstubAllGlobals());

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
      expect(body).toEqual({ qty: 1, price: "300.00" });
    });
    expect(await screen.findByText("✓ Продажа: −1 → остаток 6")).toBeVisible();
    expect(screen.getByRole("button", { name: "Продать" })).toBeVisible();
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
      expect(body).toEqual({ qty: 1, price: "540.00" });
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
});
