// ui/src/pages/TalkTrackView.tsx
//
// 5-minute demo talk track. Renders the beat sheet as a real table so SAs can
// scan it during a live walkthrough. Mirrors docs/demo-script.md — keep them
// in sync when one changes.
import { Card, PageHead, Pill } from "@/components/db";

type Beat = {
  time: string;
  tab: string;
  click: string;
  say: string;
};

const BEATS: Beat[] = [
  {
    time: "0:00-0:30",
    tab: "Today",
    click: "Land on the page. Point at the radial hub.",
    say: "One console, six things a store manager does at 7am. Genie at the centre, modules around it — ask, then act.",
  },
  {
    time: "0:30-1:15",
    tab: "Labor",
    click: "Bump one slot, hit Recompute, then Lock day → approve.",
    say: "ML rec from a Model Serving endpoint. Manager locks it — writes to Lakebase, short-lived OAuth from the SDK, lands in lhm_app.app_labor_overrides discoverable back in UC.",
  },
  {
    time: "1:15-1:45",
    tab: "Inventory",
    click: "Toggle one SKU off a PO card, Release order.",
    say: "Same pattern. Lakebase write to app_purchase_orders before the truck cut-off. Audit trail is automatic.",
  },
  {
    time: "1:45-2:15",
    tab: "Equipment",
    click: "Schedule service from the navy CoolerAlert hero.",
    say: "RUL model flagged this cooler. One click writes a work order to Lakebase. Zero swivel-chair to a CMMS.",
  },
  {
    time: "2:15-2:45",
    tab: "Loyalty",
    click: "Pick a segment, Send to all.",
    say: "Win-back offer to N at-risk regulars. One executemany round-trip — N rows into Lakebase for the CRM team to pick up.",
  },
  {
    time: "2:45-3:15",
    tab: "Feedback",
    click: "Click a low-star review, accept the AI-drafted reply.",
    say: "LLM-drafted in the manager's voice. Approve and Lakebase logs the response for compliance.",
  },
  {
    time: "3:15-4:30",
    tab: "Genie (cross-domain)",
    click:
      "Open slide-over from any tab. Ask: (1) Why is Friday lunch staffing higher than last week? (2) Show me coolers with RUL under 30 days. (3) Negative-sentiment themes this week.",
    say: "One Genie space, all 21 UC tables. Route context (tab_id, store_id) auto-injected. Labor question, equipment question, sentiment question — same chat, same governance, no SQL.",
  },
  {
    time: "4:30-5:00",
    tab: "Close",
    click: "Back to /today. Close on the radial hub.",
    say: "Four Databricks primitives — UC, Lakebase, Genie, Model Serving — one console. The manager replaces five tools with one login. Your data team gets every write back in UC, on the same governance plane.",
  },
];

const VALUE = [
  {
    audience: "Store manager",
    line: "One login replaces five tools; every decision is auto-logged.",
  },
  {
    audience: "Ops leadership",
    line: "Labor variance ↓, food waste ↓, equipment downtime ↓, churn save rate ↑.",
  },
  {
    audience: "Data team",
    line: "All reads UC-governed, all writes Lakebase-governed, all AI on Databricks identity. Nothing bolted on.",
  },
];

const RECOVERY = [
  {
    symptom: "Page won't load",
    pivot: "Warehouse cold — keep talking, it warms in 5-10s.",
  },
  {
    symptom: "Genie echoes the prompt",
    pivot: "Stale bundle. Skip Genie, demo a write instead.",
  },
  {
    symptom: "Write 500s",
    pivot: "Pivot to slide 3 (architecture). Restart the app after the demo.",
  },
];

const PREP = [
  "Open the deployed app and hard-refresh once (Cmd+Shift+R)",
  "Click /today so the warehouse warms up while you intro",
  "Open the Genie panel once and confirm it's reachable",
];

export default function TalkTrackView() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead
        icon="book"
        title="Talk Track"
        sub="5-minute demo script. Touches every tab's Lakebase write-back, frames Genie as the unified cross-domain chat, lands business value for store operators."
      >
        <Pill level="info">5 min · 8 beats</Pill>
      </PageHead>

      <Card pad={20} style={{ marginBottom: 18 }}>
        <SectionTitle>Before joining (2 min prep)</SectionTitle>
        <ul style={ulStyle}>
          {PREP.map((p) => (
            <li key={p} style={liStyle}>
              {p}
            </li>
          ))}
        </ul>
      </Card>

      <Card pad={0} style={{ marginBottom: 18, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionTitle>The 5-minute beat sheet</SectionTitle>
        </div>
        <BeatTable beats={BEATS} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
        <Card pad={20}>
          <SectionTitle>Business value — drop one of these into the close</SectionTitle>
          <ul style={{ ...ulStyle, paddingLeft: 0, listStyle: "none" }}>
            {VALUE.map((v) => (
              <li key={v.audience} style={{ ...liStyle, paddingLeft: 0 }}>
                <span
                  style={{
                    display: "inline-block",
                    minWidth: 138,
                    fontWeight: 600,
                    color: "var(--db-navy-800)",
                  }}
                >
                  For the {v.audience}:
                </span>
                <span style={{ color: "var(--db-gray-text)" }}>{v.line}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card pad={20}>
          <SectionTitle>If something breaks live</SectionTitle>
          <ul style={{ ...ulStyle, paddingLeft: 0, listStyle: "none" }}>
            {RECOVERY.map((r) => (
              <li key={r.symptom} style={{ ...liStyle, paddingLeft: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--db-navy-800)" }}>
                  {r.symptom}.{" "}
                </span>
                <span style={{ color: "var(--db-gray-text)" }}>{r.pivot}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function BeatTable({ beats }: { beats: Beat[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13.5,
        }}
      >
        <thead>
          <tr style={{ background: "var(--db-gray-soft, #f5f6f8)" }}>
            <Th width={92}>Time</Th>
            <Th width={140}>Tab</Th>
            <Th>Click</Th>
            <Th>Say</Th>
          </tr>
        </thead>
        <tbody>
          {beats.map((b, i) => (
            <tr
              key={b.time}
              style={{
                borderTop: "1px solid var(--db-gray-lines)",
                background: i % 2 === 1 ? "rgba(0,0,0,0.015)" : "transparent",
              }}
            >
              <Td>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    color: "var(--db-navy-800)",
                    fontWeight: 500,
                  }}
                >
                  {b.time}
                </span>
              </Td>
              <Td>
                <span style={{ fontWeight: 600, color: "var(--db-navy-800)" }}>
                  {b.tab}
                </span>
              </Td>
              <Td>
                <span style={{ color: "var(--db-navy-800)" }}>{b.click}</span>
              </Td>
              <Td>
                <span style={{ color: "var(--db-gray-text)", fontStyle: "italic" }}>
                  &ldquo;{b.say}&rdquo;
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 16px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--db-gray-text)",
        width,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 16px",
        verticalAlign: "top",
        lineHeight: 1.5,
      }}
    >
      {children}
    </td>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 12px",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--db-navy-800)",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const liStyle: React.CSSProperties = {
  lineHeight: 1.55,
  color: "var(--db-navy-800)",
};
