// ui/src/components/db/DayPartPlannerCard.tsx
//
// Day-part planner card, ported faithfully from the design template
// (`/tmp/claude_design/lakehouse-market-homebase-app/project/app/labor.jsx`
// — `DaypartCard`). Reproduces the design's denser visual:
//
//   - Themed band at the top: tinted background, deep-color icon tile,
//     daypart label + window, and a four/five-bar mini histogram.
//   - "Predicted sales" / "Your estimate" with editable override input that
//     swaps inline (no separate textbox below the card).
//   - Crew + Labor cost mini-stats with deltas vs the forecast baseline.
//   - "The crew" role stack: row per role with icon tile, dot string, count.
//   - Override-diff strip with Reset action when the forecast has been
//     overridden.
//
// Wired to the real backend:
//   - POST /api/labor/recommend → live headcount prediction (Recompute button)
//   - POST /api/labor/override  → per-card Lock with ConfirmDialog
//
// Unlike the design (which keeps a single ApproveModal at the page level),
// each card owns its own ConfirmDialog so the user can lock one day-part at a
// time while the parent still offers an "Approve all" sweep.
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { money } from "@/lib/util";
import { useStoreId } from "@/state/store";

import Icon, { type IconName } from "./Icon";
import { useToast } from "./ToastRegion";

/* ============================ Staffing model ============================
   Ported verbatim from labor.jsx so the on-card crew breakdown matches the
   design's compute. The /labor/recommend endpoint may still override the
   headcount, but the role-mix split below is purely local. */
const ROLE_RATES = { cook: 18.5, cashier: 17.25, lead: 21.0, manager: 28.0 };
const TARGET_RPLH: Record<DaypartId, number> = {
  breakfast: 80,
  lunch: 100,
  dinner: 85,
  late: 60,
};
const DP_HOURS: Record<DaypartId, number> = {
  breakfast: 3,
  lunch: 4,
  dinner: 4,
  late: 3,
};
const ROLE_MIX: Record<DaypartId, Record<RoleId, number>> = {
  breakfast: { cook: 0.4, cashier: 0.4, lead: 0.2, manager: 0.0 },
  lunch: { cook: 0.45, cashier: 0.35, lead: 0.13, manager: 0.07 },
  dinner: { cook: 0.45, cashier: 0.33, lead: 0.15, manager: 0.07 },
  late: { cook: 0.43, cashier: 0.43, lead: 0.14, manager: 0.0 },
};
const ROLE_FLOORS: Record<DaypartId, Record<RoleId, number>> = {
  breakfast: { cook: 1, cashier: 1, lead: 1, manager: 0 },
  lunch: { cook: 2, cashier: 1, lead: 1, manager: 1 },
  dinner: { cook: 2, cashier: 1, lead: 1, manager: 1 },
  late: { cook: 1, cashier: 1, lead: 1, manager: 0 },
};
const DP_CONF: Record<DaypartId, number> = {
  breakfast: 0.09,
  lunch: 0.06,
  dinner: 0.07,
  late: 0.13,
};

type RoleId = "cook" | "cashier" | "lead" | "manager";
export type DaypartId = "breakfast" | "lunch" | "dinner" | "late";

type Staffing = {
  headcount: number;
  roles: Record<RoleId, number>;
  cost: number;
  hours: number;
};

