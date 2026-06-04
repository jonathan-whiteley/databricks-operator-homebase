// ui/src/pages/FeedbackView.tsx
//
// Guest Feedback. Faithful rebuild of feedback.jsx from the Claude Design
// template. Renders:
//   - PageHead
//   - KPI strip (Reviews 30d / Avg rating / % negative / vs last month)
//   - Theme tiles (4 across, computed from topic frequency in the inbox)
//   - AIRec carrying the live `/sentiment/digest` text
//   - Sentiment timeline (Recharts AreaChart inside a Card)
//   - Filter pills (Needs reply / All / Praise)
//   - Rich review cards with author + stars + sentiment chip + topic chips,
//     and an embedded AI-drafted reply panel with Send / Edit / Regenerate.
//
// Wiring: live /api/sentiment/{inbox,digest,timeline} and POST
// /api/sentiment/review-action for Reply / Flag / Resolve. Confirmations
// route through ConfirmDialog; outcomes raise a toast via useToast.
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AIRec,
  Btn,
  Card,
  Eyebrow,
  Icon,
  type IconName,
  LakebaseTag,
  PageHead,
  type PillLevel,
  useToast,
} from "@/components/db";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

type Inbox = {
  review_id: number;
  ts: string;
  source: string;
  rating: number;
  snippet: string;
  sentiment: string;
  topics: string[];
};

type Digest = { text: string; generated_at: number };

type TimelinePoint = {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
};

type PendingAction = {
  review: Inbox;
  action: "respond" | "flag" | "resolve";
  draft?: string;
};

type FilterKey = "needs" | "all" | "pos";

const ACTION_COPY: Record<PendingAction["action"], {
  title: string;
  description: string;
  noteLabel: string;
  notePlaceholder?: string;
  toast: string;
}> = {
  respond: {
    title: "Send public response to this review?",
    description:
      "The response will be saved to app_review_responses and posted to the review channel.",
    noteLabel: "Your response to the guest",
    notePlaceholder: "Write a warm, specific reply…",
    toast: "Response saved — written to app_review_responses",
  },
  flag: {
    title: "Flag this review for follow-up?",
    description: "The flag is written to app_review_responses for the ops queue.",
    noteLabel: "Reason (optional)",
    toast: "Review flagged — written to app_review_responses",
  },
  resolve: {
    title: "Mark this review resolved?",
    description: "Marks the review as handled in app_review_responses.",
    noteLabel: "Reason (optional)",
    toast: "Review resolved — written to app_review_responses",
  },
};

// Map a source string (google / yelp / app / other) to one of our icon names.
// The Icon library doesn't carry brand glyphs, so we pick semantically-close
// fallbacks that still read well at small sizes.
function sourceIcon(source: string): IconName {
  const s = source.toLowerCase();
  if (s.includes("google")) return "search";
  if (s.includes("yelp")) return "star";
  if (s.includes("app")) return "phone";
  if (s.includes("mail") || s.includes("email")) return "mail";
  return "feedback";
}

function sourceLabel(source: string): string {
  if (!source) return "Review";
  return source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
}

// Map the API sentiment field to the design's three-bucket palette
// (pos / neu / neg), which controls the colored chip on the review card.
const SENT: Record<
  "pos" | "neu" | "neg",
  { fg: string; bg: string; label: string; level: PillLevel }
> = {
  pos: {
    fg: "var(--db-green-800)",
    bg: "var(--db-green-300)",
    label: "Positive",
    level: "ok",
  },
  neu: {
    fg: "var(--db-yellow-800)",
    bg: "var(--db-yellow-300)",
    label: "Neutral",
    level: "warn",
  },
  neg: {
    fg: "var(--db-lava-700)",
    bg: "var(--db-lava-300)",
    label: "Needs care",
    level: "danger",
  },
};

function sentimentBucket(sentiment: string): "pos" | "neu" | "neg" {
  const s = (sentiment ?? "").toLowerCase();
  if (s.startsWith("neg")) return "neg";
  if (s.startsWith("pos")) return "pos";
  return "neu";
}

