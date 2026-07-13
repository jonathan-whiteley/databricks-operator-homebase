// ui/src/App.tsx
//
// New shell layout (Phase 3): sidebar + top-bar + main outlet + global
// Genie slide-over + dark toast region. Routes are the design's renamed
// six (today / labor / inventory / equipment / members / feedback) with
// redirects from the legacy paths.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import {
  GeniePanel,
  Sidebar,
  ToastProvider,
  TopBar,
  TourCursor,
  TourOverlay,
} from "./components/db";
import { GeniePanelProvider } from "./state/genie-panel";
import { TourProvider } from "./state/tour-mode";

// HubPage is preserved on disk during the Phase 5 transition but no longer
// mounted on `/today` — TodayView is the new home. LoyaltyPage similarly
// stays on disk through Phase 9 but is no longer mounted — MembersView
// is the new `/members` home.
const AppsLanding = lazy(() => import("./pages/AppsLanding"));
const TodayView = lazy(() => import("./pages/TodayView"));
const LaborView = lazy(() => import("./pages/LaborView"));
const InventoryView = lazy(() => import("./pages/InventoryView"));
const EquipmentView = lazy(() => import("./pages/EquipmentView"));
const MembersView = lazy(() => import("./pages/MembersView"));
const FeedbackView = lazy(() => import("./pages/FeedbackView"));
const TalkTrackView = lazy(() => import("./pages/TalkTrackView"));
const ReferenceDeckView = lazy(() => import("./pages/ReferenceDeckView"));
const ArchitectureView = lazy(() => import("./pages/ArchitectureView"));

export function App() {
  return (
    <ToastProvider>
      <GeniePanelProvider>
        <TourProvider>
          <Shell />
        </TourProvider>
      </GeniePanelProvider>
    </ToastProvider>
  );
}

function Shell() {
  const location = useLocation();
  // /apps is the DAIS booth launcher — full-bleed navy hero; hide the
  // store/clock/Genie TopBar to keep the moment clean.
  const isLanding = location.pathname === "/apps";
  return (
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
        {!isLanding && <TopBar />}
        <div
          style={
            isLanding
              ? {
                  // /apps is a full-bleed navy hero: kill the page padding
                  // and switch to a column flex so AppsLanding can fill the
                  // remaining viewport edge-to-edge.
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }
              : { flex: 1, padding: "28px 32px" }
          }
        >
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
              {/* / lands on the Today operations view (Apps tab retired) */}
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/apps" element={<AppsLanding />} />
              <Route path="/today" element={<TodayView />} />
                  <Route path="/labor" element={<LaborView />} />
                  <Route path="/inventory" element={<InventoryView />} />
                  <Route path="/equipment" element={<EquipmentView />} />
                  <Route path="/members" element={<MembersView />} />
                  <Route path="/feedback" element={<FeedbackView />} />

                  {/* Reference */}
                  <Route path="/reference/talk-track" element={<TalkTrackView />} />
                  <Route path="/reference/deck" element={<ReferenceDeckView />} />
                  <Route
                    path="/reference/architecture"
                    element={<ArchitectureView />}
                  />

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
      <TourCursor />
      <TourOverlay />
    </div>
  );
}
