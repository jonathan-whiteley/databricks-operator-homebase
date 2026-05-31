// ui/src/components/HubActionQueue.tsx
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, ListChecks } from "lucide-react";

type Item = { tab: string; tabLabel: string; title: string; subtitle: string; to: string };

const TAB_TINT: Record<string, string> = {
  labor:       "bg-[color:var(--color-lava-soft)] text-[color:var(--color-lava)]",
  loyalty:     "bg-[#FFF4E0] text-[#A06800]",
  supply:      "bg-[#E5F4ED] text-[color:var(--color-success)]",
  sentiment:   "bg-[#E5ECFA] text-[color:var(--color-info)]",
  maintenance: "bg-[#FBEAEC] text-[color:var(--color-rose)]",
};

export function HubActionQueue({ items }: { items: Item[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--color-hairline)] bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-[color:var(--color-lava)]" />
          <h2 className="text-sm font-semibold tracking-tight text-[color:var(--color-ink)]">
            Action queue
          </h2>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-[color:var(--color-cream)]">
            <CheckCircle2 className="size-5 text-[color:var(--color-success)]" />
          </div>
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">
            No urgent items today
          </p>
          <p className="max-w-[24ch] text-xs text-[color:var(--color-ink-soft)]">
            New tickets, reorders, and reviews will surface here as the day unfolds.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {items.map((it, i) => {
            const tint = TAB_TINT[it.tab] ?? "bg-[color:var(--color-cream)] text-[color:var(--color-ink-soft)]";
            return (
              <li key={i} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[color:var(--color-cream)]/60">
                <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tint}`}>
                  {it.tabLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[color:var(--color-ink)]">
                    {it.title}
                  </div>
                  <div className="truncate text-xs text-[color:var(--color-ink-soft)]">
                    {it.subtitle}
                  </div>
                </div>
                <Link
                  to={it.to}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[color:var(--color-lava)] px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  Open <ArrowRight className="size-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
