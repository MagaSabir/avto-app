import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, ServerUnavailableError } from "./client";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestedHeaders(): Headers {
  return new Headers(fetchMock.mock.lastCall?.[1]?.headers);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_API_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("apiFetch", () => {
  it("rejects with ServerUnavailableError when fetch throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await apiFetch("/api/health").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerUnavailableError);
    expect((error as Error).message).toBe(
      "Сервер недоступен: проверьте, что ПК включён и Tailscale подключён",
    );
  });

  it.each([502, 504])(
    "rejects with ServerUnavailableError on %i",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("Bad gateway", { status }));
      await expect(apiFetch("/api/health")).rejects.toBeInstanceOf(
        ServerUnavailableError,
      );
    },
  );

  it("rejects with ApiError carrying message from body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: "x" }));
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "x",
    });
  });

  it("uses detail when message is absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse(415, { detail: "d" }));
    const error = await apiFetch("/api/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("d");
  });

  it("falls back to HTTP status for non-JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>oops</html>", { status: 500 }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 500,
      message: "HTTP 500",
    });
  });

  it("sends application/json on POST without body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await apiFetch("/api/x", { method: "POST" });
    expect(requestedHeaders().get("Content-Type")).toBe("application/json");
  });

  it("does not send Content-Type on GET", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await apiFetch("/api/x");
    expect(requestedHeaders().has("Content-Type")).toBe(false);
  });

  it("joins base URL without double slash", async () => {
    vi.stubEnv("VITE_API_URL", "https://pc.ts.net/");
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await apiFetch("/api/health");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pc.ts.net/api/health",
      expect.anything(),
    );
  });

  it("returns parsed JSON on 2xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));
    await expect(apiFetch("/api/health")).resolves.toEqual({ status: "ok" });
  });
});
