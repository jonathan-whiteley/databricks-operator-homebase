// ui/src/pages/ArchitectureView.tsx
//
// Interactive architecture diagram for Homebase. Built on @xyflow/react v12
// with pan/zoom/fit, custom node cards grouped by layer, and PNG/SVG export
// via html-to-image. Layout is left-to-right: sources → UC → compute/ML →
// FastAPI → Lakebase write-back → UI → manager.
import { useCallback, useMemo } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";

import { PageHead, Icon } from "@/components/db";
import type { IconName } from "@/components/db";

type Layer =
  | "source"
  | "uc"
  | "warehouse"
  | "ml"
  | "genie"
  | "app"
  | "lakebase"
  | "ui"
  | "user";

const LAYER: Record<Layer, { fg: string; ring: string; label: string }> = {
  source: { fg: "#475569", ring: "#cbd5e1", label: "Sources" },
  uc: { fg: "var(--db-lava-600)", ring: "rgba(255,82,0,0.35)", label: "Unity Catalog" },
  warehouse: { fg: "#0ea5e9", ring: "rgba(14,165,233,0.35)", label: "Warehouse" },
  ml: { fg: "#7c3aed", ring: "rgba(124,58,237,0.35)", label: "Model Serving / FM" },
  genie: { fg: "#db2777", ring: "rgba(219,39,119,0.35)", label: "Genie" },
  app: { fg: "#0f766e", ring: "rgba(15,118,110,0.35)", label: "App backend" },
  lakebase: { fg: "var(--db-green-600)", ring: "rgba(16,185,129,0.4)", label: "Lakebase" },
  ui: { fg: "#334155", ring: "#94a3b8", label: "UI" },
  user: { fg: "var(--db-green-600)", ring: "rgba(16,185,129,0.4)", label: "User" },
};

type CardData = {
  title: string;
  sub: string;
  icon: IconName;
  layer: Layer;
};