function computeStaffing(dp: DaypartId, revenue: number): Staffing {
  const hours = DP_HOURS[dp];
  const target = TARGET_RPLH[dp];
  const laborHours = Math.max(0, revenue / target);
  const headcount = Math.max(0, Math.ceil(laborHours / hours));
  const mix = ROLE_MIX[dp];
  const floors = ROLE_FLOORS[dp];
  const raw: Record<RoleId, number> = {
    cook: headcount * mix.cook,
    cashier: headcount * mix.cashier,
    lead: headcount * mix.lead,
    manager: headcount * mix.manager,
  };
  const roles: Record<RoleId, number> = { ...floors };
  let assigned = roles.cook + roles.cashier + roles.lead + roles.manager;
  let remaining = Math.max(0, headcount - assigned);
  const diff = (Object.entries(raw) as [RoleId, number][])
    .map(([k, v]) => [k, Math.max(0, v - floors[k])] as [RoleId, number])
    .sort((a, b) => b[1] - a[1]);
  let i = 0;
  while (remaining > 0 && diff.length > 0) {
    roles[diff[i % diff.length][0]] += 1;
    remaining--;
    i++;
  }
  const cost =
    roles.cook * hours * ROLE_RATES.cook +
    roles.cashier * hours * ROLE_RATES.cashier +
    roles.lead * hours * ROLE_RATES.lead +
    roles.manager * hours * ROLE_RATES.manager;
  return { headcount, roles, cost, hours };
}

/* ============================ Theming ============================ */
type Theme = {
  tint: string;
  deep: string;
  icon: IconName;
  label: string;
  time: string;
  blurb: string;
  curve: number[];
};

const DP_THEME: Record<DaypartId, Theme> = {
  breakfast: {
    tint: "var(--db-yellow-300)",
    deep: "var(--db-yellow-700)",
    icon: "sunrise",
    label: "Breakfast",
    time: "6–10a",
    blurb: "Early traffic",
    curve: [0.25, 0.6, 1, 0.7],
  },
  lunch: {
    tint: "var(--db-lava-300)",
    deep: "var(--db-lava-600)",
    icon: "sun",
    label: "Lunch",
    time: "11a–2p",
    blurb: "Peak rush",
    curve: [0.35, 0.85, 1, 0.95, 0.6],
  },
  dinner: {
    tint: "var(--db-maroon-300)",
    deep: "var(--db-maroon-600)",
    icon: "sunset",
    label: "Dinner",
    time: "5–8p",
    blurb: "Family pickup",
    curve: [0.5, 0.9, 1, 0.7, 0.4],
  },
  late: {
    tint: "var(--db-blue-300)",
    deep: "var(--db-blue-700)",
    icon: "moon",
    label: "Late",
    time: "8–11p",
    blurb: "Wind-down",
    curve: [0.85, 0.6, 0.3, 0.15],
  },
};

const moneyK = (n: number) =>
  n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n);

export function daypartId(label: string): DaypartId {
  const id = label.toLowerCase();
  if (id === "breakfast" || id === "lunch" || id === "dinner" || id === "late") {
    return id;
  }
  return "lunch";
}

/* ============================ Role stack ============================ */
type RoleItem = { k: RoleId; label: string; icon: IconName; color: string };
function roleItems(accent: string): RoleItem[] {
  return [
    { k: "cook", label: "Cooks", icon: "flame", color: accent },
    { k: "cashier", label: "Cashiers", icon: "cash", color: "var(--db-navy-600)" },
    { k: "lead", label: "Leads", icon: "star", color: "var(--db-yellow-700)" },
    { k: "manager", label: "Manager", icon: "user", color: "var(--db-green-700)" },
  ];
}

