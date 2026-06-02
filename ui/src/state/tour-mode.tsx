// ui/src/state/tour-mode.tsx
//
// Tour Mode driver. Off by default. When a user clicks the Tour button it
// auto-walks ui/src/lib/tour-script.ts in a loop — navigates routes, fires
// fake-success toasts, optionally opens the Genie panel. Any real
// interaction (click, keydown, wheel) inside the main content pauses the
// loop and gives the user normal control back.
//
// No real writes are issued by the tour itself; the toasts are fired
// client-side via useToast(). User-initiated writes in interactive mode
// still hit the real backend.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useNavigate } from "react-router-dom";

import { useToast } from "@/components/db/ToastRegion";
import { useGeniePanel } from "@/state/genie-panel";
import { TOUR_BEATS, TOUR_TOTAL_MS } from "@/lib/tour-script";

type TourState = "idle" | "playing" | "paused";

type TourApi = {
  state: TourState;
  beatIndex: number;
  beatCount: number;
  caption: string;
  elapsedMs: number;
  totalMs: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

const TourContext = createContext<TourApi | null>(null);

const TICK_MS = 250;

export function TourProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TourState>("idle");
  const [beatIndex, setBeatIndex] = useState(0);
  // Elapsed ms inside the current beat. Total tour position is computed at
  // render time from beatIndex + this.
  const [beatElapsed, setBeatElapsed] = useState(0);

  const navigate = useNavigate();
  const toast = useToast();
  const genie = useGeniePanel();

  // Refs so the timer callback (frozen at start) sees live values.
  const stateRef = useRef(state);
  const beatIndexRef = useRef(beatIndex);
  const beatElapsedRef = useRef(beatElapsed);
  stateRef.current = state;
  beatIndexRef.current = beatIndex;
  beatElapsedRef.current = beatElapsed;

  // Apply side-effects when the beat changes while playing.
  const applyBeat = useCallback(
    (idx: number) => {
      const beat = TOUR_BEATS[idx];
      if (!beat) return;
      navigate(beat.to);
      if (beat.toast) {
        toast.success(beat.toast);
      }
      if (beat.openGenie) {
        genie.openPanel();
      }
    },
    [genie, navigate, toast],
  );

  // Tick loop while playing.
  useEffect(() => {
    if (state !== "playing") return;
    const id = window.setInterval(() => {
      const beat = TOUR_BEATS[beatIndexRef.current];
      if (!beat) return;
      const next = beatElapsedRef.current + TICK_MS;
      if (next >= beat.ms) {
        const nextIdx = (beatIndexRef.current + 1) % TOUR_BEATS.length;
        setBeatIndex(nextIdx);
        setBeatElapsed(0);
        applyBeat(nextIdx);
      } else {
        setBeatElapsed(next);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state, applyBeat]);

  // Pause on any real user interaction inside the document.
  useEffect(() => {
    if (state !== "playing") return;
    const onInteract = (e: Event) => {
      // Ignore clicks originating from the tour button itself.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-tour-control]")) return;
      setState("paused");
    };
    document.addEventListener("click", onInteract, true);
    document.addEventListener("keydown", onInteract, true);
    document.addEventListener("wheel", onInteract, { passive: true, capture: true });
    return () => {
      document.removeEventListener("click", onInteract, true);
      document.removeEventListener("keydown", onInteract, true);
      document.removeEventListener("wheel", onInteract, true);
    };
  }, [state]);

  const start = useCallback(() => {
    setBeatIndex(0);
    setBeatElapsed(0);
    setState("playing");
    applyBeat(0);
  }, [applyBeat]);

  const pause = useCallback(() => setState("paused"), []);
  const resume = useCallback(() => setState("playing"), []);
  const stop = useCallback(() => {
    setState("idle");
    setBeatIndex(0);
    setBeatElapsed(0);
  }, []);

  const elapsedMs = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < beatIndex; i += 1) acc += TOUR_BEATS[i].ms;
    return acc + beatElapsed;
  }, [beatIndex, beatElapsed]);

  const api = useMemo<TourApi>(
    () => ({
      state,
      beatIndex,
      beatCount: TOUR_BEATS.length,
      caption: TOUR_BEATS[beatIndex]?.caption ?? "",
      elapsedMs,
      totalMs: TOUR_TOTAL_MS,
      start,
      pause,
      resume,
      stop,
    }),
    [state, beatIndex, elapsedMs, start, pause, resume, stop],
  );

  return <TourContext.Provider value={api}>{children}</TourContext.Provider>;
}

export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
