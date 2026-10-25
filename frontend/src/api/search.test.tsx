import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useAnalogStock, useSupplierSearches } from "./search";

afterEach(() => {
  vi.unstubAllGlobals();
  focusManager.setFocused(undefined);
});

function wrapper() {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useSupplierSearches", () => {
  it("requests each supplier with the query", async () => {
    let seen = "";
    mockApi({
      "GET /api/search/suppliers/rossko": (_init, url) => {
        seen = url.search;
        return { code: "rossko", groups: [] };
      },
    });
    const { result } = renderHook(
      () => useSupplierSearches(["rossko"], "W683", {}),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => {
      expect(result.current[0]?.isSuccess).toBe(true);
    });
    expect(seen).toBe("?q=W683");
  });

  it("asks for orders only from suppliers that are switched on", async () => {
    const seen: Record<string, string> = {};
    const answer = (code: string) => (_init: unknown, url: URL) => {
      seen[code] = url.search;
      return { code, groups: [] };
    };
    mockApi({
      "GET /api/search/suppliers/rossko": answer("rossko"),
      "GET /api/search/suppliers/mikado": answer("mikado"),
    });
    const { result } = renderHook(
      () => useSupplierSearches(["rossko", "mikado"], "W683", { mikado: true }),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current.every((r) => r.isSuccess)).toBe(true);
    });
    expect(seen["rossko"]).toBe("?q=W683");
    expect(seen["mikado"]).toBe("?q=W683&with_orders=true");
  });

  it("does not retry errors", async () => {
    let calls = 0;
    mockApi({
      "GET /api/search/suppliers/rossko": () => {
        calls += 1;
        return new Response("boom", { status: 500 });
      },
    });
    const { result } = renderHook(
      () => useSupplierSearches(["rossko"], "W683", {}),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => {
      expect(result.current[0]?.isError).toBe(true);
    });
    expect(calls).toBe(1);
  });

  it("does not refetch on window focus", async () => {
    let calls = 0;
    mockApi({
      "GET /api/search/suppliers/rossko": () => {
        calls += 1;
        return { code: "rossko", groups: [] };
      },
    });
    const { result } = renderHook(
      () => useSupplierSearches(["rossko"], "W683", {}),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current[0]?.isSuccess).toBe(true);
    });
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
  });
});

describe("useAnalogStock", () => {
  it("sends sorted unique numbers as repeated params", async () => {
    let seen: string[] = [];
    mockApi({
      "GET /api/search/stock": (_init, url) => {
        seen = url.searchParams.getAll("numbers");
        return [];
      },
    });
    const { result } = renderHook(
      () => useAnalogStock(["W683", "C170", "W683"]),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen).toEqual(["C170", "W683"]);
  });

  it("does not request without numbers", () => {
    mockApi({});
    const { result } = renderHook(() => useAnalogStock([]), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
