import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "@/test/mockApi";

import { RequireAuth } from "./RequireAuth";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>login page</div> },
      {
        element: <RequireAuth />,
        children: [{ path: "*", element: <div>protected</div> }],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const unauthorized = () =>
  new Response(JSON.stringify({ message: "Требуется вход" }), { status: 401 });

describe("RequireAuth", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("redirects to /login with next for a deep link", async () => {
    mockApi({ "GET /api/auth/me": unauthorized });
    const router = renderAt("/?q=W683");
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/login?next=%2F%3Fq%3DW683",
    );
  });

  it("redirects to plain /login from the root", async () => {
    mockApi({ "GET /api/auth/me": unauthorized });
    const router = renderAt("/");
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/login",
    );
  });

  it("renders children when signed in", async () => {
    mockApi({ "GET /api/auth/me": () => ({ login: "sabir" }) });
    renderAt("/stock");
    expect(await screen.findByText("protected")).toBeInTheDocument();
  });

  it("shows the server-unavailable message when fetch throws", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("down")));
    renderAt("/stock");
    expect(
      await screen.findByText("Сервер недоступен, попробуйте позже"),
    ).toBeInTheDocument();
  });
});
