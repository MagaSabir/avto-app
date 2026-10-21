import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ME_QUERY_KEY } from "@/api/auth";
import { UnauthorizedError } from "@/api/client";

export function createQueryClient(): QueryClient {
  // A 401 on any non-auth request means the session is gone: refetch `me`
  // so RequireAuth sends the user to the login page.
  const handleUnauthorized = (error: Error, queryKey?: readonly unknown[]) => {
    if (!(error instanceof UnauthorizedError)) return;
    if (queryKey?.[0] === "auth") return;
    void client.resetQueries({ queryKey: ME_QUERY_KEY });
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        handleUnauthorized(error, query.queryKey);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        handleUnauthorized(error, mutation.options.mutationKey);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof UnauthorizedError) && failureCount < 1,
      },
    },
  });
  return client;
}
