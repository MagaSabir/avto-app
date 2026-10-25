import { ApiError, ServerUnavailableError } from "@/api/client";
import { useHealth } from "@/api/health";

const DATABASE_UNAVAILABLE_MESSAGE =
  "Сервер работает, но база данных недоступна";

function statusMessage(error: Error): string {
  if (error instanceof ServerUnavailableError) return error.message;
  if (error instanceof ApiError && error.status === 503)
    return DATABASE_UNAVAILABLE_MESSAGE;
  return error.message;
}

export function ServerStatus() {
  const { error } = useHealth();
  if (!error) return null;
  return (
    <div role="alert" className="bg-status-out-bg font-medium text-status-out">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-2">
        {statusMessage(error)}
      </div>
    </div>
  );
}
