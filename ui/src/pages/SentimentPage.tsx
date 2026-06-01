// ui/src/pages/SentimentPage.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
import { useToast } from "@/components/Toast";
import { api, useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

type PendingAction = {
  review: Inbox;
  action: "respond" | "flag" | "resolve";
};

const ACTION_COPY: Record<PendingAction["action"], {
  title: string;
  description: string;
  noteLabel: string;
  toast: string;
}> = {
  respond: {
    title: "Send public response to this review?",
    description: "The response will be saved to app_review_responses and posted to the review channel.",
    noteLabel: "Your response to the customer",
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

export default function SentimentPage() {
  const [storeId] = useStoreId();
  const since = "2025-10-01";
  const qc = useQueryClient();
  const toast = useToast();
  const inbox = useApi<Inbox[]>(["sentiment-inbox", storeId, since], "/sentiment/inbox", { store_id: storeId, since });
  const digest = useApi<Digest>(["sentiment-digest", storeId], "/sentiment/digest", { store_id: storeId });
  const timeline = useApi<{ date: string; positive: number; neutral: number; negative: number }[]>(
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
    } catch (err: any) {
      toast.error(`Couldn't save: ${err?.message ?? "unknown error"}`);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Sentiment</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Reviews 30d" value={inbox.data?.length ?? "—"} accent="navy" />
          <MetricCard label="Avg rating" value="4.1" accent="success" />
          <MetricCard label="% negative" value="14%" accent="lava" />
          <MetricCard label="Vs last month" value="-2.0%" accent="warning" />
        </div>
        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">This week's digest</h3>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            {digest.data?.text ?? "Generating…"}
          </p>
        </section>
        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Sentiment · last 30 days</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={timeline.data ?? []} stackOffset="none">
                <XAxis dataKey="date" stroke="#4A5963" fontSize={11} />
                <YAxis stroke="#4A5963" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stackId="1" stroke="#00A972" fill="#00A972" fillOpacity={0.5} />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.4} />
                <Area type="monotone" dataKey="negative" stackId="1" stroke="#FF3621" fill="#FF3621" fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <DataTable
          rows={inbox.data ?? []}
          columns={[
            { key: "ts", header: "When" },
            { key: "source", header: "Source" },
            { key: "rating", header: "★", align: "right" },
            { key: "sentiment", header: "Sentiment" },
            { key: "snippet", header: "Review" },
            {
              key: "_act",
              header: "",
              align: "right",
              render: (r) => (
                <div className="flex gap-1">
                  <button
                    onClick={() => setPending({ review: r, action: "respond" })}
                    className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs text-white"
                  >
                    Respond
                  </button>
                  <button
                    onClick={() => setPending({ review: r, action: "flag" })}
                    className="rounded-md bg-[color:var(--color-warning)] px-2 py-1 text-xs text-white"
                  >
                    Flag
                  </button>
                  <button
                    onClick={() => setPending({ review: r, action: "resolve" })}
                    className="rounded-md bg-[color:var(--color-success)] px-2 py-1 text-xs text-white"
                  >
                    Resolve
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
      <GenieChat
        tabId="sentiment"
        chips={[
          "What's the top complaint this week at my store?",
          "Which day-part gets the worst reviews?",
          "Compare my store's rating to nearby stores",
        ]}
      />
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
        notePlaceholder={
          pending?.action === "respond" ? "Write a warm, specific reply…" : undefined
        }
        onCancel={() => setPending(null)}
        onConfirm={async (note) => {
          if (pending) await confirmAction(pending, note);
        }}
      />
    </div>
  );
}
