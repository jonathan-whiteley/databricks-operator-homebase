// ui/src/components/MetricCard.tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/util";

export function MetricCard({
  label, value, sub, accent, icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "lava" | "navy" | "success" | "warning";
  icon?: ReactNode;
}) {
  const accentBar = {
    lava: "bg-[color:var(--color-lava)]",
    navy: "bg-[color:var(--color-navy)]",
    success: "bg-[color:var(--color-success)]",
    warning: "bg-[color:var(--color-warning)]",
  }[accent ?? "navy"];
  return (
    <div className="relative overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white p-4 shadow-sm">
      <div className={cn("absolute left-0 top-0 h-full w-1", accentBar)} />
      <div className="flex items-start justify-between pl-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-soft)]">{label}</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[color:var(--color-ink)]">{value}</div>
          {sub && <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{sub}</div>}
        </div>
        {icon && <div className="text-[color:var(--color-ink-soft)]">{icon}</div>}
      </div>
    </div>
  );
}
