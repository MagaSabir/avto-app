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
export type MeIn = components["schemas"]["MeIn"];

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
    mutationKey: ["auth", "login"],
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
    mutationKey: ["auth", "logout"],
    mutationFn: () => apiFetch<null>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useUpdateMe(): UseMutationResult<Me, Error, MeIn> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["auth", "me", "update"],
    mutationFn: (body: MeIn) =>
      apiFetch<Me>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (me) => {
      queryClient.setQueryData(ME_QUERY_KEY, me);
    },
  });
}

// "Сабир Магомедов", or the login when no name is set
export function displayName(me: Me): string {
  return [me.first_name, me.last_name].filter(Boolean).join(" ") || me.login;
}
