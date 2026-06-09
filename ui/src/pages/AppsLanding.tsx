// ui/src/pages/AppsLanding.tsx
//
// /apps — DAIS booth launcher. Concise radial of four operational apps
// around a small Databricks · Genie hub. Mirrors the design v2 landing.jsx
// (tighter cards, one-line taglines, no "Open app" CTA, smaller geometry).
// Homebase opens the in-app /today route; the other three open their
// external Databricks Apps deploys in a new tab.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon, { type IconName } from "@/components/db/Icon";
import { useToast } from "@/components/db/ToastRegion";

type AppEntry = {
  id: string;
  name: string;
  industry: string;
  tag: string;
  icon: IconName;
  accent: string;
  tint: string;
  featured?: boolean;
  url: string | null; // null = internal Homebase route
};

const APPS: AppEntry[] = [
  {
    id: "homebase",
    name: "Operator Homebase",
    industry: "Retail & QSR",
    tag: "Run the store, end to end.",
    icon: "today",
    accent: "var(--db-lava-600)",
    tint: "var(--db-lava-300)",
    featured: true,
    url: null,
  },
  {
    id: "contract",
    name: "Contract Recon",
    industry: "Travel & Hospitality",
    tag: "Catch unauthorized charges.",
    icon: "doc",
    accent: "var(--db-blue-600)",
    tint: "var(--db-blue-300)",
    url: "https://brickyard-contract-recon-7474650217702955.aws.databricksapps.com",
  },
  {
    id: "vision",
    name: "Computer Vision",
    industry: "Travel & Hospitality",
    tag: "Camera frame to operator action.",
    icon: "eye",
    accent: "var(--db-green-600)",
    tint: "var(--db-green-300)",
    url: "https://lens-iq-7474650217702955.aws.databricksapps.com",
  },
  {
    id: "airline",
    name: "Irregular Ops",
    industry: "Airlines",
    tag: "Recover from disruption, fast.",
    icon: "plane",
    accent: "var(--db-yellow-700)",
    tint: "var(--db-yellow-300)",
    url: "https://brick-airlines-irops-app-7474650217702955.aws.databricksapps.com",
  },
];

function AppNode({
  app,
  width,
  onOpen,
}: {
  app: AppEntry;
  width: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hb-card-hover"
      style={{
        width,
        textAlign: "left",
        cursor: "pointer",
        background: "#fff",
        borderRadius: 14,
        padding: "15px 16px",
        border: app.featured
          ? `2px solid ${app.accent}`
          : "1px solid var(--db-gray-lines)",
        boxShadow: "var(--shadow-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "var(--db-green-600)",
        }}
      />
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: app.tint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={app.icon} size={21} color={app.accent} />
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--db-gray-text)",
          }}
        >
          {app.industry}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--db-navy-800)",
            letterSpacing: "-0.01em",
            margin: "3px 0 4px",
          }}
        >
          {app.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--db-gray-text)", lineHeight: 1.4 }}>
          {app.tag}
        </div>
      </div>
    </button>
  );
}

export default function AppsLanding() {
  const navigate = useNavigate();
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Concise radial geometry (v2 design): ~20% smaller than the prior pass.
  const W = 720;
  const H = 520;
  const CX = W / 2;
  const CY = H / 2;
  const HUB = 138;
  const CARD_W = 212;

  const positions: { x: number; y: number }[] = [
    { x: CX, y: 72 }, // top
    { x: W - CARD_W / 2 - 4, y: CY }, // right
    { x: CX, y: H - 72 }, // bottom
    { x: CARD_W / 2 + 4, y: CY }, // left
  ];

  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-route", "landing");
    return () => {
      document.documentElement.removeAttribute("data-app-route");
    };
  }, []);

  const onOpen = (app: AppEntry) => {
    if (app.id === "homebase") {
      navigate("/today");
      return;
    }
    if (app.url) {
      window.open(app.url, "_blank", "noopener");
      return;
    }
    toast.success(`Launching ${app.name}…`);
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        background: "var(--db-navy-900)",
      }}
    >
      <div
        style={{
          minHeight: "100%",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* header */}
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 13px",
              borderRadius: 999,
              background: "var(--db-navy-800)",
              border: "1px solid var(--db-navy-700)",
            }}
          >
            <img src="/databricks-symbol-color.svg" style={{ height: 14 }} alt="" />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--db-navy-300)",
                whiteSpace: "nowrap",
              }}
            >
              Databricks Apps
            </span>
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: "#fff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: "16px 0 0",
            }}
          >
            Operational intelligence apps
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--db-navy-300)",
              margin: "10px 0 0",
            }}
          >
            Industry consoles on the Data Intelligence Platform, powered by Genie.
          </p>
        </div>

        {/* radial */}
        <div ref={wrapRef} style={{ width: "100%", maxWidth: W, marginTop: 8 }}>
          <div style={{ height: H * scale, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: W,
                height: H,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: "top center",
              }}
            >
              <svg
                width={W}
                height={H}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              >
                <circle
                  cx={CX}
                  cy={CY}
                  r={HUB / 2 + 52}
                  fill="none"
                  stroke="var(--db-navy-700)"
                  strokeWidth={1.5}
                  strokeDasharray="3 8"
                  opacity={0.7}
                />
                {positions.map((p, i) => (
                  <line
                    key={i}
                    x1={CX}
                    y1={CY}
                    x2={p.x}
                    y2={p.y}
                    stroke="var(--db-navy-700)"
                    strokeWidth={1.5}
                  />
                ))}
              </svg>

              {/* hub */}
              <div
                style={{
                  position: "absolute",
                  left: CX,
                  top: CY,
                  transform: "translate(-50%,-50%)",
                  width: HUB,
                  height: HUB,
                  borderRadius: 999,
                  background: "var(--db-navy-800)",
                  border: "1px solid var(--db-navy-700)",
                  boxShadow: "var(--shadow-xl)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  textAlign: "center",
                  padding: 16,
                }}
              >
                <img
                  src="/databricks-symbol-light.svg"
                  style={{ height: 32 }}
                  alt="Databricks"
                />
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10.5,
                    fontWeight: 500,
                    color: "var(--db-lava-400)",
                  }}
                >
                  <Icon name="spark" size={12} color="var(--db-lava-500)" /> Genie inside
                </div>
              </div>

              {/* nodes */}
              {APPS.map((app, i) => (
                <div
                  key={app.id}
                  style={{
                    position: "absolute",
                    left: positions[i].x,
                    top: positions[i].y,
                    transform: "translate(-50%,-50%)",
                  }}
                >
                  <AppNode app={app} width={CARD_W} onOpen={() => onOpen(app)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
