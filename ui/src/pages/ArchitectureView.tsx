// ui/src/pages/ArchitectureView.tsx
//
// Interactive architecture diagram for Homebase. Built on @xyflow/react v12
// with pan/zoom/fit, draggable nodes (via useNodesState), and PNG/SVG export
// via html-to-image. Layout is left-to-right: sources → Unity Catalog →
// compute/ML → Databricks App → Lakebase write-back + Store manager.
import { useCallback } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
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
  | "user";

const LAYER: Record<Layer, { fg: string; ring: string; tint: string; label: string }> = {
  source: { fg: "#475569", ring: "#cbd5e1", tint: "#f1f5f9", label: "Sources" },
  uc: {
    fg: "var(--db-lava-600)",
    ring: "rgba(255,82,0,0.40)",
    tint: "rgba(255,82,0,0.10)",
    label: "Unity Catalog",
  },
  warehouse: {
    fg: "#0ea5e9",
    ring: "rgba(14,165,233,0.40)",
    tint: "rgba(14,165,233,0.10)",
    label: "SQL Warehouse",
  },
  ml: {
    fg: "#7c3aed",
    ring: "rgba(124,58,237,0.40)",
    tint: "rgba(124,58,237,0.10)",
    label: "Model Serving / FM",
  },
  genie: {
    fg: "#db2777",
    ring: "rgba(219,39,119,0.40)",
    tint: "rgba(219,39,119,0.10)",
    label: "Genie",
  },
  app: {
    fg: "#0f766e",
    ring: "rgba(15,118,110,0.40)",
    tint: "rgba(15,118,110,0.10)",
    label: "Databricks App",
  },
  lakebase: {
    fg: "var(--db-green-600)",
    ring: "rgba(16,185,129,0.45)",
    tint: "rgba(16,185,129,0.10)",
    label: "Lakebase",
  },
  user: {
    fg: "#1f2937",
    ring: "#94a3b8",
    tint: "#f1f5f9",
    label: "User",
  },
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
        minWidth: 196,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: 11,
        cursor: "grab",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tone.tint,
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
        isConnectable={false}
        style={hiddenHandle}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={hiddenHandle}
      />
      <Handle
        id="bottom-source"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={hiddenHandle}
      />
      <Handle
        id="bottom-target"
        type="target"
        position={Position.Bottom}
        isConnectable={false}
        style={hiddenHandle}
      />
    </div>
  );
}

const hiddenHandle: React.CSSProperties = {
  background: "transparent",
  border: 0,
  width: 1,
  height: 1,
  pointerEvents: "none",
};

function HeaderNode({ data }: NodeProps) {
  const d = data as unknown as { label: string };
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--db-gray-text)",
        padding: "6px 0 8px",
        borderBottom: "1px solid var(--db-gray-lines)",
        minWidth: 196,
        textAlign: "center",
        fontFamily: "var(--font-sans)",
      }}
    >
      {d.label}
    </div>
  );
}

const nodeTypes = { card: CardNode, header: HeaderNode };

// Column headers — fixed at the top of each column to give the layered feel.
const HEADER_Y = -20;
const HEADERS: Node[] = [
  header("hdr-source", 0, "Source"),
  header("hdr-uc", 320, "Lakehouse · Unity Catalog"),
  header("hdr-compute", 640, "Compute · Serve"),
  header("hdr-app", 960, "Application"),
  header("hdr-write", 1260, "Operational · Write-back"),
];

function header(id: string, x: number, label: string): Node {
  return {
    id,
    type: "header",
    position: { x, y: HEADER_Y },
    data: { label },
    draggable: false,
    selectable: false,
  };
}

// One source row per UC domain so every Source → UC edge is a clean horizontal.
const INITIAL_NODES: Node[] = [
  ...HEADERS,
  // Col 1 — Sources (each row aligned with its UC target row)
  card("src-pos", 0, 60, "POS Transactions", "Daily orders + items", "cash", "source"),
  card("src-loyalty", 0, 160, "Loyalty Members", "50k members + tiers", "members", "source"),
  card("src-skus", 0, 260, "SKU Catalog", "800 SKUs + vendors", "box", "source"),
  card("src-reviews", 0, 360, "Guest Reviews", "30k reviews", "star", "source"),
  card("src-iot", 0, 460, "Equipment Telemetry", "~600 units · IoT", "thermo", "source"),

  // Col 2 — Unity Catalog (one consolidated node, centered)
  card(
    "uc",
    320,
    260,
    "Unity Catalog",
    "jdub_demo.lakehouse_market · 21 tables · 6 domains",
    "inventory",
    "uc",
  ),

  // Col 3 — Compute / ML / Genie
  card("sql-warehouse", 640, 60, "SQL Warehouse", "Serverless · auto-stop 120m", "spark", "warehouse"),
  card("model-serving", 640, 200, "Model Serving", "lhm-labor-recommender · ElasticNet", "labor", "ml"),
  card("fm", 640, 340, "Foundation Models", "Claude Sonnet 4.6 · Llama 3.3", "spark", "ml"),
  card("genie-space", 640, 480, "Genie Space", "lhm-ops-assistant · all 21 tables", "spark", "genie"),

  // Col 4 — Databricks App (combined React + FastAPI)
  card("app", 960, 260, "Databricks App", "React + FastAPI · 8 routers", "screen", "app"),

  // Col 5 — Lakebase write-back + Manager (stacked)
  card("lakebase", 1260, 180, "Lakebase Postgres", "lhm_app · 5 write tables", "diagram", "lakebase"),
  card("manager", 1260, 340, "Store Manager", "Maya · Store #001", "user", "user"),
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
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function edge(
  source: string,
  target: string,
  opts: { color?: string; label?: string; animated?: boolean; dashed?: boolean } = {},
): Edge {
  const dashed = opts.dashed ?? true;
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
      stroke: opts.color ?? "#94a3b8",
      strokeWidth: 1.5,
      strokeDasharray: dashed ? "5 5" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: opts.color ?? "#94a3b8",
      width: 16,
      height: 16,
    },
  };
}

