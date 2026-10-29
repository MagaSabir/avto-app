import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerBrief } from "@/api/customers";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CustomerPicker, type PickerValue } from "./CustomerPicker";

const IVAN: CustomerBrief = {
  id: 1,
  name: "Иван Тест",
  phones: ["79000000001"],
  cars: [{ id: 11, make: "Lada", model: "Vesta", plate: "A001AA" }],
};
const PETR: CustomerBrief = {
  id: 2,
  name: "Петр Тест",
  phones: [],
  cars: [
    { id: 21, make: "Kia", model: "Rio", plate: "B002BB" },
    { id: 22, make: "Ford", model: "Focus", plate: "C003CC" },
  ],
};

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

function Harness({
  onSubmit,
  onValue,
}: {
  onSubmit: () => void;
  onValue: (v: PickerValue) => void;
}) {
  const [value, setValue] = useState<PickerValue>({
    customer: null,
    carId: null,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <CustomerPicker
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
      <button type="submit">go</button>
    </form>
  );
}

function setup(list: CustomerBrief[] = [IVAN, PETR]) {
  const requests: string[] = [];
  mockApi({
    "GET /api/customers": (_init, url) => {
      requests.push(url.searchParams.get("q") ?? "");
      return list;
    },
  });
  const onSubmit = vi.fn();
  const onValue = vi.fn();
  renderWithProviders(<Harness onSubmit={onSubmit} onValue={onValue} />);
  return { onSubmit, onValue, requests };
}

const box = () => screen.getByRole("combobox", { name: "Клиент" });

async function typeQuery(text: string) {
  fireEvent.change(box(), { target: { value: text } });
  await screen.findAllByRole("option");
}

describe("CustomerPicker", () => {
  it("does not query for fewer than 2 characters", async () => {
    const { requests } = setup();
    fireEvent.change(box(), { target: { value: "И" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(requests).not.toContain("И");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows options with name, phone and plate", async () => {
    setup();
    await typeQuery("Те");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent(
      "Иван Тест · +7 900 000-00-01 · A001AA",
    );
    expect(options[1]).toHaveTextContent("Петр Тест · B002BB");
    expect(box()).toHaveAttribute("aria-expanded", "true");
  });

  it("selects with arrows and Enter without submitting the form", async () => {
    const { onSubmit, onValue } = setup();
    await typeQuery("Те");
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(box().getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[1]?.id,
    );
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValue).toHaveBeenLastCalledWith({ customer: PETR, carId: null });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Enter with the list closed submits the form", () => {
    const { onSubmit } = setup();
    fireEvent.submit(box().closest("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("Escape closes the list", async () => {
    setup();
    await typeQuery("Те");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("auto-selects the only car", async () => {
    const { onValue } = setup();
    await typeQuery("Те");
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(onValue).toHaveBeenLastCalledWith({ customer: IVAN, carId: 11 });
    expect(screen.queryByLabelText("Машина")).not.toBeInTheDocument();
  });

  it("offers a car select when there are several", async () => {
    const { onValue } = setup();
    await typeQuery("Те");
    fireEvent.click(screen.getAllByRole("option")[1]);
    const select = screen.getByLabelText<HTMLSelectElement>("Машина");
    expect(select.value).toBe("");
    expect(
      screen.getByRole("option", { name: "Без машины" }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "22" } });
    expect(onValue).toHaveBeenLastCalledWith({ customer: PETR, carId: 22 });
  });

  it("clears the selection with the × button", async () => {
    const { onValue } = setup();
    await typeQuery("Те");
    fireEvent.click(screen.getAllByRole("option")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Очистить клиента" }));
    expect(onValue).toHaveBeenLastCalledWith({ customer: null, carId: null });
    expect(box()).toHaveValue("");
  });

  it("creates and selects a new customer", async () => {
    const { onValue } = setup();
    mockApi({
      "GET /api/customers": () => [],
      "POST /api/customers": () =>
        new Response(
          JSON.stringify({
            id: 5,
            name: "Новый Тест",
            comment: null,
            phones: ["79000000005"],
            cars: [
              {
                id: 50,
                customer_id: 5,
                make: "Lada",
                model: null,
                year: null,
                vin: null,
                plate: null,
                comment: null,
              },
            ],
            created_at: "2026-10-29T10:00:00Z",
          }),
          { status: 201 },
        ),
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Новый клиент" }));
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Новый Тест" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    await waitFor(() => {
      expect(onValue).toHaveBeenCalled();
    });
    const last = onValue.mock.lastCall?.[0] as PickerValue;
    expect(last.customer?.id).toBe(5);
    expect(last.carId).toBe(50);
    expect(box()).toHaveValue("Новый Тест");
  });
});
