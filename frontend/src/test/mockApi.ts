import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { MemoryRouter, type InitialEntry } from "react-router";
import { expect, vi } from "vitest";

type Handler = (init: RequestInit, url: URL) => Response | object;

export function mockApi(handlers: Record<string, Handler>): void {
  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(raw, "http://localhost");
      const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
      const handler = handlers[key] as Handler | undefined;
      if (!handler) {
        expect.unreachable(`Unmocked request: ${key}`);
        return Promise.resolve(new Response("unmocked", { status: 500 }));
      }
      const result = handler(init, url);
      if (result instanceof Response) return Promise.resolve(result);
      return Promise.resolve(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/stock" }: { route?: InitialEntry } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries: [route] }, ui),
    ),
  );
  return { ...result, queryClient };
}
