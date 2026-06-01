// ui/src/components/db/ToastRegion.tsx
//
// Global toast container. Same surface API as the old Toast.tsx
// (`useToast().success / .error`) — but renders dark navy toasts in the
// bottom-right corner per the Claude Design shell. 3.4s auto-dismiss.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import Icon from "./Icon";

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

const AUTO_DISMISS_MS = 3400;

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
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 200,
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} />
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

function ToastCard({ item }: { item: ToastItem }) {
  const ok = item.kind === "success";
  return (
    <div
      className="hb-toast"
      role={ok ? "status" : "alert"}
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: "var(--db-navy-800)",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        minWidth: 280,
        maxWidth: 380,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: ok ? "var(--db-green-600)" : "var(--db-lava-600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={ok ? "check" : "alert"} size={13} color="#fff" stroke={2.4} />
      </span>
      <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{item.message}</span>
    </div>
  );
}
