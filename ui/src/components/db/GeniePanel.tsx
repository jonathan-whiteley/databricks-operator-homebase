// ui/src/components/db/GeniePanel.tsx
//
// Right-side slide-over for Ask Genie. 440px wide; navy-900 header, oat
// body. Reads conversation + ask() from <GeniePanelProvider>. View-specific
// prompt chips land in Phase 11 — for now we expose a single generic set.
import { useEffect, useRef, useState } from "react";

import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { useGeniePanel } from "@/state/genie-panel";

import Btn from "./Btn";
import Icon from "./Icon";

const SUGGESTIONS = [
  "What should I prep extra of today?",
  "Why is labor down vs last week?",
  "What's wrong with the walk-in cooler?",
  "Which members should I win back?",
];

type Store = { store_id: number; store_name: string; city: string; state: string };

export default function GeniePanel() {
  const { open, closePanel, conversation, ask, busy, resetConversation } = useGeniePanel();
  const [storeId] = useStoreId();
  const { data: stores } = useApi<Store[]>(["stores"], "/stores");
  const num = `#${String(storeId).padStart(3, "0")}`;
  const store = stores?.find((s) => s.store_id === storeId);
  const grounded = store ? `${num} · ${store.city}` : num;

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, open]);

  const submit = (text?: string) => {
    const v = (text ?? draft).trim();
    if (!v) return;
    void ask(v);
    setDraft("");
  };

  return (
    <>
      <div
        onClick={closePanel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11,32,38,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity var(--dur-base) var(--ease-out)",
          zIndex: 140,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: "var(--db-oat-light)",
          boxShadow: "var(--shadow-xl)",
          zIndex: 150,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform var(--dur-slow) var(--ease-out)",
        }}
        aria-hidden={!open}
      >
        {/* header */}
        <div
          style={{
            background: "var(--db-navy-900)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 11,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--db-lava-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="spark" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "#fff" }}>
              Ask Genie
            </div>
            <div style={{ fontSize: 11.5, color: "var(--db-navy-400)" }}>
              Genie · grounded in {grounded} data
            </div>
          </div>
          {conversation.length > 0 && (
            <button
              type="button"
              onClick={resetConversation}
              disabled={busy}
              aria-label="Start new chat"
              title="New chat"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 28,
                padding: "0 11px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "transparent",
                color: "#fff",
                fontSize: 12,
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1,
                fontFamily: "var(--font-sans)",
              }}
            >
              <Icon name="plus" size={12} color="#fff" />
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={closePanel}
            className="hb-iconbtn"
            aria-label="Close Genie"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              display: "flex",
              padding: 6,
            }}
          >
            <Icon name="x" size={18} color="var(--db-navy-300)" />
          </button>
        </div>

        {/* messages */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: "auto", padding: 20 }}
        >
          {conversation.map((msg) =>
            msg.role === "user" ? (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: "var(--db-navy-800)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: "12px 12px 3px 12px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    maxWidth: 300,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={msg.id} style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: "var(--db-lava-600)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Icon name="spark" size={14} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid var(--db-gray-lines)",
                      borderRadius: "3px 12px 12px 12px",
                      padding: "12px 14px",
                    }}
                  >
                    {msg.loading ? (
                      <span
                        className="hb-dots"
                        style={{
                          color: "var(--db-navy-400)",
                          fontSize: 18,
                          letterSpacing: 2,
                        }}
                      >
                        •••
                      </span>
                    ) : (
                      <>
                        {msg.text && (
                          <div
                            style={{
                              fontSize: 13.5,
                              lineHeight: 1.55,
                              color: "var(--db-navy-800)",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {msg.text}
                          </div>
                        )}
                        {msg.table && msg.table.rows.length > 0 && (
                          <div
                            style={{
                              marginTop: msg.text ? 10 : 0,
                              borderRadius: 8,
                              border: "1px solid var(--db-gray-lines)",
                              overflow: "hidden",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11.5,
                            }}
                          >
                            <div style={{ overflowX: "auto" }}>
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  background: "#fff",
                                }}
                              >
                                <thead>
                                  <tr style={{ background: "var(--db-oat-light)" }}>
                                    {msg.table.headers.map((h) => (
                                      <th
                                        key={h}
                                        style={{
                                          textAlign: "left",
                                          padding: "6px 10px",
                                          fontWeight: 600,
                                          color: "var(--db-navy-800)",
                                          borderBottom: "1px solid var(--db-gray-lines)",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {msg.table.rows.map((row, ri) => (
                                    <tr
                                      key={ri}
                                      style={{
                                        borderTop:
                                          ri === 0 ? "none" : "1px solid var(--db-gray-lines)",
                                      }}
                                    >
                                      {row.map((cell, ci) => (
                                        <td
                                          key={ci}
                                          style={{
                                            padding: "6px 10px",
                                            color: "var(--db-navy-800)",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {msg.table.extra_rows > 0 && (
                              <div
                                style={{
                                  padding: "6px 10px",
                                  background: "var(--db-oat-light)",
                                  borderTop: "1px solid var(--db-gray-lines)",
                                  color: "var(--db-navy-400)",
                                  fontSize: 11,
                                }}
                              >
                                … {msg.table.extra_rows} more rows
                              </div>
                            )}
                          </div>
                        )}
                        {msg.source && (
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 10.5,
                              fontFamily: "var(--font-mono)",
                              color: "var(--db-navy-400)",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Icon name="inventory" size={12} color="var(--db-navy-400)" />
                            {msg.source}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}

          {/* suggestions — shown when conversation is empty */}
          {conversation.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="hb-suggest"
                  style={{
                    textAlign: "left",
                    background: "#fff",
                    border: "1px solid var(--db-gray-lines)",
                    borderRadius: 10,
                    padding: "10px 13px",
                    fontSize: 13,
                    color: "var(--db-navy-800)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <Icon name="spark" size={14} color="var(--db-lava-600)" /> {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* input */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--db-gray-lines)",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--db-oat-light)",
              border: "1px solid var(--db-gray-lines)",
              borderRadius: 10,
              padding: "5px 5px 5px 14px",
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) submit();
              }}
              placeholder="Ask about your store…"
              disabled={busy}
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                background: "transparent",
                font: "400 14px/1.4 var(--font-sans)",
                color: "var(--db-navy-800)",
              }}
            />
            <Btn
              variant="primary"
              size="sm"
              onClick={() => submit()}
              disabled={busy || !draft.trim()}
              style={{ padding: "8px 11px" }}
            >
              <Icon name="send" size={15} color="#fff" />
            </Btn>
          </div>
        </div>
      </aside>
    </>
  );
}
