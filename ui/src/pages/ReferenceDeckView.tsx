// ui/src/pages/ReferenceDeckView.tsx
//
// Placeholder for the embedded 6-slide reference deck. Source lives in
// docs/slides.md; this view will render or link to the rendered deck.
import { Card, PageHead, Pill } from "@/components/db";

export default function ReferenceDeckView() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead
        icon="screen"
        title="Reference Deck"
        sub="6-slide reference deck for the Databricks capabilities in this app — title, audience, architecture, Genie, Lakebase, business value."
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
            Deck embed goes here
          </div>
          <p style={{ margin: "10px auto 0", maxWidth: 520, lineHeight: 1.55 }}>
            Source: <code>docs/slides.md</code>. Render with Marp or paste into
            Google Slides via the <code>fe-google-tools</code> markdown-to-gdocs
            flow, then embed below.
          </p>
        </div>
      </Card>
    </div>
  );
}