function CardNode({ data }: NodeProps) {
  const d = data as unknown as CardData;
  const tone = LAYER[d.layer];
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${tone.ring}`,
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 188,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: 11,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tone.ring,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={d.icon} size={16} color={tone.fg} stroke={2.2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tone.fg,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {d.title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--db-gray-text)",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {d.sub}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "transparent", border: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "transparent", border: 0 }}
      />
    </div>
  );
}

const nodeTypes = { card: CardNode };

const NODES: Node[] = [
  // Column 1 — sources (raw)
  card("src-pos", 0, 0, "POS Transactions", "Daily orders + items", "cash", "source"),
  card("src-loyalty", 0, 90, "Loyalty Members", "50k members + tiers", "members", "source"),
  card("src-iot", 0, 180, "Equipment Telemetry", "~600 units · IoT", "thermo", "source"),
  card("src-reviews", 0, 270, "Guest Reviews", "30k reviews", "star", "source"),
  card("src-skus", 0, 360, "SKU Catalog", "800 SKUs + vendors", "box", "source"),

  // Column 2 — UC domains
  card("uc-shared", 320, -40, "Shared", "stores · dim_date · dim_time", "today", "uc"),
  card("uc-labor", 320, 50, "Labor", "3 tables", "labor", "uc"),
  card("uc-loyalty", 320, 140, "Loyalty", "5 tables · churn + CLV", "gift", "uc"),
  card("uc-supply", 320, 230, "Supply", "5 tables · POs + forecast", "truck", "uc"),
  card("uc-sentiment", 320, 320, "Sentiment", "3 tables · review_sentiment", "feedback", "uc"),
  card("uc-maintenance", 320, 410, "Maintenance", "4 tables · RUL", "wrench", "uc"),

  // Column 3 — compute / ML / Genie
  card("sql-warehouse", 640, 50, "SQL Warehouse", "Serverless · 120 min auto-stop", "spark", "warehouse"),
  card("model-serving", 640, 150, "Model Serving", "lhm-labor-recommender · ElasticNet", "labor", "ml"),
  card("fm", 640, 250, "Foundation Models", "Claude Sonnet 4.6 · Llama 3.3", "spark", "ml"),
  card("genie-space", 640, 350, "Genie Space", "lhm-ops-assistant · 21 tables", "spark", "genie"),

  // Column 4 — App backend
  card("fastapi", 970, 200, "FastAPI", "8 routers · asyncpg pool", "screen", "app"),

  // Column 5 — Lakebase write-back
  card("lakebase", 1240, 200, "Lakebase Postgres", "lhm_app · 5 write tables", "diagram", "lakebase"),

  // Column 6 — UI
  card("ui", 1510, 200, "React UI", "6 modules + Genie panel", "screen", "ui"),

  // Column 7 — User
  card("manager", 1770, 200, "Store Manager", "Maya · Store #001", "user", "user"),
];

function card(
  id: string,
  x: number,
  y: number,
  title: string,
  sub: string,
  icon: IconName,
  layer: Layer,
): Node {
  return {
    id,
    type: "card",
    position: { x, y },
    data: { title, sub, icon, layer },
    draggable: true,
  };
}

function edge(
  source: string,
  target: string,
  opts: { color?: string; label?: string; animated?: boolean } = {},
): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    animated: opts.animated ?? false,
    label: opts.label,
    labelStyle: {
      fontSize: 10.5,
      fill: "var(--db-gray-text)",
      fontFamily: "var(--font-mono)",
    },
    labelBgStyle: { fill: "#fff" },
    labelBgPadding: [4, 2],
    style: {
      stroke: opts.color ?? "#cbd5e1",
      strokeWidth: 1.4,
      strokeDasharray: "5 5",
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: opts.color ?? "#94a3b8",
      width: 14,
      height: 14,
    },
  };
}

const EDGES: Edge[] = [
  // Sources → UC
  edge("src-pos", "uc-labor"),
  edge("src-pos", "uc-loyalty"),
  edge("src-loyalty", "uc-loyalty"),
  edge("src-iot", "uc-maintenance"),
  edge("src-reviews", "uc-sentiment"),
  edge("src-skus", "uc-supply"),

  // UC → SQL Warehouse (reads)
  edge("uc-shared", "sql-warehouse", { color: LAYER.warehouse.fg }),
  edge("uc-labor", "sql-warehouse", { color: LAYER.warehouse.fg }),
  edge("uc-loyalty", "sql-warehouse", { color: LAYER.warehouse.fg }),
  edge("uc-supply", "sql-warehouse", { color: LAYER.warehouse.fg }),

  // UC → Model Serving (training input)
  edge("uc-labor", "model-serving", { color: LAYER.ml.fg, label: "training" }),

  // UC → FM (batch labeling)
  edge("uc-sentiment", "fm", { color: LAYER.ml.fg, label: "labels" }),

  // UC → Genie (scope)
  edge("uc-maintenance", "genie-space", { color: LAYER.genie.fg }),
  edge("uc-loyalty", "genie-space", { color: LAYER.genie.fg }),
  edge("uc-sentiment", "genie-space", { color: LAYER.genie.fg }),

  // Compute/ML → FastAPI
  edge("sql-warehouse", "fastapi", { color: LAYER.warehouse.fg, animated: true }),
  edge("model-serving", "fastapi", { color: LAYER.ml.fg, animated: true }),
  edge("fm", "fastapi", { color: LAYER.ml.fg, animated: true }),
  edge("genie-space", "fastapi", { color: LAYER.genie.fg, animated: true }),

  // FastAPI ↔ Lakebase (writes + lakebase->UC reverse-ETL is implicit)
  edge("fastapi", "lakebase", { color: LAYER.lakebase.fg, label: "OAuth · writes", animated: true }),

  // FastAPI → UI
  edge("fastapi", "ui", { color: LAYER.app.fg }),

  // UI → Manager
  edge("ui", "manager", { color: LAYER.user.fg }),
];

function Toolbar() {
  const flow = useReactFlow();

  const onExport = useCallback(
    async (kind: "png" | "svg") => {
      const wrapper = document.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement | null;
      const flowEl = document.querySelector(".react-flow") as HTMLElement | null;
      if (!flowEl || !wrapper) return;
      flow.fitView({ padding: 0.12, duration: 0 });
      // small tick so the viewport transform settles
      await new Promise((r) => setTimeout(r, 80));
      const exporter = kind === "png" ? toPng : toSvg;
      const dataUrl = await exporter(flowEl, {
        backgroundColor: "#fafaf7",
        cacheBust: true,
        pixelRatio: 2,
        filter: (n: HTMLElement) =>
          !n.classList?.contains?.("react-flow__minimap") &&
          !n.classList?.contains?.("hb-arch-toolbar"),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `homebase-architecture.${kind}`;
      a.click();
    },
    [flow],
  );

  return (
    <div
      className="hb-arch-toolbar"
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 10,
        display: "flex",
        gap: 6,
        background: "rgba(255,255,255,0.94)",
        padding: 4,
        borderRadius: 10,
        border: "1px solid var(--db-gray-lines)",
        boxShadow: "var(--shadow-sm)",
        backdropFilter: "blur(6px)",
      }}
    >
      <ToolBtn onClick={() => flow.zoomIn({ duration: 200 })}>Zoom In</ToolBtn>
      <ToolBtn onClick={() => flow.zoomOut({ duration: 200 })}>Zoom Out</ToolBtn>
      <ToolBtn onClick={() => flow.fitView({ padding: 0.12, duration: 250 })}>
        Fit
      </ToolBtn>
      <ToolDivider />
      <ToolBtn onClick={() => onExport("png")}>PNG</ToolBtn>
      <ToolBtn onClick={() => onExport("svg")}>SVG</ToolBtn>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 28,
        padding: "0 10px",
        border: 0,
        background: "transparent",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        color: "var(--db-navy-800)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return (
    <span
      style={{
        width: 1,
        background: "var(--db-gray-lines)",
        margin: "4px 2px",
      }}
    />
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: "#475569", label: "Sources" },
    { color: "var(--db-lava-600)", label: "Unity Catalog" },
    { color: "#0ea5e9", label: "SQL Warehouse" },
    { color: "#7c3aed", label: "Model Serving / FM" },
    { color: "#db2777", label: "Genie" },
    { color: "#0f766e", label: "App backend" },
    { color: "var(--db-green-600)", label: "Lakebase / User" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 10,
        background: "rgba(255,255,255,0.94)",
        border: "1px solid var(--db-gray-lines)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "var(--shadow-sm)",
        backdropFilter: "blur(6px)",
        minWidth: 168,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--db-gray-text)",
          marginBottom: 8,
        }}
      >
        Layers
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 5,
          columnGap: 8,
          alignItems: "center",
        }}
      >
        {items.map((it) => (
          <Row key={it.label} color={it.color} label={it.label} />
        ))}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--db-gray-text)",
          marginTop: 9,
          paddingTop: 8,
          borderTop: "1px solid var(--db-gray-lines)",
          lineHeight: 1.4,
        }}
      >
        Drag nodes · scroll to zoom · drag empty area to pan
      </div>
    </div>
  );
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          display: "block",
        }}
      />
      <span style={{ fontSize: 12, color: "var(--db-navy-800)" }}>{label}</span>
    </>
  );
}

function Bands() {
  const items = [
    "Databricks Workflows · lhm-init job (notebooks 01-06)",
    "Unity Catalog · governance & security",
    "Databricks Apps · hosting (SP-owned, OAuth)",
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: "60%",
      }}
    >
      {items.map((t) => (
        <span
          key={t}
          style={{
            background: "rgba(255,255,255,0.94)",
            border: "1px solid var(--db-gray-lines)",
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 11.5,
            color: "var(--db-navy-800)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function FlowInner() {
  const nodes = useMemo(() => NODES, []);
  const edges = useMemo(() => EDGES, []);

  return (
    <div style={{ position: "relative", height: "calc(100vh - 220px)", minHeight: 620 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.6}
        nodesConnectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        panOnScroll={false}
        zoomOnScroll
      >
        <Background gap={22} size={1} color="#e2e8f0" />
      </ReactFlow>
      <Toolbar />
      <Legend />
      <Bands />
    </div>
  );
}

export default function ArchitectureView() {
  return (
    <div style={{ maxWidth: 1400 }}>
      <PageHead
        icon="diagram"
        title="Architecture"
        sub="Homebase wires Unity Catalog reads, Lakebase writes, Genie, and Model Serving behind one FastAPI app. Drag to rearrange, scroll to zoom, export to PNG or SVG."
      />
      <div
        style={{
          background: "#fafaf7",
          border: "1px solid var(--db-gray-lines)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <ReactFlowProvider>
          <FlowInner />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
