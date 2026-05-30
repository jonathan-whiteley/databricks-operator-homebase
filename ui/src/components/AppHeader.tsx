// ui/src/components/AppHeader.tsx
import { NavLink } from "react-router-dom";

import { theme } from "@/lib/theme";
import { cn } from "@/lib/util";

import { StoreSelector } from "./StoreSelector";

const TABS = [
  { idx: "01", to: "/labor", label: "Labor" },
  { idx: "02", to: "/loyalty", label: "Loyalty" },
  { idx: "03", to: "/supply", label: "Supply Chain" },
  { idx: "04", to: "/sentiment", label: "Sentiment" },
  { idx: "05", to: "/maintenance", label: "Maintenance" },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-hairline)] bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-[color:var(--color-lava)]" />
          <span className="text-base font-bold tracking-tight text-[color:var(--color-ink)]">{theme.wordmark}</span>
          <span className="ml-1 rounded bg-[color:var(--color-cream)] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[color:var(--color-ink-soft)]">{theme.tagline}</span>
        </NavLink>
        <nav className="ml-2 flex items-center gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-[color:var(--color-navy)] text-white"
                    : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)]",
                )
              }
            >
              <span className="font-mono text-[10px] opacity-75">{t.idx}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <StoreSelector />
        </div>
      </div>
    </header>
  );
}
