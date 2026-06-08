// ui/src/state/store.ts
// Module-level shared store so every useStoreId() consumer sees the same value
// and re-renders when StoreSelector changes it. (Earlier version used per-hook
// useState which left other views stuck on the initial store.)
import { useSyncExternalStore } from "react";

const KEY = "lhm.store_id";

let _storeId: number = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseInt(raw, 10) : 1;
  } catch {
    return 1;
  }
})();

const _listeners = new Set<() => void>();

function _subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

function _snapshot(): number {
  return _storeId;
}

function _set(next: number) {
  if (next === _storeId) return;
  _storeId = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    /* ignore */
  }
  _listeners.forEach((cb) => cb());
}

export function useStoreId() {
  const storeId = useSyncExternalStore(_subscribe, _snapshot, _snapshot);
  return [storeId, _set] as const;
}
