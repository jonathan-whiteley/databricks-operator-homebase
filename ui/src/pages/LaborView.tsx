// ui/src/pages/LaborView.tsx
//
// Labor view, rebuilt faithfully against the design template at
// `/tmp/claude_design/lakehouse-market-homebase-app/project/app/labor.jsx`.
//
// Sections (top to bottom):
//   1. PageHead — title + subtitle + "Approve all day-part schedules" action
//   2. PlannerHero — navy hero card showing tomorrow's plan: predicted sales,
//      recommended labor, labor % of sales, refresh affordance
//   3. AIRec — Genie recommendation with a "Bump lunch +12%" action that
//      pre-fills the lunch override on the planner grid
//   4. Day-part planner grid — four DayPartPlannerCard cards
//   5. Schedule preview — compact strip showing the resulting crew per slot
//   6. Recent approvals — empty-state card (live wiring is a follow-up)
//
// Data wiring:
//   - GET  /api/labor/today       → dayparts array (useApi)
//   - POST /api/labor/recommend   → per-card Recompute (inside card)
//   - POST /api/labor/override    → per-card Lock + "Approve all" sweep
//
// "Timecard" language has been retired in favor of "day-part schedule" —
// the planner cards are the unit of approval now.
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AIRec,
  Btn,
  Card,
  DayPartPlannerCard,
  Icon,
  LakebaseTag,
  PATHS,
  PageHead,
  Pill,
  staffingFor,
  useToast,
} from "@/components/db";
import { api, useApi } from "@/lib/api";
import { money } from "@/lib/util";
import { useStoreId } from "@/state/store";

type DayPart = {
  daypart: string;
  forecast_revenue: number;
  forecast_transactions: number;
};

type Today = {
  store_id: number;
  date: string;
  dayparts: DayPart[];
};

const moneyK = (n: number) =>
  n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n);

