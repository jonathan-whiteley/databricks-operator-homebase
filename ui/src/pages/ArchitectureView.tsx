// ui/src/pages/ArchitectureView.tsx
//
// Placeholder for the architecture reference. Will hold an interactive or
// rendered architecture diagram (React + FastAPI on Apps → UC reads,
// Lakebase writes, Genie + Model Serving).
import { Card, PageHead, Pill } from "@/components/db";

export default function ArchitectureView() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead
        icon="diagram"
        title="Architecture"
        sub="How Homebase wires UC, Lakebase, Genie, and Model Serving together — at a glance."
      >
        <Pill level="info">Placeholder</Pill>
      </PageHead>

      <Card pad={28}>
        <div
          style={{
            border: "2px dashed var(--db-gray-lines)",
            borderRadius: 12,
            padding: "60px 24px",
            textAlign: "center",
            color: "var(--db-gray-text)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--db-navy-800)" }}>
            Architecture diagram goes here
          </div>
          <p style={{ margin: "10px auto 0", maxWidth: 560, lineHeight: 1.55 }}>
            Replace this with the canonical architecture image or an inline SVG
            showing the React + FastAPI app, the SQL warehouse path to UC, the
            asyncpg pool into Lakebase, and the Genie + Model Serving fan-out.
          </p>
        </div>
      </Card>
    </div>
  );
}
