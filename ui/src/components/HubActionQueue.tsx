// ui/src/components/HubActionQueue.tsx
import { Link } from "react-router-dom";

type Item = { tab: string; tabLabel: string; title: string; subtitle: string; to: string };

export function HubActionQueue({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-[color:var(--color-hairline)] rounded-lg border border-[color:var(--color-hairline)] bg-white">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <span className="rounded bg-[color:var(--color-cream)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">{it.tabLabel}</span>
          <div className="flex-1">
            <div className="font-medium text-[color:var(--color-ink)]">{it.title}</div>
            <div className="text-sm text-[color:var(--color-ink-soft)]">{it.subtitle}</div>
          </div>
          <Link to={it.to} className="rounded-md bg-[color:var(--color-lava)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Open</Link>
        </li>
      ))}
    </ul>
  );
}
