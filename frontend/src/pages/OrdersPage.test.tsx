import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "@/test/mockApi";
import { order, ordersOut, part } from "@/test/ordersFixtures";

import { OrdersPage } from "./OrdersPage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22));
});

afterEach(() => {
  vi.useRealTimers();
});

const issued = order();
const refused = order({
  id: 100000002,
  parts: [
    part({ guid: "g2", number: "ABC-1", name: "Фильтр", status_code: 7 }),
  ],
});

function setup(answer: (url: URL) => object, route = "/orders") {
  const urls: URL[] = [];
  mockApi({
    "GET /api/suppliers/rossko/orders": (_init, url) => {
      urls.push(url);
      return answer(url);
    },
  });
  renderWithProviders(<OrdersPage />, { route });
  return urls;
}

describe("OrdersPage", () => {
  it("requests the last three months by default", async () => {
    const urls = setup(() => ordersOut([issued]));
    await screen.findByText(/100000001/);
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get("start")).toBe("2026-07-22");
    expect(urls[0].searchParams.get("end")).toBe("2026-10-22");
    expect(screen.getByLabelText("Период с")).toHaveValue("2026-07-22");
    expect(screen.getByLabelText("по")).toHaveValue("2026-10-22");
  });

  it("changing the period refetches", async () => {
    const urls = setup(() => ordersOut([issued]));
    await screen.findByText(/100000001/);
    fireEvent.change(screen.getByLabelText("Период с"), {
      target: { value: "2026-09-01" },
    });
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls[1].searchParams.get("start")).toBe("2026-09-01");
  });

  it("ignores half-typed dates", async () => {
    const urls = setup(() => ordersOut([issued]));
    await screen.findByText(/100000001/);
    fireEvent.change(screen.getByLabelText("Период с"), {
      target: { value: "0002-09-01" },
    });
    expect(urls).toHaveLength(1);
  });

  it("resetting the period returns to three months", async () => {
    const urls = setup(() => ordersOut([issued]));
    await screen.findByText(/100000001/);
    expect(
      screen.queryByRole("button", { name: "Сбросить период" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Период с"), {
      target: { value: "2026-09-01" },
    });
    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Сбросить период" }));
    expect(screen.getByLabelText("Период с")).toHaveValue("2026-07-22");
    expect(
      screen.queryByRole("button", { name: "Сбросить период" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get("start")).toBe("2026-07-22");
    });
  });

  it("status filter hides orders without matching parts", async () => {
    const urls = setup(() => ordersOut([issued, refused]));
    await screen.findByText(/100000001/);
    fireEvent.change(screen.getByLabelText("Статус"), {
      target: { value: "refused" },
    });
    expect(screen.queryByText(/100000001/)).not.toBeInTheDocument();
    expect(screen.getByText(/100000002/)).toBeInTheDocument();
    expect(urls).toHaveLength(1);
  });

  it("search filters by part number", async () => {
    const urls = setup(() => ordersOut([issued, refused]));
    await screen.findByText(/100000001/);
    const field = screen.getByLabelText(
      "Номер запчасти, название или № заказа",
    );
    fireEvent.change(field, { target: { value: "hczb003" } });
    expect(screen.getByText(/100000001/)).toBeInTheDocument();
    expect(screen.queryByText(/100000002/)).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: "zzzz" } });
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(urls).toHaveLength(1);
  });

  it("shows empty period message", async () => {
    setup(() => ordersOut([]));
    expect(
      await screen.findByText("Заказов за период нет"),
    ).toBeInTheDocument();
  });

  it("shows truncated note", async () => {
    setup(() => ordersOut([issued], true));
    expect(
      await screen.findByText("Показаны первые 500 заказов — сузьте период"),
    ).toBeInTheDocument();
  });

  it("shows supplier error with retry", async () => {
    let calls = 0;
    setup(() => {
      calls += 1;
      return {
        code: "rossko",
        title: "Росско",
        status: "error",
        message: "Росско недоступно",
        data: null,
      };
    });
    expect(await screen.findByText("Росско недоступно")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(calls).toBe(2);
    });
  });

  it("single order mode", async () => {
    const urls = setup(() => ordersOut([issued]), "/orders?id=100000001");
    await screen.findByText(/100000001/);
    expect(urls[0].searchParams.get("order_id")).toBe("100000001");
    expect(urls[0].searchParams.has("start")).toBe(false);
    expect(screen.queryByLabelText("Статус")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Все заказы" })).toHaveAttribute(
      "href",
      "/orders",
    );
  });

  it("single order mode shows not found for an empty answer", async () => {
    setup(() => ordersOut([]), "/orders?id=100000001");
    expect(
      await screen.findByText("Заказ № 100000001 не найден"),
    ).toBeInTheDocument();
  });

  it.each(["abc", "0"])("invalid id %s makes no request", (id) => {
    const urls = setup(() => ordersOut([]), `/orders?id=${id}`);
    expect(screen.getByText(`Заказ № ${id} не найден`)).toBeInTheDocument();
    expect(urls).toHaveLength(0);
  });
});
