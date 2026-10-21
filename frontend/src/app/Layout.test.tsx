import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { mockApi } from "@/test/mockApi";

import { routes } from "./router";

function setup() {
  let loggedOut = false;
  mockApi({
    "GET /api/auth/me": () =>
      loggedOut
        ? new Response(JSON.stringify({ message: "no" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        : { login: "sabir" },
    "POST /api/auth/logout": () => {
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
  return router;
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

  it("logs out and goes to /login", async () => {
    const router = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Выйти" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});
