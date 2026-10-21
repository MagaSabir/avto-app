import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

export type Me = components["schemas"]["MeOut"];
export type LoginIn = components["schemas"]["LoginIn"];

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function useMe(): UseQueryResult<Me> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<Me>("/api/auth/me"),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin(): UseMutationResult<null, Error, LoginIn> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginIn) =>
      apiFetch<null>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useLogout(): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>("/api/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
