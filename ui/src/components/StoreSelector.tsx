// ui/src/components/StoreSelector.tsx
import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

type Store = { store_id: number; store_name: string; city: string; state: string };

export function StoreSelector() {
  const [storeId, setStoreId] = useStoreId();
  const { data } = useApi<Store[]>(["stores"], "/stores");
  return (
    <select
      value={storeId}
      onChange={(e) => setStoreId(parseInt(e.target.value, 10))}
      className="rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--color-ink)]"
    >
      {(data ?? []).map((s) => (
        <option key={s.store_id} value={s.store_id}>
          {s.store_name} · {s.city}, {s.state}
        </option>
      ))}
    </select>
  );
}
