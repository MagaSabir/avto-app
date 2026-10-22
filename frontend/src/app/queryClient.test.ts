import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ME_QUERY_KEY, useLogin, useUpdateMe, type Me } from "@/api/auth";
import { apiFetch, UnauthorizedError } from "@/api/client";
import { mockApi } from "@/test/mockApi";

import { createQueryClient } from "./queryClient";

const ME: Me = { login: "sabir", first_name: "", last_name: "" };

function observeMe(client: ReturnType<typeof createQueryClient>) {
  const observer = new QueryObserver(client, {
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<Me>("/api/auth/me"),
    retry: false,
  });
  return observer.subscribe(() => undefined);
}

describe("createQueryClient", () => {
  it("refetches me when a non-auth query gets 401", async () => {
    const me = vi.fn(() => ME);
    mockApi({ "GET /api/auth/me": me });
    const client = createQueryClient();
    const unsubscribe = observeMe(client);
    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledTimes(1);
    });

    await expect(
      client.query({
        queryKey: ["stock"],
        queryFn: () => Promise.reject(new UnauthorizedError("no")),
        retry: false,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledTimes(2);
    });
    unsubscribe();
  });

  it("does not reset me when the auth query itself gets 401", async () => {
    const me = vi.fn(() => new Response("{}", { status: 401 }));
    mockApi({ "GET /api/auth/me": me });
    const client = createQueryClient();
    const unsubscribe = observeMe(client);
    await vi.waitFor(() => {
      expect(client.getQueryState(ME_QUERY_KEY)?.status).toBe("error");
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(me).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not reset me when the login mutation gets 401", async () => {
    const me = vi.fn(() => ME);
    mockApi({
      "GET /api/auth/me": me,
      "POST /api/auth/login": () => new Response("{}", { status: 401 }),
    });
    const client = createQueryClient();
    const unsubscribe = observeMe(client);
    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledTimes(1);
    });
    const { result } = renderHook(() => useLogin(), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client }, children),
    });
    await expect(
      result.current.mutateAsync({ login: "a", password: "b" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await new Promise((r) => setTimeout(r, 20));
    expect(me).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refetches me when saving the profile gets 401", async () => {
    const me = vi.fn(() => ME);
    mockApi({
      "GET /api/auth/me": me,
      "PATCH /api/auth/me": () => new Response("{}", { status: 401 }),
    });
    const client = createQueryClient();
    const unsubscribe = observeMe(client);
    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledTimes(1);
    });
    const { result } = renderHook(() => useUpdateMe(), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client }, children),
    });
    await expect(
      result.current.mutateAsync({ first_name: "a", last_name: "b" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledTimes(2);
    });
    unsubscribe();
  });

  it("does not retry UnauthorizedError", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe("function");
    if (typeof retry !== "function") return;
    expect(retry(0, new UnauthorizedError("no"))).toBe(false);
    expect(retry(0, new Error("x"))).toBe(true);
    expect(retry(1, new Error("x"))).toBe(false);
  });
});