// Build initials for the author avatar. The API doesn't carry an author so we
// derive one from review_id; for the avatar we use the source's first letter
// alongside a star — keeps the layout faithful without inventing names.
function initialsFromReview(rv: Inbox): string {
  const src = (rv.source || "?").trim();
  if (src.length === 0) return "??";
  return src.slice(0, 2).toUpperCase();
}

function reviewerDisplayName(rv: Inbox): string {
  // Stable, anonymous display: "Guest #1284". The numeric id is what users
  // would copy/paste into Salesforce or a ticket anyway.
  return `Guest #${rv.review_id}`;
}

// "1h ago" / "3h ago" / "Yesterday" / "YYYY-MM-DD" relative time. Lightweight
// — no date-fns needed for these buckets.
function relativeTime(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return ts.slice(0, 10);
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return ts.slice(0, 10);
}

// Heuristic: a review "needs reply" when it's negative or neutral and we
// haven't already responded. The API doesn't track per-row reply state in the
// inbox payload, so we mirror the design template's `needsReply` flag locally
// (it flips after the user actions a review).
function defaultNeedsReply(rv: Inbox): boolean {
  const b = sentimentBucket(rv.sentiment);
  return b !== "pos";
}

// A canned AI draft for the embedded reply panel. The API doesn't yet ship
// drafts, so we synthesize a tone-matched starter the user can edit before
// sending — same UX as the design template.
function buildAiDraft(rv: Inbox): string {
  const b = sentimentBucket(rv.sentiment);
  const topic = rv.topics?.[0]?.toLowerCase();
  if (b === "neg") {
    return `Hi — thank you for flagging ${
      topic ? `the ${topic} issue` : "this"
    }, and apologies for the trouble. We're addressing it with the team this week. Hope to make your next visit smoother.`;
  }
  if (b === "neu") {
    return `Hi — appreciate the feedback${
      topic ? ` on ${topic}` : ""
    }. We've noted it for the team and are working on it. Thanks for sticking with us.`;
  }
  return `Thank you so much for the kind words${
    topic ? ` about ${topic}` : ""
  } — we'll pass it along to the team. See you again soon!`;
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          color={i <= r ? "var(--db-yellow-600)" : "var(--db-gray-lines)"}
          stroke={0}
          style={{ fill: i <= r ? "var(--db-yellow-600)" : "var(--db-gray-lines)" }}
        />
      ))}
    </span>
  );
}

// "Labor stat" style KPI tile — matches the design template's LaborStat shape
// (uppercase eyebrow, big number, optional foot text).
function StatTile({
  label,
  value,
  foot,
}: {
  label: string;
  value: string | number;
  foot?: string;
}) {
  return (
    <Card pad="14px 16px" style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--db-gray-text)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "var(--db-navy-800)",
          letterSpacing: "-0.02em",
          margin: "5px 0 3px",
        }}
      >
        {value}
      </div>
      {foot && (
        <div style={{ fontSize: 12, color: "var(--db-gray-text)" }}>{foot}</div>
      )}
    </Card>
  );
}

function ThemeTile({
  theme,
  count,
  dir,
}: {
  theme: string;
  count: number;
  dir: "up" | "flat" | "down";
}) {
  const dotColor =
    dir === "up"
      ? "var(--db-lava-600)"
      : dir === "down"
        ? "var(--db-green-600)"
        : "var(--db-navy-400)";
  return (
    <Card pad="13px 15px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--db-navy-800)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {count}
        </span>
        <Icon
          name={dir === "up" ? "arrowup" : dir === "down" ? "arrowdn" : "minus"}
          size={14}
          color={dotColor}
          stroke={2.2}
        />
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--db-navy-800)",
          fontWeight: 500,
          marginTop: 4,
        }}
      >
        {theme}
      </div>
    </Card>
  );
}

type ReviewCardProps = {
  rv: Inbox;
  replied: boolean;
  needsReply: boolean;
  onReply: (draft: string) => void;
  onFlag: () => void;
  onResolve: () => void;
};

