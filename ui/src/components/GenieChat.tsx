// ui/src/components/GenieChat.tsx
import { Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import { useStoreId } from "@/state/store";

type TabId = "labor" | "loyalty" | "supply" | "sentiment" | "maintenance";

const INTROS: Record<TabId, string> = {
  labor: "Ask about labor at your store.",
  loyalty: "Ask about your members.",
  supply: "Ask about inventory and suppliers.",
  sentiment: "Ask about your reviews.",
  maintenance: "Ask about your equipment.",
};

type Msg = { who: "user" | "genie"; text: string };

export function GenieChat({ tabId, chips }: { tabId: TabId; chips: string[] }) {
  const [storeId] = useStoreId();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    setMsgs((m) => [...m, { who: "user", text: q }]);
    setBusy(true);
    try {
      const r = await api.post("/genie/ask", { tab_id: tabId, store_id: storeId, question: q });
      setMsgs((m) => [...m, { who: "genie", text: r.data.text }]);
    } catch {
      setMsgs((m) => [...m, { who: "genie", text: "Sorry, something went wrong asking Genie." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-lg border border-[color:var(--color-hairline)] bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-[color:var(--color-hairline)] px-4 py-3">
        <Sparkles className="size-4 text-[color:var(--color-lava)]" />
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">Ask Genie</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">live on Databricks</span>
      </header>
      <div className="space-y-2 px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
        <p>{INTROS[tabId]}</p>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => ask(c)}
              className="rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-2.5 py-1 text-xs text-[color:var(--color-ink)] hover:border-[color:var(--color-lava)]"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[color:var(--color-hairline)] px-4 py-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.who === "user" ? "text-right" : ""}>
            <span
              className={
                m.who === "user"
                  ? "inline-block rounded-lg bg-[color:var(--color-navy)] px-3 py-1.5 text-sm text-white"
                  : "inline-block rounded-lg bg-[color:var(--color-cream)] px-3 py-1.5 text-sm text-[color:var(--color-ink)]"
              }
            >
              {m.text}
            </span>
          </div>
        ))}
        {busy && <div className="text-xs text-[color:var(--color-ink-soft)]">Thinking…</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            ask(input);
            setInput("");
          }
        }}
        className="flex gap-2 border-t border-[color:var(--color-hairline)] p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a question…"
          className="flex-1 rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-[color:var(--color-lava)] px-3 py-1.5 text-white">
          <Send className="size-4" />
        </button>
      </form>
    </aside>
  );
}
