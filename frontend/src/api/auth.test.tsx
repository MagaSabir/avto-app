import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useLogin, useMe } from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("auth hooks", () => {
  it("useMe returns the current user", async () => {
    mockApi({ "GET /api/auth/me": () => ({ login: "sabir" }) });
    const client = new QueryClient();
    const { result } = renderHook(() => useMe(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ login: "sabir" });
  });

  it("useLogin posts credentials", async () => {
    let body: unknown;
    mockApi({
      "POST /api/auth/login": (init) => {
        body = JSON.parse(init.body as string);
        return new Response(null, { status: 204 });
      },
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useLogin(), {
      wrapper: wrapperFor(client),
    });
    await act(async () => {
      await result.current.mutateAsync({ login: "sabir", password: "pw" });
    });
    expect(body).toEqual({ login: "sabir", password: "pw" });
  });
});
