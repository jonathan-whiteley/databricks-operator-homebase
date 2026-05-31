// ui/src/components/DayPartCard.tsx
//
// Rich day-part card modeled on labor-iq's DaypartCard. Shows the forecast,
// a labor % ring, role-mix chips, override input + recompute, and a lock
// button. When locked, the card gets a green border with a checkmark badge.
import { Check, Lock, Moon, RotateCw, Sun, Sunrise, Sunset } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn, money } from "@/lib/util";
import { useStoreId } from "@/state/store";

import { LaborPctRing } from "./LaborPctRing";

// Labor cost per head per day-part — synthetic but plausible: ~$22/hr blended
// rate across a ~3-4 hr day-part shift. Used only to estimate labor % when
// the headcount returned by /labor/recommend is paired with the forecast.
const COST_PER_HEAD: Record<string, number> = {
  Breakfast: 70,
  Lunch: 95,
  Dinner: 95,
  Late: 60,
};

const DEFAULT_COST_PER_HEAD = 80;

const ICON_FOR: Record<string, ComponentType<{ className?: string }>> = {
  Breakfast: Sunrise,
  Lunch: Sun,
  Dinner: Sunset,
  Late: Moon,
};

function roleMix(headcount: number) {
  // Cashier 40%, Cook 40%, Runner 20%, rounded. Guarantee everyone shows up
  // at least once if there's any crew at all.
  if (headcount <= 0) return { cashier: 0, cook: 0, runner: 0 };
  const cashier = Math.max(1, Math.round(headcount * 0.4));
  const cook = Math.max(1, Math.round(headcount * 0.4));
  const runner = Math.max(0, headcount - cashier - cook);
  return { cashier, cook, runner: Math.max(runner, headcount >= 3 ? 1 : 0) };
}

export function DayPartCard({
  daypart, forecast, transactions, date,
}: {
  daypart: string;
  forecast: number;
  transactions: number;
  date: string;
}) {
  const [storeId] = useStoreId();
  const [override, setOverride] = useState<string>("");
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const Icon = ICON_FOR[daypart] ?? Sun;
  const overrideNum = override ? parseFloat(override) : null;
  const revenue = overrideNum != null && !isNaN(overrideNum) ? overrideNum : forecast;
  const isOverridden = overrideNum != null && !isNaN(overrideNum) && Math.round(overrideNum) !== Math.round(forecast);

  // Reset lock state if the underlying forecast/date/daypart changes (e.g.
  // the user switches stores).
  useEffect(() => {
    setLocked(false);
    setHeadcount(null);
    setOverride("");
  }, [storeId, date, daypart]);

  const projectedCost =
    headcount != null
      ? headcount * (COST_PER_HEAD[daypart] ?? DEFAULT_COST_PER_HEAD)
      : revenue * 0.28; // before recompute, show the target rate so the ring isn't blank
  const laborPct = revenue > 0 ? projectedCost / revenue : 0;

  async function recompute() {
    setRecomputing(true);
    try {
      const r = await api.post("/labor/recommend", {
        forecast_revenue: revenue,
        daypart,
      });
      setHeadcount(r.data.headcount);
    } finally {
      setRecomputing(false);
    }
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
        note: isOverridden ? "manager override" : null,
      });
      setLocked(true);
    } finally {
      setSaving(false);
    }
  }

  const crew = roleMix(headcount ?? 0);

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        locked
          ? "border-2 border-[color:var(--color-success)] shadow-[0_8px_24px_rgba(0,169,114,0.18)]"
          : isOverridden
            ? "border-[color:var(--color-lava)]"
            : "border-[color:var(--color-hairline)]",
      )}
      style={{ minHeight: 0, maxHeight: 280 }}
    >
      {locked && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Check className="size-3" strokeWidth={3} /> Locked
        </div>
      )}

      <header className="flex items-start gap-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            locked
              ? "bg-[color:var(--color-success)] text-white"
              : "bg-[color:var(--color-navy)] text-white",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold leading-tight text-[color:var(--color-ink)]">{daypart}</h4>
          <div className="font-mono text-[11px] text-[color:var(--color-ink-soft)]">
            {transactions.toLocaleString()} tx forecast
          </div>
        </div>
      </header>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-ink-soft)]">
            {isOverridden ? "Your estimate" : "Forecast revenue"}
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-2xl font-semibold leading-none",
              isOverridden ? "text-[color:var(--color-lava)]" : "text-[color:var(--color-ink)]",
            )}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {money(revenue)}
          </div>
          {isOverridden && (
            <div className="mt-0.5 font-mono text-[10px] text-[color:var(--color-ink-soft)] line-through">
              {money(forecast)}
            </div>
          )}
        </div>
        <LaborPctRing pct={laborPct} size={56} compact />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <RoleChip label="Cashier" count={crew.cashier} dim={headcount == null} />
        <RoleChip label="Cook" count={crew.cook} dim={headcount == null} />
        {crew.runner > 0 && <RoleChip label="Runner" count={crew.runner} dim={headcount == null} />}
        {headcount != null && (
          <span className="ml-auto font-mono text-[11px] text-[color:var(--color-ink-soft)]">
            {headcount} crew
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5">
        <div className="flex items-center rounded-md border border-[color:var(--color-hairline)] focus-within:border-[color:var(--color-lava)]">
          <span className="pl-2 text-xs text-[color:var(--color-ink-soft)]">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={override}
            placeholder={String(Math.round(forecast))}
            onChange={(e) => setOverride(e.target.value)}
            disabled={locked}
            className="w-20 bg-transparent px-1 py-1 text-xs font-mono text-[color:var(--color-ink)] outline-none disabled:opacity-60"
          />
        </div>
        <button
          onClick={recompute}
          disabled={recomputing || locked}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white transition-colors",
            "bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-soft)]",
            (recomputing || locked) && "opacity-60",
          )}
        >
          <RotateCw className={cn("size-3", recomputing && "animate-spin")} strokeWidth={2.5} />
          {recomputing ? "…" : "Recompute"}
        </button>
        <button
          onClick={lock}
          disabled={headcount == null || saving || locked}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white transition-colors",
            locked
              ? "bg-[color:var(--color-success)]"
              : "bg-[color:var(--color-lava)] hover:opacity-90",
            (headcount == null || saving) && !locked && "opacity-50",
          )}
        >
          {locked ? <Check className="size-3" strokeWidth={3} /> : <Lock className="size-3" strokeWidth={2.5} />}
          {locked ? "Locked" : saving ? "…" : "Lock"}
        </button>
      </div>
    </article>
  );
}

function RoleChip({ label, count, dim }: { label: string; count: number; dim: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        dim
          ? "border-dashed border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]"
          : "border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] text-[color:var(--color-ink)]",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="font-mono font-semibold">{count}</span>
    </span>
  );
}