function formatDayLabel(iso: string): string {
  // Parse the YYYY-MM-DD without TZ shifts.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function LaborView() {
  const [storeId] = useStoreId();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, refetch } = useApi<Today>(
    ["labor-today", storeId, today],
    "/labor/today",
    { store_id: storeId, date: today },
  );
  const dayparts = useMemo(() => data?.dayparts ?? [], [data]);
  const date = data?.date ?? today;
  const dayLabel = formatDayLabel(date);

  // Per-card override state lives here so the AIRec quick-action can prefill
  // the lunch slot without each card needing to subscribe to anything.
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  useEffect(() => {
    // Clear overrides when the underlying day-part set changes (e.g. on
    // store-switch).
    setOverrides({});
  }, [storeId, date]);

  // Refresh affordance — the design has a "Refresh forecast" link with a
  // light pulse. We wire it to react-query's refetch so the user gets a
  // genuine reload of /labor/today.
  const [refreshing, setRefreshing] = useState(false);
  const [lastRun, setLastRun] = useState<string>("just now");
  async function refresh() {
    setRefreshing(true);
    try {
      await refetch();
      setLastRun("just now");
    } finally {
      setRefreshing(false);
    }
  }

  // Rolling totals — compute against the same staffing model the cards use so
  // the hero numbers line up with what the user sees per-card.
  const totals = useMemo(() => {
    let rev = 0;
    let cost = 0;
    let baseRev = 0;
    let baseCost = 0;
    let headcount = 0;
    let baseHc = 0;
    for (const dp of dayparts) {
      const overrideVal = overrides[dp.daypart];
      const currentRevenue =
        overrideVal != null ? overrideVal : dp.forecast_revenue;
      const baseStaff = staffingFor(dp.daypart, dp.forecast_revenue);
      const curStaff = staffingFor(dp.daypart, currentRevenue);
      rev += currentRevenue;
      cost += curStaff.cost;
      baseRev += dp.forecast_revenue;
      baseCost += baseStaff.cost;
      headcount += curStaff.headcount;
      baseHc += baseStaff.headcount;
    }
    return { rev, cost, baseRev, baseCost, headcount, baseHc };
  }, [dayparts, overrides]);

  const overrideCount = Object.values(overrides).filter((v) => v != null).length;
  const laborPct = totals.rev > 0 ? totals.cost / totals.rev : 0;
  const over = laborPct > 0.26;
  const under = laborPct < 0.22;
  const verdict = over ? "Above target" : under ? "Below target" : "On target";
  const verdictColor = over
    ? "var(--db-lava-400)"
    : under
      ? "var(--db-yellow-400)"
      : "var(--db-green-400)";

  // "Approve all" — opens a single confirm, then loops one /labor/override
  // POST per day-part using the model-blessed staffing math.
  const [approveAllOpen, setApproveAllOpen] = useState(false);

  async function handleApproveAll(note: string) {
    if (dayparts.length === 0) return;
    let ok = 0;
    let failed = 0;
    for (const dp of dayparts) {
      const overrideVal = overrides[dp.daypart];
      const revenue =
        overrideVal != null ? overrideVal : dp.forecast_revenue;
      const staff = staffingFor(dp.daypart, revenue);
      try {
        await api.post("/labor/override", {
          store_id: storeId,
          date,
          daypart: dp.daypart,
          headcount: staff.headcount,
          note: note || "Approve all (one-tap)",
        });
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setApproveAllOpen(false);
    if (failed === 0) {
      toast.success(
        `Approved ${ok} day-part schedule${ok === 1 ? "" : "s"}.`,
      );
      setOverrides({});
    } else if (ok > 0) {
      toast.error(`Saved ${ok}, ${failed} failed. Try again.`);
    } else {
      toast.error(`Couldn't save schedules. Try again.`);
    }
  }

  const approveAllDetails = [
    { label: "Date", value: dayLabel },
    { label: "Day-parts", value: String(dayparts.length) },
    { label: "Forecast total", value: money(totals.baseRev) },
    { label: "Adjusted total", value: money(totals.rev) },
    { label: "Recommended crew", value: String(totals.headcount) },
  ];

  return (
    <div
      style={{
        background: "var(--db-oat-light)",
        minHeight: "100%",
        margin: "-28px -32px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 32px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <PageHead
          icon="labor"
          title="Labor"
          sub="Plan the day-part schedule, then lock it in. Forecasts, crew mix and labor % update live."
        >
          {overrideCount > 0 && (
            <Btn
              variant="ghost"
              icon="refresh"
              onClick={() => setOverrides({})}
            >
              Reset overrides
            </Btn>
          )}
          <Btn
            variant="dark"
            icon="check"
            onClick={() => setApproveAllOpen(true)}
            disabled={dayparts.length === 0}
            dataTourTarget="labor.approve"
          >
            Approve all day-part schedules
          </Btn>
        </PageHead>

        {/* ===== Planner hero ===== */}
        <PlannerHero
          dayLabel={dayLabel}
          totals={totals}
          overrideCount={overrideCount}
          laborPct={laborPct}
          verdict={verdict}
          verdictColor={verdictColor}
          refreshing={refreshing}
          lastRun={lastRun}
          onRefresh={refresh}
        />

        {/* ===== Genie recommendation ===== */}
        <AIRec
          tone="navy"
          action="Bump lunch +12%"
          onAction={() => {
            const lunch = dayparts.find(
              (dp) => dp.daypart.toLowerCase() === "lunch",
            );
            if (!lunch) {
              toast.error("No lunch day-part in this forecast.");
              return;
            }
            const next = Math.round(lunch.forecast_revenue * 1.12);
            setOverrides((o) => ({ ...o, [lunch.daypart]: next }));
            toast.success(
              `Lunch bumped to ${money(next)} — crew updated.`,
            );
          }}
        >
          Genie sees lunch running <strong>~12% hot</strong> versus a normal
          day — historically worth a <strong>+2 cook</strong> bump from the
          peak window. The rest of the day tracks to forecast.
        </AIRec>

        {/* ===== Day-part planner grid ===== */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 14,
              gap: 14,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--db-navy-800)",
                  letterSpacing: "-0.01em",
                }}
              >
                By day-part
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--db-gray-text)",
                }}
              >
                Tap any card to override the forecast. Recompute asks the
                served model for a headcount; Lock writes a row to{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  app_labor_overrides
                </span>
                .
              </p>
            </div>
            <span style={{ marginBottom: 2 }}>
              <LakebaseTag table="app_labor_overrides" />
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {dayparts.map((dp) => (
              <DayPartPlannerCard
                key={dp.daypart}
                daypart={dp.daypart}
                forecast={dp.forecast_revenue}
                transactions={dp.forecast_transactions}
                date={date}
                override={overrides[dp.daypart] ?? null}
                onOverrideChange={(next) =>
                  setOverrides((o) => ({ ...o, [dp.daypart]: next }))
                }
              />
            ))}
            {isLoading &&
              dayparts.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 380,
                    borderRadius: 14,
                    background: "#fff",
                    border: "1px solid var(--db-gray-lines)",
                    opacity: 0.55,
                  }}
                />
              ))}
          </div>
        </section>

        {/* ===== Schedule preview ===== */}
        {dayparts.length > 0 && (
          <SchedulePreview
            dayLabel={dayLabel}
            dayparts={dayparts}
            overrides={overrides}
          />
        )}

        {/* ===== Recent approvals ===== */}
        <Card>
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--db-gray-lines)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="history" size={16} color="var(--db-gray-text)" />
            <h2
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--db-navy-800)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Recent approvals
            </h2>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--db-gray-text)",
              }}
            >
              · locked day-part schedules
            </span>
            <span style={{ marginLeft: "auto" }}>
              <LakebaseTag table="app_labor_overrides" />
            </span>
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  color: "var(--db-gray-text)",
                  background: "var(--db-oat-light)",
                }}
              >
                {["Date", "Day-part", "Crew", "Note", "Locked by"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 16px",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "28px 18px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--db-gray-text)",
                  }}
                >
                  Locked day-part schedules will appear here once you approve
                  one.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <ConfirmDialog
        open={approveAllOpen}
        title="Approve all day-part schedules?"
        description={`Writes ${dayparts.length} row${
          dayparts.length === 1 ? "" : "s"
        } to app_labor_overrides in Lakebase — one per day-part.`}
        details={approveAllDetails}
        noteLabel="Manager note (applied to all)"
        notePlaceholder="e.g. Standard Saturday schedule"
        confirmLabel="Approve all"
        onCancel={() => setApproveAllOpen(false)}
        onConfirm={handleApproveAll}
      />
    </div>
  );
}

