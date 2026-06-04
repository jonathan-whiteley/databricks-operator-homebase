// ui/src/components/db/TourCursor.tsx
//
// Tour Mode's animated pointer. When a beat starts, we schedule its cue
// timeline (from ui/src/lib/tour-script.ts) — moving a fixed-position
// cursor div to each target's bounding rect, emitting a click ripple at
// click cues, and firing the associated fake-success toast. The cursor
// is decorative only: it never dispatches real DOM events (which would
// pause the tour via the document-level interaction listener in
// ui/src/state/tour-mode.tsx). It also paints a soft highlight ring
// over the current target so the eye knows where to land.
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/db/ToastRegion";
import { TOUR_BEATS } from "@/lib/tour-script";
import { useTour } from "@/state/tour-mode";

type Pos = { x: number; y: number };

// Best-effort target lookup. We retry briefly because beat cues fire
// shortly after a route change and the new page may still be mounting.
function findTarget(selector: string, tries = 6): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el || n >= tries) return resolve(el);
      n += 1;
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

function centerOf(el: HTMLElement): Pos {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function TourCursor() {
  const tour = useTour();
  const toast = useToast();

  const [pos, setPos] = useState<Pos | null>(null);
  const [rippleAt, setRippleAt] = useState<{ key: number; x: number; y: number } | null>(null);
  const [ring, setRing] = useState<DOMRect | null>(null);

  // Track the current target element so the highlight ring follows it
  // through layout shifts (e.g. window resize, content load-in).
  const ringTargetRef = useRef<HTMLElement | null>(null);

  // Reschedule cue timeline whenever beat changes while playing.
  useEffect(() => {
    if (tour.state !== "playing") return;
    const beat = TOUR_BEATS[tour.beatIndex];
    if (!beat?.cues || beat.cues.length === 0) {
      ringTargetRef.current = null;
      setRing(null);
      return;
    }

    const timers: number[] = [];
    let cancelled = false;

    beat.cues.forEach((cue, cueIdx) => {
      const id = window.setTimeout(async () => {
        if (cancelled) return;
        const el = await findTarget(cue.selector);
        if (cancelled || !el) return;
        // Pull the target into view if it's off-screen.
        const r = el.getBoundingClientRect();
        if (r.top < 64 || r.bottom > window.innerHeight - 64) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // Re-read rect after potential scroll.
        const center = centerOf(el);
        setPos(center);
        ringTargetRef.current = el;
        setRing(el.getBoundingClientRect());
        if (cue.click) {
          // Allow the cursor to glide into place before the click pulse.
          window.setTimeout(() => {
            if (cancelled) return;
            const c = centerOf(el);
            setRippleAt({ key: Date.now() + cueIdx, x: c.x, y: c.y });
            if (cue.toast) toast.success(cue.toast);
          }, 500);
        }
      }, cue.at);
      timers.push(id);
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [tour.state, tour.beatIndex, toast]);

  // Keep the highlight ring tracking its target through layout shifts.
  useEffect(() => {
    if (!ringTargetRef.current) return;
    const sync = () => {
      const el = ringTargetRef.current;
      if (!el) return;
      setRing(el.getBoundingClientRect());
      setPos(centerOf(el));
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    const id = window.setInterval(sync, 250);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      window.clearInterval(id);
    };
  }, [tour.beatIndex, tour.state]);

  // Clear the cursor & ring when the tour stops or pauses.
  useEffect(() => {
    if (tour.state === "idle") {
      setPos(null);
      setRing(null);
      setRippleAt(null);
      ringTargetRef.current = null;
    }
  }, [tour.state]);

  if (tour.state === "idle") return null;

  return (
    <>
      {ring && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: ring.left - 6,
            top: ring.top - 6,
            width: ring.width + 12,
            height: ring.height + 12,
            border: "2px solid var(--db-lava-500)",
            borderRadius: 12,
            boxShadow:
              "0 0 0 6px rgba(255, 54, 33, 0.12), 0 8px 28px rgba(255, 54, 33, 0.18)",
            pointerEvents: "none",
            zIndex: 9996,
            transition:
              "left 600ms cubic-bezier(.2,.7,.2,1), top 600ms cubic-bezier(.2,.7,.2,1), width 600ms cubic-bezier(.2,.7,.2,1), height 600ms cubic-bezier(.2,.7,.2,1)",
          }}
        />
      )}
      {pos && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translate(-6px, -4px)",
            pointerEvents: "none",
            zIndex: 9999,
            transition:
              "left 650ms cubic-bezier(.2,.7,.2,1), top 650ms cubic-bezier(.2,.7,.2,1)",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))",
          }}
        >
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
            <path
              d="M3 2 L3 24 L9.5 18.5 L13.2 27 L16.8 25.4 L13.1 17 L21.5 16.2 Z"
              fill="#fff"
              stroke="#0b1220"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      {rippleAt && (
        <span
          key={rippleAt.key}
          aria-hidden
          onAnimationEnd={() => setRippleAt(null)}
          style={{
            position: "fixed",
            left: rippleAt.x,
            top: rippleAt.y,
            width: 22,
            height: 22,
            marginLeft: -11,
            marginTop: -11,
            borderRadius: "50%",
            border: "2px solid var(--db-lava-500)",
            pointerEvents: "none",
            zIndex: 9998,
            animation: "hb-tour-ripple 650ms ease-out forwards",
          }}
        />
      )}
      <style>{`
        @keyframes hb-tour-ripple {
          0%   { transform: scale(0.4); opacity: 0.95; }
          70%  { opacity: 0.55; }
          100% { transform: scale(4.2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
