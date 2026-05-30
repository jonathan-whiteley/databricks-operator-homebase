// ui/src/pages/SentimentPage.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { MetricCard } from "@/components/MetricCard";
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

export default function SentimentPage() {
  const [storeId] = useStoreId();
  const since = "2025-10-01";
  const qc = useQueryClient();
  const inbox = useApi<Inbox[]>(["sentiment-inbox", storeId, since], "/sentiment/inbox", { store_id: storeId, since });
  const digest = useApi<Digest>(["sentiment-digest", storeId], "/sentiment/digest", { store_id: storeId });
  const [drafting, setDrafting] = useState<number | null>(null);
  const [text, setText] = useState("");

  async function respond(reviewId: number) {
    await api.post("/sentiment/review-action", {
      store_id: storeId,
      review_id: reviewId,
      action: "respond",
      response_text: text,
    });
    setDrafting(null);
    setText("");
    qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
  }

  async function act(reviewId: number, action: "flag" | "resolve") {
    await api.post("/sentiment/review-action", {
      store_id: storeId,
      review_id: reviewId,
      action,
    });
    qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
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
              render: (r) =>
                drafting === r.review_id ? (
                  <div className="flex gap-1">
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="w-40 rounded border px-1 py-0.5 text-xs"
                      placeholder="response…"
                    />
                    <button
                      onClick={() => respond(r.review_id)}
                      className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs text-white"
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDrafting(r.review_id)}
                      className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs text-white"
                    >
                      Respond
                    </button>
                    <button
                      onClick={() => act(r.review_id, "flag")}
                      className="rounded-md bg-[color:var(--color-warning)] px-2 py-1 text-xs text-white"
                    >
                      Flag
                    </button>
                    <button
                      onClick={() => act(r.review_id, "resolve")}
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
    </div>
  );
}
