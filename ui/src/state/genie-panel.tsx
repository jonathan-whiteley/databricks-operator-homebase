// ui/src/state/genie-panel.tsx
//
// React context for the global Genie slide-over. Tracks the open/closed
// state, a single in-memory conversation, and exposes `ask(text)` which
// POSTs to /api/genie/ask. View-specific prompt chips land in Phase 11.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { useLocation } from "react-router-dom";

const TAB_ID_FOR_PATH: Record<string, string> = {
  "/today": "today",
  "/labor": "labor",
  "/inventory": "supply",
  "/equipment": "maintenance",
  "/members": "loyalty",
  "/feedback": "sentiment",
};

export type GenieRole = "user" | "assistant";

export type GenieTable = {
  headers: string[];
  rows: string[][];
  extra_rows: number;
};

export type GenieMsg = {
  id: number;
  role: GenieRole;
  text: string;
  table?: GenieTable;
  loading?: boolean;
  source?: string;
};

type GeniePanelApi = {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  conversation: GenieMsg[];
  ask: (text: string) => Promise<void>;
  busy: boolean;
};

const Ctx = createContext<GeniePanelApi | null>(null);

type AskResponse = {
  answer?: string;
  text?: string;
  table?: GenieTable;
  source?: string;
};

export function GeniePanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<GenieMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const [storeId] = useStoreId();
  const location = useLocation();

  const nextId = useCallback(() => {
    idRef.current += 1;
    return idRef.current;
  }, []);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => setOpen((v) => !v), []);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsg: GenieMsg = { id: nextId(), role: "user", text: trimmed };
      const placeholder: GenieMsg = {
        id: nextId(),
        role: "assistant",
        text: "",
        loading: true,
      };
      setConversation((prev) => [...prev, userMsg, placeholder]);
      setBusy(true);
      try {
        const tabId = TAB_ID_FOR_PATH[location.pathname] ?? "today";
        const { data } = await api.post<AskResponse>("/genie/ask", {
          tab_id: tabId,
          store_id: storeId,
          question: trimmed,
        });
        const answer = data.answer ?? data.text ?? "";
        setConversation((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  loading: false,
                  text: answer,
                  table: data.table,
                  source: data.source,
                }
              : m,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setConversation((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, loading: false, text: `Sorry — ${msg}` }
              : m,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [nextId, storeId, location.pathname],
  );

  const value = useMemo<GeniePanelApi>(
    () => ({ open, openPanel, closePanel, togglePanel, conversation, ask, busy }),
    [open, openPanel, closePanel, togglePanel, conversation, ask, busy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGeniePanel(): GeniePanelApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useGeniePanel must be used inside <GeniePanelProvider>");
  }
  return ctx;
}