const INITIAL_EDGES: Edge[] = [
  // Sources → UC (clean horizontal lines, slight stagger via smoothstep)
  edge("src-pos", "uc"),
  edge("src-loyalty", "uc"),
  edge("src-skus", "uc"),
  edge("src-reviews", "uc"),
  edge("src-iot", "uc"),

  // UC → Compute fan-out
  edge("uc", "sql-warehouse", { color: LAYER.warehouse.fg }),
  edge("uc", "model-serving", { color: LAYER.ml.fg, label: "labor training" }),
  edge("uc", "fm", { color: LAYER.ml.fg, label: "sentiment labels" }),
  edge("uc", "genie-space", { color: LAYER.genie.fg }),

  // Compute → App (live read paths — animated)
  edge("sql-warehouse", "app", { color: LAYER.warehouse.fg, animated: true }),
  edge("model-serving", "app", { color: LAYER.ml.fg, animated: true }),
  edge("fm", "app", { color: LAYER.ml.fg, animated: true }),
  edge("genie-space", "app", { color: LAYER.genie.fg, animated: true }),

  // App ↔ Lakebase + App → Manager
  edge("app", "lakebase", {
    color: LAYER.lakebase.fg,
    label: "OAuth · writes",
    animated: true,
  }),
  edge("app", "manager", { color: "#475569" }),

  // Lakebase ↔ Unity Catalog: Lakebase Sync auto-mirrors Lakebase Postgres
  // tables into governed Delta tables in UC, so app writes flow back into
  // the lakehouse for downstream SQL / ML / Genie reads. Routed via bottom
  // handles so the long return arc doesn't tangle with the forward fan-out.
  {
    id: "lakebase<->uc",
    source: "lakebase",
    sourceHandle: "bottom-source",
    target: "uc",
    targetHandle: "bottom-target",
    type: "smoothstep",
    animated: true,
    label: "Lakebase Sync · Delta mirror",
    labelStyle: {
      fontSize: 10.5,
      fill: "var(--db-gray-text)",
      fontFamily: "var(--font-mono)",
    },
    labelBgStyle: { fill: "#fff" },
    labelBgPadding: [4, 2],
    style: {
      stroke: LAYER.lakebase.fg,
      strokeWidth: 1.5,
      strokeDasharray: "5 5",
    },
    markerStart: {
      type: MarkerType.ArrowClosed,
      color: LAYER.lakebase.fg,
      width: 14,
      height: 14,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: LAYER.lakebase.fg,
      width: 14,
      height: 14,
    },
  },
];

function Toolbar() {
  const flow = useReactFlow();

  const onExport = useCallback(
    async (kind: "png" | "svg") => {
      const flowEl = document.querySelector(".react-flow") as HTMLElement | null;
      if (!flowEl) return;
      flow.fitView({ padding: 0.12, duration: 0 });
      await new Promise((r) => setTimeout(r, 80));
      const exporter = kind === "png" ? toPng : toSvg;
      const dataUrl = await exporter(flowEl, {
        backgroundColor: "#fafaf7",
        cacheBust: true,
        pixelRatio: 2,
        filter: (n: HTMLElement) => !n.classList?.contains?.("hb-arch-toolbar"),
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
      style={{ width: 1, background: "var(--db-gray-lines)", margin: "4px 2px" }}
    />
  );
}

function LegendFooter() {
  const layers: { key: Layer; label: string }[] = [
    { key: "source", label: "Sources" },
    { key: "uc", label: "Unity Catalog" },
    { key: "warehouse", label: "SQL Warehouse" },
    { key: "ml", label: "Model Serving / FM" },
    { key: "genie", label: "Genie" },
    { key: "app", label: "Databricks App" },
    { key: "lakebase", label: "Lakebase" },
    { key: "user", label: "User" },
  ];
  const bands = [
    "Databricks Workflows · lhm-init job",
    "Unity Catalog · governance",
    "Databricks Apps · hosting",
  ];
  return (
    <div
      style={{
        borderTop: "1px solid var(--db-gray-lines)",
        background: "#fff",
        padding: "12px 16px",
        display: "flex",
        gap: 18,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--db-gray-text)",
          }}
        >
          Layers
        </span>
        {layers.map((l) => (
          <span
            key={l.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--db-navy-800)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: LAYER[l.key].fg,
                display: "block",
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {bands.map((b) => (
          <span
            key={b}
            style={{
              background: "var(--db-gray-soft, #f5f6f8)",
              border: "1px solid var(--db-gray-lines)",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              color: "var(--db-navy-800)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlowInner() {
  // Controlled state so node drags persist. Without onNodesChange wired up,
  // drag is a visual no-op and snaps back on next render.
  const [nodes, _setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  return (
    <div style={{ position: "relative", height: "calc(100vh - 280px)", minHeight: 560 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll
      >
        <Background gap={22} size={1} color="#e2e8f0" />
      </ReactFlow>
      <Toolbar />
    </div>
  );
}

export default function ArchitectureView() {
  return (
    <div style={{ maxWidth: 1400 }}>
      <PageHead
        icon="diagram"
        title="Architecture"
        sub="How Homebase wires Unity Catalog reads, Lakebase writes, Genie, and Model Serving behind one Databricks App. Drag nodes · scroll to zoom · export to PNG/SVG."
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
        <LegendFooter />
      </div>
    </div>
  );
}
