import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useAddCar, useCustomers, usePatchCustomer } from "./customers";

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("customers hooks", () => {
  it("keeps the previous list while a new search loads", async () => {
    mockApi({
      "GET /api/customers": (_init, url) =>
        url.searchParams.get("q") === ""
          ? [{ id: 1, name: "Иван Тест", phones: [], cars: [] }]
          : [],
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useCustomers(q),
      { wrapper: wrapperFor(client), initialProps: { q: "" } },
    );
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    rerender({ q: "x" });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toHaveLength(1);
  });

  it.each(["patch", "addCar"])(
    "%s invalidates customers, stock and cash",
    async (which) => {
      mockApi({
        "PATCH /api/customers/5": () => ({}),
        "POST /api/customers/5/cars": () => ({}),
      });
      const client = new QueryClient();
      const spy = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(
        () => ({ patch: usePatchCustomer(5), car: useAddCar(5) }),
        { wrapper: wrapperFor(client) },
      );
      await act(async () => {
        if (which === "patch") await result.current.patch.mutateAsync({});
        else await result.current.car.mutateAsync({ make: "Test" });
      });
      const keys = spy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
      expect(keys).toEqual(
        expect.arrayContaining(["customers", "stock", "cash"]),
      );
    },
  );
});