/* ============================ Planner hero ============================ */
type Totals = {
  rev: number;
  cost: number;
  baseRev: number;
  baseCost: number;
  headcount: number;
  baseHc: number;
};

function PlannerHero({
  dayLabel,
  totals,
  overrideCount,
  laborPct,
  verdict,
  verdictColor,
  refreshing,
  lastRun,
  onRefresh,
}: {
  dayLabel: string;
  totals: Totals;
  overrideCount: number;
  laborPct: number;
  verdict: string;
  verdictColor: string;
  refreshing: boolean;
  lastRun: string;
  onRefresh: () => void;
}) {
  const revDelta = overrideCount ? totals.rev - totals.baseRev : null;
  const costDelta = overrideCount ? totals.cost - totals.baseCost : null;
  const hcDelta = overrideCount ? totals.headcount - totals.baseHc : null;

  return (
    <div
      style={{
        background: "var(--db-navy-900)",
        borderRadius: 18,
        padding: "28px 32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* decorative sun motif */}
      <svg
        viewBox="0 0 24 24"
        width="300"
        height="300"
        fill="none"
        stroke="var(--db-navy-700)"
        strokeWidth="0.45"
        style={{
          position: "absolute",
          right: -46,
          top: -64,
          opacity: 0.5,
          pointerEvents: "none",
        }}
      >
        <path d={PATHS.sun} />
      </svg>

      <div
        style={{
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 280 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 11px",
              background: "var(--db-lava-600)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#fff",
            }}
          >
            <Icon name="spark" size={12} color="#fff" /> Today's plan
          </div>
          <h2
            style={{
              margin: "14px 0 0",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "#fff",
            }}
          >
            {dayLabel}
          </h2>
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "var(--db-navy-300)",
              maxWidth: 440,
              lineHeight: 1.5,
            }}
          >
            Genie forecasts traffic by day-part. Adjust anything you know that
            it doesn't, then approve: crew, cost and labor % update live.
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
              color: "var(--db-navy-400)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: refreshing
                    ? "var(--db-yellow-500)"
                    : "var(--db-green-500)",
                }}
              />
              {refreshing
                ? "Refreshing forecast…"
                : `Forecast updated ${lastRun}`}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                background: "var(--db-navy-700)",
                color: "#fff",
                border: 0,
                padding: "5px 12px",
                borderRadius: 999,
                cursor: refreshing ? "wait" : "pointer",
                fontSize: 11.5,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-sans)",
              }}
            >
              <Icon name="refresh" size={12} color="#fff" stroke={2} /> Refresh
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          <Big
            label="Predicted sales"
            value={money(totals.rev)}
            delta={revDelta}
            isMoney
          />
          <Big
            label="Recommended labor"
            value={money(totals.cost)}
            delta={costDelta}
            isMoney
          />
          <div
            style={{
              paddingLeft: 26,
              borderLeft: "1px solid var(--db-navy-700)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--db-navy-400)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Labor % of sales
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                marginTop: 5,
                color: "#fff",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {(laborPct * 100).toFixed(1)}
              <span
                style={{
                  fontSize: 20,
                  color: "var(--db-navy-400)",
                }}
              >
                %
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 5,
                fontSize: 11.5,
              }}
            >
              <span
                style={{
                  color: verdictColor,
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: verdictColor,
                  }}
                />
                {verdict}
              </span>
              <span
                style={{
                  color: "var(--db-navy-400)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                · goal 22–26%
              </span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--db-navy-400)",
                marginTop: 7,
              }}
            >
              {totals.headcount} on the schedule
              {hcDelta != null && hcDelta !== 0 && (
                <span style={{ color: "#fff", fontWeight: 500 }}>
                  {" "}
                  ({hcDelta > 0 ? "+" : ""}
                  {hcDelta} vs forecast)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  delta,
  isMoney,
}: {
  label: string;
  value: string;
  delta?: number | null;
  isMoney?: boolean;
}) {
  return (
    <div style={{ minWidth: 128 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--db-navy-400)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          marginTop: 5,
          color: "#fff",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </div>
      {delta != null && delta !== 0 && (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            marginTop: 4,
            fontFamily: "var(--font-mono)",
            color:
              delta > 0 ? "var(--db-green-400)" : "var(--db-lava-400)",
          }}
        >
          {delta > 0 ? "+" : "−"}
          {isMoney ? moneyK(Math.abs(delta)) : Math.abs(delta)} vs forecast
        </div>
      )}
    </div>
  );
}

