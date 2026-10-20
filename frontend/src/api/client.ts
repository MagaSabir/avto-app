const SERVER_UNAVAILABLE_MESSAGE =
  "Сервер недоступен: проверьте, что ПК включён и Tailscale подключён";

// Gateway errors come from `tailscale serve` when the backend container is down.
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
    response = await fetch(buildUrl(path), { ...init, headers });
  } catch {
    throw new ServerUnavailableError();
  }

  if (GATEWAY_STATUSES.has(response.status)) throw new ServerUnavailableError();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessage(await response.text(), response.status),
    );
  }
  return (await response.json()) as T;
}
