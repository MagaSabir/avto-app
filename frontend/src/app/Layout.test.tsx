import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "@/test/mockApi";
import { settlements } from "@/test/settlementsFixtures";

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

function setup(
  logoutResponse?: () => Response,
  balance: () => Response | object = () => settlements(),
  route = "/stock",
  firstName = "",
) {
  let loggedOut = false;
  const logout = { calls: 0 };
  const me = { login: "sabir", first_name: firstName, last_name: "" };
  const patches: unknown[] = [];
  mockApi({
    "PATCH /api/auth/me": (init) => {
      const body = JSON.parse(init.body as string) as typeof me;
      patches.push(body);
      Object.assign(me, body);
      return me;
    },
    "GET /api/auth/me": () =>
      loggedOut
        ? new Response(JSON.stringify({ message: "no" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        : me,
    "POST /api/auth/logout": () => {
      logout.calls += 1;
      if (logoutResponse) return logoutResponse();
      loggedOut = true;
      return new Response(null, { status: 204 });
    },
    "GET /api/stock": () => [],
    "GET /api/suppliers/rossko/settlements": balance,
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, logout, patches };
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
    expect(screen.getByRole("link", { name: "Взаиморасчёты" })).toHaveAttribute(
      "href",
      "/settlements",
    );
    expect(screen.getByRole("link", { name: "sabir" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.queryByRole("button", { name: /Выйти/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Склад" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Склад" })).toHaveClass(
      "border-primary",
    );
    expect(screen.getByRole("link", { name: "Взаиморасчёты" })).not.toHaveClass(
      "border-primary",
    );
    expect(screen.getByRole("heading", { name: "Склад" })).toBeInTheDocument();
  });

  it("asks for confirmation and sends no request on opening", async () => {
    const { logout } = setup(undefined, undefined, "/profile");
    fireEvent.click(
      await screen.findByRole("button", { name: "Выйти из учётной записи" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Выйти из учётной записи?");
    expect(screen.getByRole("button", { name: "Да" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Нет" })).toBeEnabled();
    expect(logout.calls).toBe(0);
  });

  it("closes on «Нет», cross and Esc without a request", async () => {
    const { router, logout } = setup(undefined, undefined, "/profile");
    for (const close of [
      () => fireEvent.click(screen.getByRole("button", { name: "Нет" })),
      () => fireEvent.click(screen.getByRole("button", { name: "Закрыть" })),
      () => fireEvent(screen.getByRole("dialog"), new Event("cancel")),
    ]) {
      fireEvent.click(
        await screen.findByRole("button", { name: "Выйти из учётной записи" }),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      close();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    }
    expect(logout.calls).toBe(0);
    expect(router.state.location.pathname).toBe("/profile");
  });

  it("logs out once on «Да» and goes to /login", async () => {
    const { router, logout } = setup(undefined, undefined, "/profile");
    fireEvent.click(
      await screen.findByRole("button", { name: "Выйти из учётной записи" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Да" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(logout.calls).toBe(1);
  });

  it("keeps the modal open and shows the error when logout fails", async () => {
    const { router, logout } = setup(
      () =>
        new Response(JSON.stringify({ message: "Сервер недоступен" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      undefined,
      "/profile",
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Выйти из учётной записи" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Да" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервер недоступен",
    );
    expect(logout.calls).toBe(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/profile");
  });

  it("disables «Нет» while logout is pending", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    setup(undefined, undefined, "/profile");
    const inner = fetch;
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") await gate;
        return inner(input, init);
      },
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Выйти из учётной записи" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Да" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Нет" })).toBeDisabled();
    });
    release();
  });
});

describe("Layout balance", () => {
  it("links an overpayment with a plus to the settlements page", async () => {
    setup();
    const link = await screen.findByRole("link", { name: /Баланс: \+67,54 ₽/ });
    expect(link).toHaveAttribute("href", "/settlements");
    expect(link.querySelector(".text-destructive")).toBeNull();
  });

  it("shows a debt with a minus in the error colour", async () => {
    setup(undefined, () => settlements({ balance: "-1250.40" }));
    const link = await screen.findByRole("link", {
      name: /Баланс: −1\s250,40 ₽/,
    });
    expect(link.querySelector(".text-destructive")).not.toBeNull();
  });

  it("shows a dash with the reason when Rossko fails", async () => {
    setup(undefined, () => ({
      ...settlements(),
      status: "error",
      message: "Росско не ответил за 15 с",
      data: null,
    }));
    const link = await screen.findByRole("link", { name: "Баланс: —" });
    expect(link).toHaveAttribute("title", "Росско не ответил за 15 с");
  });

  it("shows a dash when the request fails", async () => {
    setup(
      undefined,
      () =>
        new Response(JSON.stringify({ message: "boom" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );
    expect(
      await screen.findByRole("link", { name: "Баланс: —" }),
    ).toBeInTheDocument();
  });
});

describe("Profile", () => {
  it("fills the form, saves names and updates the header", async () => {
    const { patches } = setup(undefined, undefined, "/profile");
    expect(
      await screen.findByRole("heading", { name: "Личная информация" }),
    ).toBeInTheDocument();
    expect(screen.getByText("sabir", { selector: "dd" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Сабир" },
    });
    fireEvent.change(screen.getByLabelText("Фамилия"), {
      target: { value: "Магомедов" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("✓ Сохранено")).toBeInTheDocument();
    expect(patches).toEqual([{ first_name: "Сабир", last_name: "Магомедов" }]);
    expect(
      await screen.findByRole("link", { name: "Сабир Магомедов" }),
    ).toHaveAttribute("href", "/profile");
  });

  it("starts with saved names in the form", async () => {
    setup(undefined, undefined, "/profile", "Сабир");
    expect(await screen.findByLabelText("Имя")).toHaveValue("Сабир");
    expect(screen.getByRole("link", { name: "Сабир" })).toBeInTheDocument();
  });
});
