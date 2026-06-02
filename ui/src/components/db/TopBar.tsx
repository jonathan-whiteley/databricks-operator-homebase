// ui/src/components/db/TopBar.tsx
//
// 56px white bar across the top of the main column. Shows the active store
// breadcrumb, a live-ish clock, the lava "Ask Genie" button, and a bell with
// a red dot for outstanding alerts (cosmetic for now).
import { useEffect, useState } from "react";

import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { useGeniePanel } from "@/state/genie-panel";

import Btn from "./Btn";
import Icon from "./Icon";
import { TourButton } from "./TourButton";

type Store = {
  store_id: number;
  store_name: string;
  city: string;
  state: string;
};

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function useDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TopBar() {
  const [storeId] = useStoreId();
  const { data: stores } = useApi<Store[]>(["stores"], "/stores");
  const { togglePanel } = useGeniePanel();
  const clock = useClock();
  const date = useDate();

  const store = stores?.find((s) => s.store_id === storeId);
  const num = `#${String(storeId).padStart(3, "0")}`;
  const hood = store?.city ?? store?.store_name ?? "—";

  return (
    <header
      style={{
        height: 56,
        padding: "0 28px",
        background: "#fff",
        borderBottom: "1px solid var(--db-gray-lines)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
        <span style={{ fontWeight: 500, color: "var(--db-navy-800)" }}>
          {num} · {hood}
        </span>
        <Icon name="chevd" size={14} color="var(--db-navy-400)" />
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            color: "var(--db-gray-text)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {date} · {clock}
        </span>
        <TourButton />
        <Btn
          size="sm"
          variant="primary"
          icon="spark"
          onClick={togglePanel}
          style={{ borderRadius: 999 }}
        >
          Ask Genie
        </Btn>
        <button
          type="button"
          className="hb-iconbtn"
          style={{
            position: "relative",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            display: "flex",
            padding: 4,
          }}
          aria-label="Notifications"
        >
          <Icon name="bell" size={19} color="var(--db-gray-text)" />
          <span
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "var(--db-lava-600)",
              border: "1.5px solid #fff",
            }}
          />
        </button>
      </div>
    </header>
  );
}
