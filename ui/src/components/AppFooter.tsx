// ui/src/components/AppFooter.tsx
import { Flame } from "lucide-react";

import { theme } from "@/lib/theme";

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-[color:var(--color-hairline)] bg-white">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-6 text-xs text-[color:var(--color-ink-soft)]">
        <div>© {new Date().getFullYear()} {theme.wordmark}</div>
        <div className="flex items-center gap-1.5">
          <Flame className="size-3.5" style={{ color: theme.colors.primary }} />
          <span>{theme.poweredBy} · Lakebase + Genie + Model Serving</span>
        </div>
      </div>
    </footer>
  );
}