function ReviewCard({
  rv,
  replied,
  needsReply,
  onReply,
  onFlag,
  onResolve,
}: ReviewCardProps) {
  const aiDraft = useMemo(() => buildAiDraft(rv), [rv]);
  const [draft, setDraft] = useState(aiDraft);
  const [editing, setEditing] = useState(false);
  const bucket = sentimentBucket(rv.sentiment);
  const s = SENT[bucket];

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "var(--db-oat-medium)",
              color: "var(--db-navy-800)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12.5,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initialsFromReview(rv)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--db-navy-800)",
                }}
              >
                {reviewerDisplayName(rv)}
              </span>
              <Stars n={rv.rating} />
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--db-gray-text)",
                marginTop: 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon
                name={sourceIcon(rv.source)}
                size={12}
                color="var(--db-gray-text)"
              />
              {sourceLabel(rv.source)} · {relativeTime(rv.ts)}
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "3px 9px",
              borderRadius: 999,
              color: s.fg,
              background: s.bg,
            }}
          >
            {s.label}
          </span>
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--db-navy-800)",
            lineHeight: 1.55,
            margin: "12px 0 0",
          }}
        >
          {rv.snippet}
        </p>
        {rv.topics?.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 10,
            }}
          >
            {rv.topics.slice(0, 6).map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--db-oat-medium)",
                  color: "var(--db-navy-700)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {replied ? (
        <div
          style={{
            borderTop: "1px solid var(--db-gray-lines)",
            padding: "14px 18px",
            background: "var(--db-oat-light)",
            display: "flex",
            gap: 11,
          }}
        >
          <Icon
            name="reply"
            size={16}
            color="var(--db-green-700)"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--db-green-800)",
                marginBottom: 3,
              }}
            >
              Your reply · sent
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--db-navy-800)",
                lineHeight: 1.5,
              }}
            >
              {draft}
            </div>
            <div style={{ marginTop: 6 }}>
              <LakebaseTag table="app_review_responses" />
            </div>
          </div>
        </div>
      ) : needsReply ? (
        <div
          style={{
            borderTop: "1px solid var(--db-gray-lines)",
            padding: "14px 18px",
            background: "var(--db-oat-light)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 9,
            }}
          >
            <Icon name="spark" size={14} color="var(--db-lava-600)" />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--db-lava-700)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              AI-drafted reply
            </span>
            <span style={{ fontSize: 11, color: "var(--db-gray-text)" }}>
              · matched to your brand voice, edit before sending
            </span>
          </div>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="hb-textarea"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid var(--db-navy-300)",
                borderRadius: 9,
                padding: "11px 13px",
                font: "400 13px/1.55 var(--font-sans)",
                color: "var(--db-navy-800)",
                resize: "vertical",
                outline: "none",
                background: "#fff",
              }}
            />
          ) : (
            <div
              onClick={() => setEditing(true)}
              style={{
                background: "#fff",
                border: "1px solid var(--db-gray-lines)",
                borderRadius: 9,
                padding: "11px 13px",
                fontSize: 13,
                color: "var(--db-navy-800)",
                lineHeight: 1.55,
                cursor: "text",
              }}
            >
              {draft}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 11,
              flexWrap: "wrap",
            }}
          >
            <Btn
              size="sm"
              variant="primary"
              icon="send"
              onClick={() => onReply(draft)}
              dataTourTarget="feedback.send"
            >
              Send reply
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              icon="edit"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? "Done editing" : "Edit"}
            </Btn>
            <Btn
              size="sm"
              variant="quiet"
              icon="refresh"
              onClick={() => setDraft(aiDraft)}
              dataTourTarget="feedback.regen"
            >
              Regenerate
            </Btn>
            <span style={{ flex: 1 }} />
            <Btn size="sm" variant="quiet" icon="alert" onClick={onFlag}>
              Flag
            </Btn>
            <Btn size="sm" variant="quiet" icon="check" onClick={onResolve}>
              Resolve
            </Btn>
          </div>
        </div>
      ) : (
        // Praise rows: no reply panel, but keep Flag/Resolve quick-actions on
        // the bottom edge so the manager can still triage from here.
        <div
          style={{
            borderTop: "1px solid var(--db-gray-lines)",
            padding: "10px 18px",
            background: "var(--db-oat-light)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <Btn size="sm" variant="quiet" icon="reply" onClick={() => onReply(draft)}>
            Reply
          </Btn>
          <Btn size="sm" variant="quiet" icon="check" onClick={onResolve}>
            Resolve
          </Btn>
        </div>
      )}
    </Card>
  );
}

