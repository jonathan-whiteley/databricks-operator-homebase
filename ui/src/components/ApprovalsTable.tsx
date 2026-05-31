// ui/src/components/ApprovalsTable.tsx
//
// Recent-overrides history table. There's no /api/labor/overrides endpoint
// yet, so this renders an empty-state placeholder styled to match the rest
// of the card grid. Once the endpoint ships, swap `rows` to an async query.
import { History } from "lucide-react";

export type ApprovalRow = {
  date: string;
  daypart: string;
  forecast: string;
  approved: string;
  delta: string;
  note: string;
};

const COLUMNS: { key: keyof ApprovalRow; label: string; align?: "left" | "right" }[] = [
  { key: "date", label: "Date" },
  { key: "daypart", label: "Day-part" },
  { key: "forecast", label: "Forecast", align: "right" },
  { key: "approved", label: "Approved", align: "right" },
  { key: "delta", label: "Delta", align: "right" },
  { key: "note", label: "Manager note" },
];

export function ApprovalsTable({ rows = [] as ApprovalRow[] }: { rows?: ApprovalRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white">
      <header className="flex items-center gap-2 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-4 py-3">
        <History className="size-4 text-[color:var(--color-ink-soft)]" />
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">Recent overrides</h3>
        <span className="text-xs text-[color:var(--color-ink-soft)]">· last 14 days</span>
      </header>
      <table className="w-full text-sm">
        <thead className="border-b border-[color:var(--color-hairline)] text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-ink-soft)]">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2 ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-4 py-8 text-center text-xs text-[color:var(--color-ink-soft)]"
              >
                Recent overrides will appear here after you lock your first day-part.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-[color:var(--color-hairline)] last:border-0">
                <td className="px-4 py-2.5 font-mono text-[color:var(--color-ink-soft)]">{r.date}</td>
                <td className="px-4 py-2.5 text-[color:var(--color-ink)]">{r.daypart}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[color:var(--color-ink)]">{r.forecast}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-[color:var(--color-ink)]">
                  {r.approved}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[color:var(--color-lava)]">{r.delta}</td>
                <td className="px-4 py-2.5 text-[color:var(--color-ink-soft)]">{r.note}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
