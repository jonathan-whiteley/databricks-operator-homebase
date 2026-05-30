// ui/src/components/DataTable.tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/util";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function DataTable<T extends object>({
  rows, columns, empty = "No rows.",
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-soft)]">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{ width: c.width }}
                className={cn("px-3 py-2", c.align === "right" && "text-right")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-[color:var(--color-ink-soft)]">{empty}</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-[color:var(--color-hairline)] last:border-0">
                {columns.map((c) => (
                  <td
                    key={String(c.key)}
                    className={cn(
                      "px-3 py-2.5 text-[color:var(--color-ink)]",
                      c.align === "right" && "text-right font-mono",
                    )}
                  >
                    {c.render ? c.render(r) : (r as any)[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