/* ============================ Schedule preview ============================ */
function SchedulePreview({
  dayLabel,
  dayparts,
  overrides,
}: {
  dayLabel: string;
  dayparts: DayPart[];
  overrides: Record<string, number | null>;
}) {
  const rows = dayparts.map((dp) => {
    const overrideVal = overrides[dp.daypart];
    const revenue = overrideVal != null ? overrideVal : dp.forecast_revenue;
    const staff = staffingFor(dp.daypart, revenue);
    return {
      daypart: dp.daypart,
      revenue,
      isOverridden: overrideVal != null,
      headcount: staff.headcount,
      cost: staff.cost,
      roles: staff.roles,
    };
  });

  return (
    <Card>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--db-gray-lines)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="calendar" size={16} color="var(--db-gray-text)" />
        <h2
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--db-navy-800)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Schedule preview for {dayLabel}
        </h2>
        <Pill level="neutral">{rows.length} slots</Pill>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: "var(--db-gray-text)",
          }}
        >
          What you're about to approve
        </span>
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr
            style={{
              textAlign: "left",
              color: "var(--db-gray-text)",
              background: "var(--db-oat-light)",
            }}
          >
            {[
              "Day-part",
              "Revenue",
              "Crew",
              "Cooks",
              "Cashiers",
              "Leads",
              "Manager",
              "Labor cost",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "9px 14px",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.daypart}
              style={{
                color: "var(--db-navy-800)",
                borderTop: "1px solid var(--db-gray-lines)",
              }}
            >
              <td style={{ padding: "11px 14px", fontWeight: 500 }}>
                {r.daypart}
                {r.isOverridden && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--db-lava-700)",
                      background: "var(--db-lava-300)",
                      padding: "1px 7px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Adjusted
                  </span>
                )}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {money(r.revenue)}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {r.headcount}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--db-gray-text)",
                }}
              >
                {r.roles.cook || "—"}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--db-gray-text)",
                }}
              >
                {r.roles.cashier || "—"}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--db-gray-text)",
                }}
              >
                {r.roles.lead || "—"}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--db-gray-text)",
                }}
              >
                {r.roles.manager || "—"}
              </td>
              <td
                style={{
                  padding: "11px 14px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {moneyK(r.cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
