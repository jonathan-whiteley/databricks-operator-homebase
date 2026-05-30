// ui/src/App.tsx
import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";

const HubPage = lazy(() => import("./pages/HubPage"));
const LaborPage = lazy(() => import("./pages/LaborPage"));
const LoyaltyPage = lazy(() => import("./pages/LoyaltyPage"));
const SupplyPage = lazy(() => import("./pages/SupplyPage"));
const SentimentPage = lazy(() => import("./pages/SentimentPage"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));

export function App() {
  return (
    <div className="min-h-screen bg-[color:var(--color-cream)]">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Suspense fallback={<div className="py-12 text-center text-[color:var(--color-ink-soft)]">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/labor" element={<LaborPage />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/supply" element={<SupplyPage />} />
            <Route path="/sentiment" element={<SentimentPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}
