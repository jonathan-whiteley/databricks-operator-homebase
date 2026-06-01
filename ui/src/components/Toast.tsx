// ui/src/components/Toast.tsx
//
// Global toast container with stack semantics. Wrap the app once in
// <ToastProvider>; any component can then call useToast().success(msg)
// or .error(msg). Toasts auto-dismiss after 4s and stack bottom-right.
import { Check, X, AlertCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/util";

type ToastKind = "success" | "error";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // next-tick to trigger the enter transition
    const t = window.setTimeout(() => setEntered(true), 10);
    return () => window.clearTimeout(t);
  }, []);

  const isSuccess = item.kind === "success";
  const Icon = isSuccess ? Check : AlertCircle;

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-md bg-white p-3 pl-4 shadow-md transition-all duration-200",
        "border border-[color:var(--color-hairline)]",
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      role={isSuccess ? "status" : "alert"}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isSuccess ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-lava)]",
        )}
      />
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-white",
          isSuccess ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-lava)]",
        )}
      >
        <Icon className="size-4" strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1 text-sm text-[color:var(--color-ink)]">{item.message}</div>
      <button
        onClick={onDismiss}
        className="-mr-1 -mt-1 rounded p-0.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-cream)]"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