function RoleStack({
  roles,
  accent,
}: {
  roles: Record<RoleId, number>;
  accent: string;
}) {
  const items = roleItems(accent).filter((it) => roles[it.k] > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it) => (
        <div
          key={it.k}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "var(--db-oat-medium)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={it.icon} size={12} color={it.color} stroke={2} />
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "var(--db-navy-800)" }}>
            {it.label}
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: roles[it.k] }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: it.color,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--db-navy-800)",
              minWidth: 14,
              textAlign: "right",
            }}
          >
            {roles[it.k]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================ Mini stat ============================ */
function MiniStat({
  label,
  value,
  delta,
  isMoney,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  isMoney?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--db-gray-text)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: 23,
            fontWeight: 600,
            color: "var(--db-navy-800)",
            letterSpacing: "-0.01em",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {value}
        </span>
        {delta != null && delta !== 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
              color:
                delta > 0 ? "var(--db-green-700)" : "var(--db-lava-700)",
            }}
          >
            {delta > 0 ? "+" : "−"}
            {isMoney ? moneyK(Math.abs(delta)) : Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================ Day-part planner card ============================ */
export type DayPartPlannerCardProps = {
  /** Display label as it comes back from the API ("Breakfast" / "Lunch" / ...). */
  daypart: string;
  /** Forecast revenue from /labor/today — acts as the baseline. */
  forecast: number;
  /** Forecast transactions for the eyebrow context line. */
  transactions: number;
  /** ISO date string for the override payload. */
  date: string;
  /** Optional override (in dollars) coming from the parent (e.g. AIRec bump). */
  override?: number | null;
  /** Notify the parent when the user clears or sets an override. */
  onOverrideChange?: (next: number | null) => void;
  /** Show the confidence/Genie footnote line. Defaults to true. */
  showConfidence?: boolean;
  /** Called after a successful /labor/override write so the parent can refresh. */
  onLocked?: (payload: { daypart: string; headcount: number }) => void;
};

export default function DayPartPlannerCard({
  daypart,
  forecast,
  transactions,
  date,
  override,
  onOverrideChange,
  showConfidence = true,
  onLocked,
}: DayPartPlannerCardProps) {
  const id = daypartId(daypart);
  const theme = DP_THEME[id];
  const [storeId] = useStoreId();
  const toast = useToast();

  // Local (uncontrolled) override state when the parent doesn't pass `override`.
  const [localOverride, setLocalOverride] = useState<number | null>(null);
  const activeOverride =
    override !== undefined ? override ?? null : localOverride;
  const revenue = activeOverride ?? forecast;
  const isOverridden =
    activeOverride != null && Math.round(activeOverride) !== Math.round(forecast);

  // Inline override edit state.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Lock + recompute machinery.
  const [recomputing, setRecomputing] = useState(false);
  const [aiHeadcount, setAiHeadcount] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reset everything when the underlying daypart / date / store changes.
  useEffect(() => {
    setLocked(false);
    setEditing(false);
    setDraft("");
    setLocalOverride(null);
    setAiHeadcount(null);
  }, [storeId, date, daypart, forecast]);

  // Staffing math: the design's compute is good enough for the visual; we
  // swap in the served model's headcount when Recompute returns.
  const base = computeStaffing(id, forecast);
  const localCur = computeStaffing(id, revenue);
  const cur: Staffing =
    aiHeadcount != null
      ? {
          ...localCur,
          headcount: aiHeadcount,
          // Re-derive cost from the model's headcount using the same hour
          // budget so the labor % ring stays believable.
          cost:
            aiHeadcount *
            DP_HOURS[id] *
            // Blended rate ≈ weighted avg of role rates by ROLE_MIX[id].
            (ROLE_MIX[id].cook * ROLE_RATES.cook +
              ROLE_MIX[id].cashier * ROLE_RATES.cashier +
              ROLE_MIX[id].lead * ROLE_RATES.lead +
              ROLE_MIX[id].manager * ROLE_RATES.manager),
        }
      : localCur;
  const hcD = cur.headcount - base.headcount;
  const costD = cur.cost - base.cost;

  function applyOverride(next: number | null) {
    if (override === undefined) setLocalOverride(next);
    onOverrideChange?.(next);
  }

  function startEdit() {
    if (locked) return;
    setDraft(String(Math.round(revenue)));
    setEditing(true);
  }
  function commit() {
    const n = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n >= 0) {
      if (Math.round(n) === Math.round(forecast)) {
        applyOverride(null);
      } else {
        applyOverride(n);
      }
    }
    setEditing(false);
  }

  async function recompute() {
    setRecomputing(true);
    try {
      const r = await api.post("/labor/recommend", {
        forecast_revenue: revenue,
        daypart,
      });
      setAiHeadcount(r.data.headcount);
    } catch {
      // Serving endpoint may be cold — silently fall back to the local
      // compute (already on screen).
      setAiHeadcount(null);
    } finally {
      setRecomputing(false);
    }
  }

  async function handleConfirm(note: string) {
    try {
      await api.post("/labor/override", {
        store_id: storeId,
        date,
        daypart,
        headcount: cur.headcount,
        note: note || (isOverridden ? "manager override" : null),
      });
      setLocked(true);
      setConfirmOpen(false);
      toast.success(`Locked ${theme.label} — written to app_labor_overrides`);
      onLocked?.({ daypart, headcount: cur.headcount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  const confirmDetails = [
    { label: "Day-part", value: theme.label },
    { label: "Forecasted revenue", value: money(revenue) },
    { label: "Crew", value: String(cur.headcount) },
    { label: "Labor cost", value: moneyK(cur.cost) },
  ];

  const borderColor: CSSProperties["border"] = locked
    ? `2px solid var(--db-green-600)`
    : isOverridden
      ? `2px solid ${theme.deep}`
      : "1px solid var(--db-gray-lines)";

  return (
    <article
      style={{
        background: "#fff",
        borderRadius: 14,
        border: borderColor,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: isOverridden || locked ? "var(--shadow-md)" : "none",
        position: "relative",
      }}
    >
      {locked && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "var(--db-green-600)",
            color: "#fff",
            fontSize: 9,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 999,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="check" size={10} color="#fff" stroke={2.4} /> Locked
        </div>
      )}
      {!locked && isOverridden && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: theme.deep,
            color: "#fff",
            fontSize: 9,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 999,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Adjusted
        </div>
      )}

      {/* themed band ----------------------------------------------------- */}
      <div
        style={{
          background: theme.tint,
          padding: "16px 18px 14px",
          borderBottom: "1px solid var(--db-gray-lines)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: theme.deep,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={theme.icon} size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--db-navy-800)",
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              {theme.label}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--db-navy-700)",
                marginTop: 2,
                fontFamily: "var(--font-mono)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {theme.time} · {transactions.toLocaleString()} tx · {theme.blurb}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            height: 30,
            marginTop: 13,
          }}
        >
          {theme.curve.map((y, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${y * 100}%`,
                background: theme.deep,
                opacity: 0.3 + y * 0.5,
                borderRadius: "3px 3px 1px 1px",
              }}
            />
          ))}
        </div>
      </div>

      {/* revenue -------------------------------------------------------- */}
      <div style={{ padding: "16px 18px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--db-gray-text)",
              textTransform: "uppercase",
              letterSpacing: "0.09em",
            }}
          >
            {isOverridden ? "Your estimate" : "Predicted sales"}
          </span>
          {!editing && !locked && (
            <button
              type="button"
              onClick={startEdit}
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                color: isOverridden ? theme.deep : "var(--db-gray-text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <Icon name="edit" size={11} color="currentColor" />{" "}
              {isOverridden ? "Adjust" : "Override"}
            </button>
          )}
        </div>
        {editing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              paddingBottom: 5,
              borderBottom: `2px solid ${theme.deep}`,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: "var(--db-navy-800)",
              }}
            >
              $
            </span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                font: "600 28px/1.1 var(--font-sans)",
                color: "var(--db-navy-800)",
                border: 0,
                outline: 0,
                padding: 0,
                background: "transparent",
                width: "100%",
                letterSpacing: "-0.02em",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: isOverridden ? theme.deep : "var(--db-navy-800)",
                letterSpacing: "-0.02em",
                fontFeatureSettings: '"tnum"',
                lineHeight: 1.1,
                fontFamily: "var(--font-mono)",
              }}
            >
              {money(revenue)}
            </span>
            {isOverridden && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--db-gray-text)",
                  textDecoration: "line-through",
                  fontFeatureSettings: '"tnum"',
                  fontFamily: "var(--font-mono)",
                }}
              >
                {money(forecast)}
              </span>
            )}
          </div>
        )}
        {showConfidence && !editing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
              fontSize: 11,
              color: "var(--db-gray-text)",
            }}
          >
            <Icon
              name={isOverridden ? "edit" : "spark"}
              size={11}
              color={isOverridden ? theme.deep : "var(--db-lava-600)"}
            />
            {isOverridden
              ? "Manual override"
              : `Genie forecast · ± ${(DP_CONF[id] * 100).toFixed(0)}%`}
          </div>
        )}
      </div>

      {/* crew + cost ---------------------------------------------------- */}
      <div
        style={{
          padding: "0 18px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <MiniStat
          label="Crew"
          value={cur.headcount}
          delta={isOverridden || aiHeadcount != null ? hcD : null}
        />
        <MiniStat
          label="Labor cost"
          value={moneyK(cur.cost)}
          delta={isOverridden || aiHeadcount != null ? costD : null}
          isMoney
        />
      </div>

      {/* role mix ------------------------------------------------------- */}
      <div style={{ padding: "14px 18px 4px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--db-gray-text)",
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>The crew</span>
          {aiHeadcount != null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--db-blue-700)",
                letterSpacing: "0.04em",
              }}
            >
              AI prediction
            </span>
          )}
        </div>
        <RoleStack roles={cur.roles} accent={theme.deep} />
      </div>

      {/* override diff strip + actions row ------------------------------ */}
      {isOverridden && !locked && (
        <div
          style={{
            margin: "14px 18px 0",
            padding: "9px 12px",
            background: "var(--db-oat-light)",
            borderRadius: 9,
            border: `1px dashed ${theme.deep}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
          }}
        >
          <Icon name="info" size={12} color={theme.deep} />
          <span style={{ flex: 1, color: "var(--db-gray-text)" }}>
            <strong style={{ color: "var(--db-navy-800)", fontWeight: 600 }}>
              {hcD > 0 ? "+" : ""}
              {hcD} crew · {costD >= 0 ? "+" : "−"}
              {moneyK(Math.abs(costD))}
            </strong>{" "}
            vs forecast
          </span>
          <button
            type="button"
            onClick={() => applyOverride(null)}
            style={{
              background: "transparent",
              border: 0,
              color: theme.deep,
              cursor: "pointer",
              fontSize: 11,
              padding: 0,
              fontWeight: 500,
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* footer actions: recompute + lock ------------------------------- */}
      <div
        style={{
          padding: "14px 18px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: isOverridden && !locked ? 8 : 0,
        }}
      >
        <button
          type="button"
          onClick={recompute}
          disabled={recomputing || locked}
          className="hb-btn"
          style={{
            background: "var(--db-navy-800)",
            color: "#fff",
            border: 0,
            padding: "7px 11px",
            borderRadius: 8,
            font: "500 12px/1 var(--font-sans)",
            cursor: recomputing || locked ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            opacity: recomputing || locked ? 0.55 : 1,
          }}
          title="Ask the served model for a headcount recommendation"
        >
          <Icon
            name="refresh"
            size={12}
            color="#fff"
            stroke={2.2}
            style={recomputing ? { animation: "hb-spin 0.9s linear infinite" } : undefined}
          />
          {recomputing ? "…" : "Recompute"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={locked}
          className="hb-btn"
          style={{
            marginLeft: "auto",
            background: locked ? "var(--db-green-600)" : "var(--db-lava-600)",
            color: "#fff",
            border: 0,
            padding: "7px 12px",
            borderRadius: 8,
            font: "500 12px/1 var(--font-sans)",
            cursor: locked ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            opacity: locked ? 0.85 : 1,
          }}
        >
          <Icon
            name={locked ? "check" : "calendar"}
            size={12}
            color="#fff"
            stroke={2.2}
          />
          {locked ? "Locked" : "Lock"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Lock ${theme.label} day-part schedule?`}
        description="Writes the headcount and crew mix to app_labor_overrides in Lakebase."
        details={confirmDetails}
        noteLabel="Reason for lock / override note"
        notePlaceholder={
          isOverridden ? "Why are you overriding the forecast?" : undefined
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </article>
  );
}

/* Helper exported for the parent so totals stay in sync with the card. */
export function staffingFor(daypart: string, revenue: number): Staffing {
  return computeStaffing(daypartId(daypart), revenue);
}
