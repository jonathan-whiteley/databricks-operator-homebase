// ui/src/components/db/Sidebar.tsx
//
// 236px navy-900 left rail. Six nav items, optional outstanding-count badges,
// a (cosmetic) search button, and a manager profile chip at the bottom.
// Active state is driven by react-router's NavLink, so URL changes propagate
// automatically. Badge counts come from /api/today/brief (shared with the
// Today view) so the rail stays in sync with the daily brief.
import { NavLink } from "react-router-dom";

import { useApi } from "@/lib/api";

import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";

type NavKey = "today" | "labor" | "inventory" | "equipment" | "members" | "feedback";

type NavEntry = {
  to: string;
  label: string;
  icon: IconName;
  key: NavKey;
};

const NAV: NavEntry[] = [
  { to: "/today", label: "Today", icon: "today", key: "today" },
  { to: "/labor", label: "Labor", icon: "labor", key: "labor" },
  { to: "/inventory", label: "Inventory", icon: "inventory", key: "inventory" },
  { to: "/equipment", label: "Equipment", icon: "equipment", key: "equipment" },
  { to: "/members", label: "Loyalty", icon: "members", key: "members" },
  { to: "/feedback", label: "Guest Feedback", icon: "feedback", key: "feedback" },
];

type BriefShape = {
  outstanding: {
    labor: number;
    inventory: number;
    equipment: number;
    members: number;
    feedback: number;
  };
};

export default function Sidebar() {
  // The brief is also fetched by TodayView; react-query dedupes on the shared
  // ["today-brief"] key so this is a free read. Loading/error states fall
  // through to badge counts of 0 (no badge rendered).
  const { data } = useApi<BriefShape>(["today-brief"], "/today/brief");
  const outstanding = data?.outstanding;
  const countFor = (key: NavKey): number => {
    if (!outstanding || key === "today") return 0;
    return outstanding[key] ?? 0;
  };
  return (
    <aside
      style={{
        width: 236,
        background: "var(--db-navy-900)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid var(--db-navy-700)",
        }}
      >
        <Logo />
      </div>
      <div style={{ padding: "12px 14px 8px" }}>
        <button
          type="button"
          className="hb-search"
          style={{
            width: "100%",
            background: "var(--db-navy-700)",
            border: 0,
            borderRadius: 8,
            padding: "8px 11px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            cursor: "pointer",
          }}
        >
          <Icon name="search" size={15} color="var(--db-navy-400)" />
          <span style={{ fontSize: 12.5, color: "var(--db-navy-400)" }}>Search store…</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10.5,
              color: "var(--db-navy-500)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ⌘K
          </span>
        </button>
      </div>
      <nav
        style={{
          padding: "4px 12px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflow: "auto",
        }}
      >
        {NAV.map((it) => {
          const n = countFor(it.key);
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className="hb-nav"
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "8px 11px",
                borderRadius: 7,
                border: 0,
                textAlign: "left",
                textDecoration: "none",
                cursor: "pointer",
                background: isActive ? "var(--db-navy-700)" : "transparent",
                color: isActive ? "#fff" : "var(--db-navy-300)",
                fontSize: 13.5,
                fontWeight: isActive ? 500 : 400,
                fontFamily: "var(--font-sans)",
                position: "relative",
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        left: -12,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 3,
                        background: "var(--db-lava-600)",
                      }}
                    />
                  )}
                  <Icon
                    name={it.icon}
                    size={17}
                    color={isActive ? "var(--db-lava-500)" : "var(--db-navy-400)"}
                  />
                  {it.label}
                  {n > 0 ? (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10.5,
                        fontWeight: 600,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        borderRadius: 999,
                        background: isActive ? "var(--db-lava-600)" : "var(--db-navy-700)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--db-navy-700)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
          <img src="/databricks-symbol-color.svg" style={{ height: 15 }} alt="" />
          <span style={{ fontSize: 10.5, color: "var(--db-navy-400)" }}>
            Powered by Databricks
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "var(--db-lava-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            MO
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#fff" }}>
              Maya Okonkwo
            </div>
            <div style={{ fontSize: 10.5, color: "var(--db-navy-400)" }}>Store manager</div>
          </div>
          <Icon name="settings" size={15} color="var(--db-navy-400)" />
        </div>
      </div>
    </aside>
  );
}
