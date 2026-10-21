import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "@/test/mockApi";

import { LoginPage } from "./LoginPage";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "*", element: <div>app</div> },
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

const where = (r: ReturnType<typeof renderAt>) =>
  r.state.location.pathname + r.state.location.search;

const notSignedIn = () => new Response("{}", { status: 401 });

async function fill() {
  fireEvent.change(await screen.findByLabelText("Логин"), {
    target: { value: "sabir" },
  });
  fireEvent.change(screen.getByLabelText("Пароль"), {
    target: { value: "secret" },
  });
}

async function fillAndSubmit() {
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("goes to next after login", async () => {
    let signedIn = false;
    mockApi({
      "GET /api/auth/me": () => (signedIn ? { login: "sabir" } : notSignedIn()),
      "POST /api/auth/login": () => {
        signedIn = true;
        return new Response(null, { status: 204 });
      },
    });
    const router = renderAt("/login?next=%2F%3Fq%3DW683");
    await fillAndSubmit();
    await waitFor(() => {
      expect(where(router)).toBe("/?q=W683");
    });
  });

  it("goes to /stock without next", async () => {
    let signedIn = false;
    mockApi({
      "GET /api/auth/me": () => (signedIn ? { login: "sabir" } : notSignedIn()),
      "POST /api/auth/login": () => {
        signedIn = true;
        return new Response(null, { status: 204 });
      },
    });
    const router = renderAt("/login");
    await fillAndSubmit();
    await waitFor(() => {
      expect(where(router)).toBe("/stock");
    });
  });

  it("ignores an external next", async () => {
    let signedIn = false;
    mockApi({
      "GET /api/auth/me": () => (signedIn ? { login: "sabir" } : notSignedIn()),
      "POST /api/auth/login": () => {
        signedIn = true;
        return new Response(null, { status: 204 });
      },
    });
    const router = renderAt("/login?next=https%3A%2F%2Fevil.com");
    await fillAndSubmit();
    await waitFor(() => {
      expect(where(router)).toBe("/stock");
    });
  });

  it("shows 401 message, clears password, keeps login, focuses password", async () => {
    mockApi({
      "GET /api/auth/me": notSignedIn,
      "POST /api/auth/login": () =>
        new Response(JSON.stringify({ message: "Неверный логин или пароль" }), {
          status: 401,
        }),
    });
    renderAt("/login");
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный логин или пароль",
    );
    expect(screen.getByLabelText("Пароль")).toHaveValue("");
    expect(screen.getByLabelText("Логин")).toHaveValue("sabir");
    expect(screen.getByLabelText("Пароль")).toHaveFocus();
  });

  it("shows the server message on 429", async () => {
    mockApi({
      "GET /api/auth/me": notSignedIn,
      "POST /api/auth/login": () =>
        new Response(
          JSON.stringify({
            message: "Слишком много попыток входа, подождите несколько минут",
          }),
          { status: 429 },
        ),
    });
    renderAt("/login");
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Слишком много попыток входа, подождите несколько минут",
    );
  });

  it("sends one request for a double submit", async () => {
    const login = vi.fn(() => new Response(null, { status: 204 }));
    mockApi({ "GET /api/auth/me": notSignedIn, "POST /api/auth/login": login });
    renderAt("/login");
    await fill();
    const form = screen.getByRole("button", { name: "Войти" }).closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects at once when already signed in", async () => {
    mockApi({ "GET /api/auth/me": () => ({ login: "sabir" }) });
    const router = renderAt("/login");
    await waitFor(() => {
      expect(where(router)).toBe("/stock");
    });
  });

  it("prefills the stored login and focuses the password", async () => {
    localStorage.setItem("lastLogin", "sabir");
    mockApi({ "GET /api/auth/me": notSignedIn });
    renderAt("/login");
    expect(await screen.findByLabelText("Логин")).toHaveValue("sabir");
    expect(screen.getByLabelText("Пароль")).toHaveFocus();
  });

  it("focuses the login when nothing is stored", async () => {
    mockApi({ "GET /api/auth/me": notSignedIn });
    renderAt("/login");
    expect(await screen.findByLabelText("Логин")).toHaveFocus();
    expect(screen.getByLabelText("Логин")).toHaveValue("");
  });

  it("stores the trimmed login after success", async () => {
    let signedIn = false;
    mockApi({
      "GET /api/auth/me": () => (signedIn ? { login: "sabir" } : notSignedIn()),
      "POST /api/auth/login": () => {
        signedIn = true;
        return new Response(null, { status: 204 });
      },
    });
    renderAt("/login");
    fireEvent.change(await screen.findByLabelText("Логин"), {
      target: { value: " sabir " },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => {
      expect(localStorage.getItem("lastLogin")).toBe("sabir");
    });
  });

  it("does not store the login after a failure", async () => {
    mockApi({
      "GET /api/auth/me": notSignedIn,
      "POST /api/auth/login": () =>
        new Response(JSON.stringify({ message: "Неверный логин или пароль" }), {
          status: 401,
        }),
    });
    renderAt("/login");
    await fillAndSubmit();
    await screen.findByRole("alert");
    expect(localStorage.getItem("lastLogin")).toBeNull();
  });

  it("marks the form up for password managers", async () => {
    mockApi({ "GET /api/auth/me": notSignedIn });
    renderAt("/login");
    const loginInput = await screen.findByLabelText("Логин");
    const passwordInput = screen.getByLabelText("Пароль");
    expect(loginInput).toHaveAttribute("name", "username");
    expect(loginInput).toHaveAttribute("autocomplete", "username");
    expect(passwordInput).toHaveAttribute("name", "password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    expect(loginInput.closest("form")).toHaveAttribute("method", "post");
  });
});