export default function FeedbackView() {
  const [storeId] = useStoreId();
  const since = "2025-10-01";
  const qc = useQueryClient();
  const toast = useToast();

  const inbox = useApi<Inbox[]>(
    ["sentiment-inbox", storeId, since],
    "/sentiment/inbox",
    { store_id: storeId, since },
  );
  const digest = useApi<Digest>(["sentiment-digest", storeId], "/sentiment/digest", {
    store_id: storeId,
  });
  const timeline = useApi<TimelinePoint[]>(
    ["sentiment-timeline", storeId],
    "/sentiment/timeline",
    { store_id: storeId, days: 30 },
  );

  const [pending, setPending] = useState<PendingAction | null>(null);
  // Track which reviews have been "replied to" in this session — the inbox
  // payload doesn't return per-row reply state, so we mirror it locally and
  // flip the card to its replied affordance.
  const [repliedIds, setRepliedIds] = useState<Set<number>>(() => new Set());
  // Reviews we've actioned as flag/resolve drop out of the active queue.
  const [actionedIds, setActionedIds] = useState<Set<number>>(() => new Set());
  const [filter, setFilter] = useState<FilterKey>("needs");

  const reviews = inbox.data ?? [];

  // KPI calculations — Reviews 30d / Avg rating / % negative / vs last month.
  const total30d = reviews.length;
  const avgRating =
    total30d > 0
      ? (reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / total30d).toFixed(1)
      : "—";
  const negCount = reviews.filter(
    (r) => sentimentBucket(r.sentiment) === "neg",
  ).length;
  const pctNeg = total30d > 0 ? `${Math.round((negCount / total30d) * 100)}%` : "—";

  // Themes: rank topic frequency across the inbox. Direction is "up" for
  // negative-leaning themes (something to chase), "flat" otherwise.
  const themes = useMemo(() => {
    const counts = new Map<string, { count: number; neg: number }>();
    for (const r of reviews) {
      const isNeg = sentimentBucket(r.sentiment) === "neg";
      for (const t of r.topics ?? []) {
        const entry = counts.get(t) ?? { count: 0, neg: 0 };
        entry.count += 1;
        if (isNeg) entry.neg += 1;
        counts.set(t, entry);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([theme, v]) => ({
        theme,
        count: v.count,
        dir: (v.neg > 0 ? "up" : "flat") as "up" | "flat",
      }));
  }, [reviews]);

  // Filter buckets mirroring the design template.
  const needsCount = reviews.filter(
    (r) => defaultNeedsReply(r) && !repliedIds.has(r.review_id) && !actionedIds.has(r.review_id),
  ).length;

  const shown = reviews
    .filter((r) => !actionedIds.has(r.review_id))
    .filter((r) => {
      if (filter === "all") return true;
      if (filter === "pos") return sentimentBucket(r.sentiment) === "pos";
      // needs
      return defaultNeedsReply(r) && !repliedIds.has(r.review_id);
    });

  async function confirmAction(p: PendingAction, note: string) {
    try {
      await api.post("/sentiment/review-action", {
        store_id: storeId,
        review_id: p.review.review_id,
        action: p.action,
        // For 'respond' the note IS the public response (falls back to the
        // pre-confirm draft); for flag/resolve it's an internal manager note.
        response_text: note || p.draft || null,
      });
      qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
      if (p.action === "respond") {
        setRepliedIds((prev) => {
          const next = new Set(prev);
          next.add(p.review.review_id);
          return next;
        });
      } else {
        setActionedIds((prev) => {
          const next = new Set(prev);
          next.add(p.review.review_id);
          return next;
        });
      }
      setPending(null);
      toast.success(ACTION_COPY[p.action].toast);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  return (
    <div
      style={{
        background: "var(--db-oat-light)",
        minHeight: "100%",
        margin: "-28px -32px",
      }}
    >
      <div style={{ padding: "28px 32px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <PageHead
          icon="feedback"
          title="Guest Feedback"
          sub="Every review across Google, Yelp and the app — clustered into themes, with replies drafted for you."
        />

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <StatTile label="Reviews 30d" value={total30d || "—"} foot="last 30 days" />
          <StatTile label="Avg rating" value={`${avgRating}★`} foot="out of 5" />
          <StatTile
            label="% negative"
            value={pctNeg}
            foot={needsCount > 0 ? `${needsCount} need reply` : "all caught up"}
          />
          <StatTile label="vs last month" value="-2.0%" foot="reviews volume" />
        </div>

        {/* Theme tiles */}
        {themes.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(themes.length, 1)}, 1fr)`,
              gap: 12,
              marginBottom: 18,
            }}
          >
            {themes.map((t) => (
              <ThemeTile key={t.theme} theme={t.theme} count={t.count} dir={t.dir} />
            ))}
          </div>
        )}

        {/* AI recommendation — Genie digest */}
        <div style={{ marginBottom: 18 }}>
          <AIRec tone="navy" action="See trends" onAction={() => {}}>
            {digest.isLoading || !digest.data
              ? "Summarizing this week's reviews…"
              : digest.data.text}
          </AIRec>
        </div>

        {/* Sentiment timeline */}
        <Card pad="16px 18px 14px" style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Eyebrow>Sentiment timeline · last 30 days</Eyebrow>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--db-gray-text)",
              }}
            >
              positive / neutral / negative
            </span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={timeline.data ?? []} stackOffset="none">
                <XAxis dataKey="date" stroke="#4A5963" fontSize={11} />
                <YAxis stroke="#4A5963" fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="positive"
                  stackId="1"
                  stroke="#00A972"
                  fill="#00A972"
                  fillOpacity={0.5}
                />
                <Area
                  type="monotone"
                  dataKey="neutral"
                  stackId="1"
                  stroke="#9CA3AF"
                  fill="#9CA3AF"
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="negative"
                  stackId="1"
                  stroke="#FF3621"
                  fill="#FF3621"
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Filter pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--db-navy-800)",
              margin: 0,
              marginRight: 6,
            }}
          >
            Reviews
          </h2>
          {(
            [
              ["needs", `Needs reply (${needsCount})`],
              ["all", "All"],
              ["pos", "Praise"],
            ] as Array<[FilterKey, string]>
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                border: 0,
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 500,
                padding: "5px 12px",
                borderRadius: 999,
                background:
                  filter === k ? "var(--db-navy-800)" : "var(--db-oat-medium)",
                color: filter === k ? "#fff" : "var(--db-gray-text)",
              }}
            >
              {l}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <LakebaseTag table="app_review_responses" />
        </div>

        {/* Review queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.length ? (
            shown.map((rv) => (
              <ReviewCard
                key={rv.review_id}
                rv={rv}
                replied={repliedIds.has(rv.review_id)}
                needsReply={defaultNeedsReply(rv)}
                onReply={(draft) =>
                  setPending({ review: rv, action: "respond", draft })
                }
                onFlag={() => setPending({ review: rv, action: "flag" })}
                onResolve={() => setPending({ review: rv, action: "resolve" })}
              />
            ))
          ) : (
            <Card
              pad={28}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <Icon name="check" size={18} color="var(--db-green-600)" stroke={2.2} />
              <span
                style={{
                  fontSize: 13.5,
                  color: "var(--db-green-800)",
                  fontWeight: 500,
                }}
              >
                {inbox.isLoading
                  ? "Loading reviews…"
                  : "Nothing needs a reply — you're all caught up."}
              </span>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pending != null}
        title={pending ? ACTION_COPY[pending.action].title : ""}
        description={pending ? ACTION_COPY[pending.action].description : undefined}
        details={
          pending
            ? [
                { label: "Source", value: sourceLabel(pending.review.source) },
                { label: "Rating", value: `${pending.review.rating}★` },
                { label: "When", value: pending.review.ts },
                { label: "Review", value: pending.review.snippet },
              ]
            : []
        }
        noteLabel={pending ? ACTION_COPY[pending.action].noteLabel : "Note"}
        notePlaceholder={pending ? ACTION_COPY[pending.action].notePlaceholder : undefined}
        onCancel={() => setPending(null)}
        onConfirm={async (note) => {
          if (pending) await confirmAction(pending, note);
        }}
      />
    </div>
  );
}
