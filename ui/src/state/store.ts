// ui/src/state/store.ts
import { useEffect, useState } from "react";

const KEY = "lhm.store_id";

export function useStoreId() {
  const [storeId, setStoreId] = useState<number>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? parseInt(raw, 10) : 1;
  });
  useEffect(() => {
    localStorage.setItem(KEY, String(storeId));
  }, [storeId]);
  return [storeId, setStoreId] as const;
}
