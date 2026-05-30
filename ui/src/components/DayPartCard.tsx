// ui/src/components/DayPartCard.tsx
import { useState } from "react";

import { api } from "@/lib/api";
import { money } from "@/lib/util";
import { useStoreId } from "@/state/store";

export function DayPartCard({
  daypart, forecast, transactions, date,
}: {
  daypart: string;
  forecast: number;
  transactions: number;
  date: string;
}) {
  const [storeId] = useStoreId();
  const [override, setOverride] = useState<number | null>(null);
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function recompute() {
    const v = override ?? forecast;
    const r = await api.post("/labor/recommend", { forecast_revenue: v, daypart });
    setHeadcount(r.data.headcount);
  }

  async function lock() {
    if (headcount == null) return;
    setSaving(true);
    try {
      await api.post("/labor/override", {
        store_id: storeId,
        date,
        daypart,
        headcount,
        note: override ? "manager override" : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[color:var(--color-ink)]">{daypart}</h4>
        <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">{transactions} tx</span>
      </div>
      <div className="mt-2 font-mono text-xl">{money(forecast)}</div>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-[color:var(--color-ink-soft)]">Override $</label>
        <input
          type="number"
          value={override ?? ""}
          onChange={(e) => setOverride(e.target.value ? parseFloat(e.target.value) : null)}
          className="w-24 rounded border border-[color:var(--color-hairline)] px-2 py-1 text-sm"
        />
        <button
          onClick={recompute}
          className="rounded-md bg-[color:var(--color-navy)] px-2 py-1 text-xs font-medium text-white"
        >
          Recompute
        </button>
      </div>
      {headcount != null && (
        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--color-hairline)] pt-3">
          <div className="text-sm text-[color:var(--color-ink-soft)]">
            Recommended{" "}
            <span className="font-mono font-semibold text-[color:var(--color-ink)]">{headcount}</span>
          </div>
          <button
            disabled={saving}
            onClick={lock}
            className="rounded-md bg-[color:var(--color-lava)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Locking…" : "Lock"}
          </button>
        </div>
      )}
    </div>
  );
}
