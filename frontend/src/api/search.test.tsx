import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { useSupplierSearches } from "./search";

afterEach(() => {
  vi.unstubAllGlobals();
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
      () => useSupplierSearches(["rossko"], "W683"),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => {
      expect(result.current[0]?.isSuccess).toBe(true);
    });
    expect(seen).toBe("?q=W683");
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
      () => useSupplierSearches(["rossko"], "W683"),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => {
      expect(result.current[0]?.isError).toBe(true);
    });
    expect(calls).toBe(1);
  });
});
