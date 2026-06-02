// ui/src/lib/tour-script.ts
//
// 2:30 booth-loop walkthrough. Each beat declares: where to navigate, how
// long to dwell, the caption, and an optional fake toast (no real POST).
// Run by ui/src/state/tour-mode.tsx.

export type Beat = {
  to: string;
  ms: number;
  caption: string;
  // Optional fake success toast fired at the START of the beat.
  toast?: string;
  // Optional Genie-panel intent: when true, the driver opens the slide-over.
  openGenie?: boolean;
};

export const TOUR_BEATS: Beat[] = [
  {
    to: "/today",
    ms: 10_000,
    caption:
      "One console, six things a store manager does at 7am. Genie sits at the centre, modules around it.",
  },
  {
    to: "/labor",
    ms: 20_000,
    caption:
      "Labor. ML rec from Model Serving. Manager locks the day-part schedule — writes to Lakebase, lands in lhm_app.app_labor_overrides.",
    toast: "Day-part schedule locked",
  },
  {
    to: "/inventory",
    ms: 20_000,
    caption:
      "Inventory. Per-vendor POs before the truck cut-off. Release writes to Lakebase.",
    toast: "Purchase order released",
  },
  {
    to: "/equipment",
    ms: 20_000,
    caption:
      "Equipment. RUL model flagged this cooler. One click schedules service and logs a work order to Lakebase.",
    toast: "Work order scheduled",
  },
  {
    to: "/members",
    ms: 20_000,
    caption:
      "Loyalty. Win-back to at-risk regulars. One executemany — N rows into Lakebase for the CRM team.",
    toast: "Win-back offer sent to 42 members",
  },
  {
    to: "/feedback",
    ms: 20_000,
    caption:
      "Feedback. LLM drafts the reply in the manager's voice. Approve and Lakebase logs the response.",
    toast: "Review reply posted",
  },
  {
    to: "/labor",
    ms: 30_000,
    caption:
      "Genie · one space, all 21 UC tables. The manager asks across labor, equipment, sentiment — same chat, same governance.",
    openGenie: true,
  },
  {
    to: "/today",
    ms: 10_000,
    caption:
      "UC + Lakebase + Genie + Model Serving — four primitives, one console. Replaces five tools for the manager.",
  },
];

export const TOUR_TOTAL_MS = TOUR_BEATS.reduce((a, b) => a + b.ms, 0);
