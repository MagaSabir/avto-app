import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "@/test/mockApi";

import { routes } from "./router";

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

function setup() {
  let loggedOut = false;
  const logout = { calls: 0 };
  mockApi({
    "GET /api/auth/me": () =>
      loggedOut
        ? new Response(JSON.stringify({ message: "no" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        : { login: "sabir" },
    "POST /api/auth/logout": () => {
      logout.calls += 1;
      loggedOut = true;
      return new Response(null, { status: 204 });
    },
    "GET /api/stock": () => [],
  });
  const router = createMemoryRouter(routes, { initialEntries: ["/stock"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, logout };
}

describe("Layout", () => {
  it("renders logo, navigation, login and the stock page", async () => {
    setup();

    expect((await screen.findAllByRole("link", { name: "Поиск" })).length).toBe(
      2,
    );
    expect(
      screen.getAllByRole("img", { name: "ROSSMIK" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Склад" })).toBeInTheDocument();
    expect(screen.getByText("sabir")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Склад" })).toBeInTheDocument();
  });

  it("asks for confirmation and sends no request on opening", async () => {
    const { logout } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Выйти" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Выйти из учётной записи?");
    expect(screen.getByRole("button", { name: "Да" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Нет" })).toBeEnabled();
    expect(logout.calls).toBe(0);
  });

  it("closes on «Нет», cross and Esc without a request", async () => {
    const { router, logout } = setup();
    for (const close of [
      () => fireEvent.click(screen.getByRole("button", { name: "Нет" })),
      () => fireEvent.click(screen.getByRole("button", { name: "Закрыть" })),
      () => fireEvent(screen.getByRole("dialog"), new Event("cancel")),
    ]) {
      fireEvent.click(await screen.findByRole("button", { name: "Выйти" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      close();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    }
    expect(logout.calls).toBe(0);
    expect(router.state.location.pathname).toBe("/stock");
  });

  it("logs out once on «Да» and goes to /login", async () => {
    const { router, logout } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Выйти" }));
    fireEvent.click(screen.getByRole("button", { name: "Да" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(logout.calls).toBe(1);
  });
});
