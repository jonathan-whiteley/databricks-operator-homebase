// ui/src/App.tsx
//
// New shell layout (Phase 3): sidebar + top-bar + main outlet + global
// Genie slide-over + dark toast region. Routes are the design's renamed
// six (today / labor / inventory / equipment / members / feedback) with
// redirects from the legacy paths.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { GeniePanel, Sidebar, ToastProvider, TopBar } from "./components/db";
import { GeniePanelProvider } from "./state/genie-panel";

// HubPage is preserved on disk during the Phase 5 transition but no longer
// mounted on `/today` — TodayView is the new home. LoyaltyPage similarly
// stays on disk through Phase 9 but is no longer mounted — MembersView
// is the new `/members` home.
const TodayView = lazy(() => import("./pages/TodayView"));
const LaborView = lazy(() => import("./pages/LaborView"));
const InventoryView = lazy(() => import("./pages/InventoryView"));
const EquipmentView = lazy(() => import("./pages/EquipmentView"));
const MembersView = lazy(() => import("./pages/MembersView"));
const FeedbackView = lazy(() => import("./pages/FeedbackView"));

export function App() {
  return (
    <ToastProvider>
      <GeniePanelProvider>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            background: "var(--bg)",
            color: "var(--fg-1)",
          }}
        >
          <Sidebar />
          <main
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <TopBar />
            <div style={{ flex: 1, padding: "28px 32px" }}>
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: "48px 0",
                      textAlign: "center",
                      color: "var(--fg-2)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <Routes>
                  {/* New canonical paths */}
                  <Route path="/" element={<Navigate to="/today" replace />} />
                  <Route path="/today" element={<TodayView />} />
                  <Route path="/labor" element={<LaborView />} />
                  <Route path="/inventory" element={<InventoryView />} />
                  <Route path="/equipment" element={<EquipmentView />} />
                  <Route path="/members" element={<MembersView />} />
                  <Route path="/feedback" element={<FeedbackView />} />

                  {/* Legacy redirects */}
                  <Route path="/loyalty" element={<Navigate to="/members" replace />} />
                  <Route path="/supply" element={<Navigate to="/inventory" replace />} />
                  <Route path="/sentiment" element={<Navigate to="/feedback" replace />} />
                  <Route
                    path="/maintenance"
                    element={<Navigate to="/equipment" replace />}
                  />
                </Routes>
              </Suspense>
            </div>
          </main>
          <GeniePanel />
        </div>
      </GeniePanelProvider>
    </ToastProvider>
  );
}
