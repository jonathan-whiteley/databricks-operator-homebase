// ui/src/components/db/TourButton.tsx
//
// TopBar tour-mode control + bottom-of-screen caption overlay. Three states:
// idle (▶ Tour), playing (⏸ 0:42 / 2:30), paused (▶ Resume).
import { useTour } from "@/state/tour-mode";

import Icon from "./Icon";

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TourButton() {
  const tour = useTour();

  const playing = tour.state === "playing";
  const paused = tour.state === "paused";

  const onClick = () => {
    if (tour.state === "idle") tour.start();
    else if (tour.state === "playing") tour.pause();
    else tour.resume();
  };

  return (
    <button
      type="button"
      data-tour-control
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid var(--db-gray-lines)",
        background: playing ? "var(--db-navy-800)" : "#fff",
        color: playing ? "#fff" : "var(--db-navy-800)",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
      aria-label={playing ? "Pause tour" : "Start tour"}
    >
      <Icon
        name={playing ? "minus" : "chev"}
        size={13}
        color={playing ? "#fff" : "var(--db-navy-800)"}
        stroke={2.4}
      />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
        {playing
          ? `${formatMs(tour.elapsedMs)} / ${formatMs(tour.totalMs)}`
          : paused
            ? "Resume"
            : "Tour"}
      </span>
    </button>
  );
}

export function TourOverlay() {
  const tour = useTour();
  if (tour.state === "idle") return null;

  const pct = Math.min(100, (tour.elapsedMs / tour.totalMs) * 100);

  return (
    <div
      data-tour-control
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 9998,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.15)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--db-lava-500)",
            transition: "width 200ms linear",
          }}
        />
      </div>
      <div
        style={{
          background: "rgba(15, 23, 42, 0.92)",
          color: "#fff",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          pointerEvents: "auto",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tour.state === "paused" ? "var(--db-gray-text)" : "var(--db-lava-500)",
            flexShrink: 0,
          }}
        >
          {tour.state === "paused" ? "Paused" : "Tour mode"} ·{" "}
          {tour.beatIndex + 1}/{tour.beatCount}
        </span>
        <span style={{ fontSize: 14, lineHeight: 1.4, flex: 1 }}>{tour.caption}</span>
        {tour.state === "paused" && (
          <button
            type="button"
            data-tour-control
            onClick={tour.resume}
            aria-label="Resume tour"
            style={{
              height: 28,
              padding: "0 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          data-tour-control
          onClick={tour.stop}
          aria-label="Exit tour"
          title="Exit tour"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            fontFamily: "var(--font-sans)",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
