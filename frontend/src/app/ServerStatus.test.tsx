import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerStatus } from "./ServerStatus";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderStatus() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ServerStatus />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ServerStatus", () => {
  it("renders nothing when server is healthy", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));
    renderStatus();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows unavailable message when fetch fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderStatus();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервер недоступен, попробуйте позже",
    );
  });

  it("shows database message on 503", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { status: "error", message: "Database unavailable" }),
    );
    renderStatus();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервер работает, но база данных недоступна",
    );
  });

  it("shows error message for other errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: "boom" }));
    renderStatus();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
