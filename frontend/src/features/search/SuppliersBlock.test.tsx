import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSupplierSearches } from "@/api/search";
import { mockApi, renderWithProviders } from "@/test/mockApi";
import { partGroup, supplierResult } from "@/test/searchFixtures";

import { SuppliersBlock } from "./SuppliersBlock";

afterEach(() => {
  vi.unstubAllGlobals();
});

const opts = {
  showAnalogs: true,
  sort: "price" as const,
  now: new Date(2026, 9, 21, 10, 0),
};

function Harness() {
  const queries = useSupplierSearches(["rossko"], "333114");
  return (
    <SuppliersBlock
      suppliers={[{ code: "rossko", title: "Росско" }]}
      queries={queries}
      opts={opts}
      stockNumbers={new Map([["290074", 1]])}
    />
  );
}

function answer(result: object | Response) {
  let calls = 0;
  mockApi({
    "GET /api/search/suppliers/rossko": () => {
      calls += 1;
      return result;
    },
  });
  return () => calls;
}

describe("SuppliersBlock", () => {
  it("shows the waiting plaque while the supplier answers", () => {
    vi.stubGlobal("fetch", () => new Promise<Response>(() => undefined));
    renderWithProviders(<Harness />);
    expect(screen.getByText("Предложения поставщиков")).toBeInTheDocument();
    expect(screen.getByText("Росско · ждём ответ…")).toBeInTheDocument();
  });

  it("shows the parts count, markup and groups", async () => {
    answer(
      supplierResult({
        groups: [
          partGroup(),
          partGroup({
            brand: "SACHS",
            number: "290 074",
            number_norm: "290074",
            is_requested: false,
          }),
        ],
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · 2 детали")).toBeInTheDocument();
    expect(
      screen.getByText("цены с наценкой 20%, округление вверх до 10 ₽"),
    ).toBeInTheDocument();
    expect(screen.getByText("SACHS")).toBeInTheDocument();
    expect(screen.getByText("у вас 1 шт")).toBeInTheDocument();
  });

  it("shows the supplier message", async () => {
    answer(supplierResult({ message: "Часть складов не ответила" }));
    renderWithProviders(<Harness />);
    expect(
      await screen.findByText("Часть складов не ответила"),
    ).toBeInTheDocument();
  });

  it("says nothing was found", async () => {
    answer(supplierResult({ groups: [] }));
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText("Росско · 0 деталей")).toBeInTheDocument();
  });

  it("shows a supplier error and retries on request", async () => {
    const calls = answer(
      supplierResult({
        status: "error",
        message: "Росско не отвечает",
        groups: [],
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · ошибка")).toBeInTheDocument();
    expect(screen.getByText("Росско не отвечает")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(calls()).toBe(2);
    });
  });

  it("shows a request failure with retry", async () => {
    answer(
      new Response(JSON.stringify({ detail: "Внутренняя ошибка" }), {
        status: 500,
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Росско · ошибка")).toBeInTheDocument();
    expect(screen.getByText("Внутренняя ошибка")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
  });
});
