import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { components } from "./schema";

export type Settings = components["schemas"]["SettingsOut"];
export type SettingsPatch = components["schemas"]["SettingsPatch"];

export function useSettings(): UseQueryResult<Settings> {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
  });
}

export function usePatchSettings(): UseMutationResult<
  Settings,
  Error,
  SettingsPatch
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsPatch) =>
      apiFetch<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}
