// ui/src/components/ConfirmDialog.tsx
//
// Reusable centered modal for confirming write actions. Renders a backdrop,
// a summary table of `details`, an optional manager-note textarea, and a
// Cancel / Approve & save button pair. The confirm button shows a spinner
// while `onConfirm` is in flight and the whole dialog is disabled while
// saving so the user can't double-submit.
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/util";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  details?: { label: string; value: string }[];
  noteLabel?: string;
  notePlaceholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void> | void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  noteLabel = "Manager note (optional)",
  notePlaceholder,
  confirmLabel = "Approve & save",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the note + saving state any time the dialog (re)opens. This avoids
  // a stale note from a previous action leaking into the next one.
  useEffect(() => {
    if (open) {
      setNote("");
      setSaving(false);
    }
  }, [open]);

  // Close on ESC. Only bind when open so we don't intercept ESC globally.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(note);
    } finally {
      // The parent typically closes the dialog on success — if it doesn't,
      // at least drop the saving flag so the user can retry.
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-lg bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-[color:var(--color-ink)]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">{description}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="-mr-1 -mt-1 rounded-md p-1 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-cream)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {details && details.length > 0 && (
            <div className="overflow-hidden rounded-md border border-[color:var(--color-hairline)]">
              <table className="w-full text-sm">
                <tbody>
                  {details.map((d, i) => (
                    <tr
                      key={i}
                      className="border-b border-[color:var(--color-hairline)] last:border-0"
                    >
                      <th className="w-[40%] bg-[color:var(--color-cream)] px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                        {d.label}
                      </th>
                      <td className="px-3 py-2 font-mono text-xs text-[color:var(--color-ink)]">
                        {d.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-soft)]">
              {noteLabel}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              rows={3}
              placeholder={notePlaceholder}
              className="w-full resize-none rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-2 text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-lava)] disabled:bg-[color:var(--color-cream)] disabled:opacity-70"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-5 py-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-cream)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-lava)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90",
              saving && "opacity-80",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                Saving…
              </>
            ) : (
              <>
                <Check className="size-3.5" strokeWidth={3} />
                {confirmLabel}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
