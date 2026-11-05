import { useSyncExternalStore } from "react";

export type ViewScope = "pessoal" | "familia";
const KEY = "meu-caixa-view-scope";
const listeners = new Set<() => void>();
let current: ViewScope = "pessoal";
if (typeof window !== "undefined" && window.localStorage.getItem(KEY) === "familia") current = "familia";

export function setViewScope(scope: ViewScope) {
  current = scope;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, scope);
  listeners.forEach((l) => l());
}

/** Personal view shows only the signed-in member's own rows; family view shows everyone's. */
export function useViewScope(): ViewScope {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => "pessoal",
  );
}

export function filterByScope<T extends { user_id?: string | null }>(rows: T[], scope: ViewScope, uid: string | null | undefined): T[] {
  if (scope === "familia" || !uid) return rows;
  return rows.filter((r) => r.user_id === uid);
}
