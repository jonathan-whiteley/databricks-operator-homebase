// ui/src/lib/api.ts
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

export const api = axios.create({ baseURL: "/api", timeout: 30000 });

export function useApi<T>(
  key: readonly unknown[],
  path: string,
  params?: Record<string, unknown>,
  opts?: { enabled?: boolean },
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => (await api.get<T>(path, { params })).data,
    enabled: opts?.enabled ?? true,
  });
}
