export const SERVER_UNAVAILABLE_MESSAGE = "Сервер недоступен, попробуйте позже";

// Gateway errors come from the reverse proxy when the API is down.
const GATEWAY_STATUSES = new Set([502, 504]);
const JSON_BODY_METHODS = new Set(["POST", "PATCH", "DELETE"]);

export class ServerUnavailableError extends Error {
  constructor() {
    super(SERVER_UNAVAILABLE_MESSAGE);
    this.name = "ServerUnavailableError";
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

function buildUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
  return `${base}${path}`;
}

function errorMessage(body: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const { message, detail } = parsed as {
        message?: unknown;
        detail?: unknown;
      };
      if (typeof message === "string") return message;
      if (typeof detail === "string") return detail;
    }
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return `HTTP ${String(status)}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (JSON_BODY_METHODS.has(method))
    headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ServerUnavailableError();
  }

  if (GATEWAY_STATUSES.has(response.status)) throw new ServerUnavailableError();
  if (!response.ok) {
    const message = errorMessage(await response.text(), response.status);
    if (response.status === 401) throw new UnauthorizedError(message);
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}
