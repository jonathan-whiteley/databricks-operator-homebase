// ui/src/pages/ReferenceDeckView.tsx
//
// Renders the 6-slide Homebase Capabilities deck (static HTML + deck-stage
// custom element) in an iframe so its CSS, fonts, and keyboard navigation
// stay isolated from the app shell. Source files live in ui/public/deck/
// and are served verbatim by Vite at /deck/*.
import { PageHead, Pill } from "@/components/db";

const DECK_SRC = "/deck/homebase-capabilities.html";

export default function ReferenceDeckView() {
  return (
    <div style={{ maxWidth: 1400 }}>
      <PageHead
        icon="screen"
        title="Reference Deck"
        sub="Six slides on Homebase's Databricks capabilities — Genie, Lakebase, the loop, and business value for store managers."
      >
        <Pill level="info">6 slides</Pill>
        <a
          href={DECK_SRC}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 12px",
            borderRadius: 999,
            border: "1px solid var(--db-gray-lines)",
            background: "#fff",
            color: "var(--db-navy-800)",
            fontSize: 12.5,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open in new tab
        </a>
      </PageHead>

      <div
        style={{
          background: "#06171c",
          borderRadius: 12,
          border: "1px solid var(--db-gray-lines)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <iframe
          src={DECK_SRC}
          title="Homebase Capabilities deck"
          style={{
            display: "block",
            width: "100%",
            height: "calc(100vh - 220px)",
            minHeight: 600,
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
