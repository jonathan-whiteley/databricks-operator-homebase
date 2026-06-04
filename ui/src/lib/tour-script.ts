// ui/src/lib/tour-script.ts
//
// 2:00 booth-loop walkthrough. Each beat declares: where to navigate, how
// long to dwell, the caption, and an optional list of cursor cues
// (selector + ms-offset within the beat) that drive the animated tour
// pointer in ui/src/components/db/TourCursor.tsx. Cues can also fire a
// fake-success toast at the moment of the on-screen click. Run by
// ui/src/state/tour-mode.tsx.

export type TourCue = {
  // Milliseconds into the current beat when this cue should fire.
  at: number;
  // CSS selector. Convention: '[data-tour-target="<page>.<key>"]'.
  selector: string;
  // When true, the cursor pulses + emits a ripple at the target.
  click?: boolean;
  // Optional fake success toast fired at the click moment.
  toast?: string;
};

export type Beat = {
  to: string;
  ms: number;
  caption: string;
  // Optional Genie-panel intent: when true, the driver opens the slide-over.
  openGenie?: boolean;
  // Optional cursor choreography during this beat.
  cues?: TourCue[];
};

// 8 beats, totalling 120_000ms (2:00 exactly).
export const TOUR_BEATS: Beat[] = [
  {
    to: "/today",
    ms: 8_000,
    caption:
      "One console, six things a store manager does at 7am. Genie sits at the centre, modules around it.",
    cues: [
      { at: 1_800, selector: '[data-tour-target="today.genie"]' },
      { at: 4_500, selector: '[data-tour-target="today.genie"]', click: true },
    ],
  },
  {
    to: "/labor",
    ms: 16_000,
    caption:
      "Labor. ML rec from Model Serving. Manager locks the day-part schedule — writes to Lakebase, lands in lhm_app.app_labor_overrides.",
    cues: [
      { at: 1_500, selector: '[data-tour-target="labor.approve"]' },
      {
        at: 8_500,
        selector: '[data-tour-target="labor.approve"]',
        click: true,
        toast: "Day-part schedule locked",
      },
    ],
  },
  {
    to: "/inventory",
    ms: 16_000,
    caption:
      "Inventory. Per-vendor POs before the truck cut-off. Release writes to Lakebase.",
    cues: [
      { at: 1_500, selector: '[data-tour-target="inventory.release"]' },
      {
        at: 8_500,
        selector: '[data-tour-target="inventory.release"]',
        click: true,
        toast: "Purchase order released",
      },
    ],
  },
  {
    to: "/equipment",
    ms: 16_000,
    caption:
      "Equipment. RUL model flagged this cooler. One click schedules service and logs a work order to Lakebase.",
    cues: [
      { at: 1_500, selector: '[data-tour-target="equipment.schedule"]' },
      {
        at: 8_500,
        selector: '[data-tour-target="equipment.schedule"]',
        click: true,
        toast: "Work order scheduled",
      },
    ],
  },
  {
    to: "/members",
    ms: 16_000,
    caption:
      "Loyalty. Win-back to at-risk regulars. One executemany — N rows into Lakebase for the CRM team.",
    cues: [
      { at: 1_500, selector: '[data-tour-target="members.send"]' },
      {
        at: 8_500,
        selector: '[data-tour-target="members.send"]',
        click: true,
        toast: "Win-back offer sent to 42 members",
      },
    ],
  },
  {
    to: "/feedback",
    ms: 16_000,
    caption:
      "Feedback. LLM drafts the reply in the manager's voice. Approve and Lakebase logs the response.",
    cues: [
      { at: 1_500, selector: '[data-tour-target="feedback.regen"]' },
      { at: 4_500, selector: '[data-tour-target="feedback.regen"]', click: true },
      { at: 7_500, selector: '[data-tour-target="feedback.send"]' },
      {
        at: 10_500,
        selector: '[data-tour-target="feedback.send"]',
        click: true,
        toast: "Review reply posted",
      },
    ],
  },
  {
    to: "/labor",
    ms: 24_000,
    caption:
      "Genie · one space, all 21 UC tables. The manager asks across labor, equipment, sentiment — same chat, same governance.",
    openGenie: true,
  },
  {
    to: "/today",
    ms: 8_000,
    caption:
      "UC + Lakebase + Genie + Model Serving — four primitives, one console. Replaces five tools for the manager.",
    cues: [{ at: 2_000, selector: '[data-tour-target="today.genie"]' }],
  },
];

export const TOUR_TOTAL_MS = TOUR_BEATS.reduce((a, b) => a + b.ms, 0);
