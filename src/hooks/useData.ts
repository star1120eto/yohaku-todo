"use client";

import useSWR from "swr";
import type {
  Folder,
  SavedFilter,
  Task,
  User,
  UserSettings,
  Workspace,
} from "@/lib/types";

export type WorkspaceWithMembers = Workspace & {
  members: { id: string; name: string }[];
};

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `リクエストに失敗しました (${res.status})`);
  }
  return res.json();
}

export async function api(
  url: string,
  method: string,
  body?: unknown
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "リクエストに失敗しました");
  return data;
}

export function useMe() {
  const { data, isLoading, mutate } = useSWR<{ user: User | null }>(
    "/api/auth",
    fetcher
  );
  return { user: data?.user ?? null, isLoading, mutate };
}

export function useWorkspaces(enabled: boolean) {
  const { data, mutate } = useSWR<{ workspaces: WorkspaceWithMembers[] }>(
    enabled ? "/api/workspaces" : null,
    fetcher
  );
  return { workspaces: data?.workspaces ?? [], mutate };
}

export function useFolders(workspaceId: string | null) {
  const { data, mutate } = useSWR<{ folders: Folder[] }>(
    workspaceId ? `/api/folders?workspaceId=${workspaceId}` : null,
    fetcher
  );
  return { folders: data?.folders ?? [], mutate };
}

export function useTasks(workspaceId: string | null) {
  const { data, mutate } = useSWR<{ tasks: Task[] }>(
    workspaceId ? `/api/tasks?workspaceId=${workspaceId}` : null,
    fetcher,
    { refreshInterval: 15000 } // 共有ワークスペースの変更を拾う
  );
  return { tasks: data?.tasks ?? [], mutate };
}

export function useSettings(enabled: boolean) {
  const { data, mutate } = useSWR<{ settings: UserSettings }>(
    enabled ? "/api/settings" : null,
    fetcher
  );
  return { settings: data?.settings ?? null, mutate };
}

export function useSavedFilters(enabled: boolean) {
  const { data, mutate } = useSWR<{ filters: SavedFilter[] }>(
    enabled ? "/api/filters" : null,
    fetcher
  );
  return { filters: data?.filters ?? [], mutate };
}
