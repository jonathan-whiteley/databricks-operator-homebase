// ui/src/pages/FeedbackView.tsx
//
// Phase 10 re-skin of the feedback (formerly sentiment) view. Uses only
// `components/db/*` primitives for chrome. Pulls from existing
// /api/sentiment/{digest,timeline,inbox} and POSTs to /sentiment/review-action
// for Reply / Flag / Resolve.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Pill,
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
};

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
// fallbacks that still read well at 14px.
function sourceIcon(source: string): IconName {
  const s = source.toLowerCase();
  if (s.includes("google")) return "search";
  if (s.includes("yelp")) return "star";
  if (s.includes("app")) return "phone";
  if (s.includes("mail") || s.includes("email")) return "mail";
  return "feedback";
}

function sentimentLevel(sentiment: string): PillLevel {
  const s = sentiment.toLowerCase();
  if (s.startsWith("neg")) return "danger";
  if (s.startsWith("pos")) return "ok";
  if (s.startsWith("neu")) return "info";
  if (s.startsWith("warn") || s.startsWith("mixed")) return "warn";
  return "neutral";
}

function sentimentLabel(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (s.startsWith("neg")) return "Negative";
  if (s.startsWith("pos")) return "Positive";
  if (s.startsWith("neu")) return "Neutral";
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

function formatDate(ts: string): string {
  // ts arrives as an ISO-ish "YYYY-MM-DD HH:MM:SS" string. Render YYYY-MM-DD
  // in the existing DM Mono font for the timeline column.
  return ts.slice(0, 10);
}

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={12}
          color={i <= r ? "var(--db-yellow-600)" : "var(--db-gray-lines)"}
          stroke={0}
          style={{ fill: i <= r ? "var(--db-yellow-600)" : "var(--db-gray-lines)" }}
        />
      ))}
    </span>
  );
}

function MiniKpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card pad="12px 14px">
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--db-gray-text)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--db-navy-800)",
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--db-gray-text)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

function TopicChip({ children }: { children: string }) {
  return (
    <span
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
      {children}
    </span>
  );
}

function ReviewRow({
  review,
  onAction,
}: {
  review: Inbox;
  onAction: (action: PendingAction["action"]) => void;
}) {
  const level = sentimentLevel(review.sentiment);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "14px 16px",
        borderBottom: "1px solid var(--db-gray-lines)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--db-oat-medium)",
          color: "var(--db-navy-800)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={sourceIcon(review.source)} size={15} color="currentColor" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--db-gray-text)",
            }}
          >
            {formatDate(review.ts)}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--db-gray-text)",
              textTransform: "capitalize",
            }}
          >
            {review.source}
          </span>
          <Stars rating={review.rating} />
          <Pill level={level} dot>
            {sentimentLabel(review.sentiment)}
          </Pill>
          {review.topics?.length > 0 && (
            <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
              {review.topics.slice(0, 4).map((t) => (
                <TopicChip key={t}>{t}</TopicChip>
              ))}
            </div>
          )}
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--db-navy-800)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {review.snippet}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexShrink: 0,
          alignSelf: "center",
        }}
      >
        <Btn size="sm" variant="primary" icon="reply" onClick={() => onAction("respond")}>
          Reply
        </Btn>
        <Btn
          size="sm"
          variant="subtle"
          icon="alert"
          onClick={() => onAction("flag")}
          style={{
            background: "var(--db-yellow-300)",
            color: "var(--db-yellow-800)",
          }}
        >
          Flag
        </Btn>
        <Btn
          size="sm"
          variant="subtle"
          icon="check"
          onClick={() => onAction("resolve")}
          style={{
            background: "var(--db-green-300)",
            color: "var(--db-green-800)",
          }}
        >
          Resolve
        </Btn>
      </div>
    </div>
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
    ["sent-timeline", storeId],
    "/sentiment/timeline",
    { store_id: storeId, days: 30 },
  );

  const [pending, setPending] = useState<PendingAction | null>(null);

  async function confirmAction(p: PendingAction, note: string) {
    try {
      await api.post("/sentiment/review-action", {
        store_id: storeId,
        review_id: p.review.review_id,
        action: p.action,
        // For 'respond' the note IS the public response; for flag/resolve
        // it's an internal manager note — same column either way.
        response_text: note || null,
      });
      qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
      setPending(null);
      toast.success(ACTION_COPY[p.action].toast);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't save: ${msg}`);
    }
  }

  // KPI calculations.
  const reviews = inbox.data ?? [];
  const total30d = reviews.length;
  const avgRating =
    total30d > 0
      ? (reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / total30d).toFixed(1)
      : "—";
  const negCount = reviews.filter((r) => r.sentiment?.toLowerCase().startsWith("neg")).length;
  const pctNeg = total30d > 0 ? `${Math.round((negCount / total30d) * 100)}%` : "—";

  return (
    <div
      style={{
        background: "var(--db-oat-light)",
        minHeight: "100%",
        margin: "-28px -32px",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "28px 32px 40px",
        }}
      >
        <PageHead
          icon="feedback"
          title="Guest Feedback"
          sub="This week's reviews and your reply queue."
        />

        {/* Genie digest */}
        <div style={{ marginBottom: 18 }}>
          <AIRec tone="navy" action="See trends" onAction={() => {}}>
            {digest.isLoading || !digest.data
              ? "Summarizing this week's reviews…"
              : digest.data.text}
          </AIRec>
        </div>

        {/* KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <MiniKpi label="Reviews 30d" value={total30d || "—"} sub="last 30 days" />
          <MiniKpi label="Avg rating" value={avgRating} sub="out of 5" />
          <MiniKpi label="% negative" value={pctNeg} sub="of total" />
          <MiniKpi label="vs last month" value="-2.0%" sub="reviews volume" />
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

        {/* Reply queue */}
        <Card pad={0}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid var(--db-gray-lines)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Eyebrow>Reply queue</Eyebrow>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--db-navy-800)",
                }}
              >
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </div>
            <LakebaseTag table="app_review_responses" />
          </div>
          {reviews.length === 0 ? (
            <div
              style={{
                padding: "28px 18px",
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
                {inbox.isLoading ? "Loading reviews…" : "All caught up — no reviews to reply to."}
              </span>
            </div>
          ) : (
            <div>
              {reviews.map((rv) => (
                <ReviewRow
                  key={rv.review_id}
                  review={rv}
                  onAction={(action) => setPending({ review: rv, action })}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={pending != null}
        title={pending ? ACTION_COPY[pending.action].title : ""}
        description={pending ? ACTION_COPY[pending.action].description : undefined}
        details={
          pending
            ? [
                { label: "Source", value: pending.review.source },
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
