// ui/src/components/db/index.ts
//
// Barrel for the Databricks design primitives ported from the Claude Design
// shell. Each primitive lives in its own file with a default export; this
// file re-exports them as named bindings for convenient imports.
export { default as Icon, PATHS } from "./Icon";
export type { IconName } from "./Icon";
export { default as Spark } from "./Spark";
export { default as Btn } from "./Btn";
export type { BtnVariant, BtnSize } from "./Btn";
export { default as Pill, LEVEL } from "./Pill";
export type { PillLevel } from "./Pill";
export { default as Card } from "./Card";
export { default as Delta } from "./Delta";
export { default as Eyebrow } from "./Eyebrow";
export { default as PageHead } from "./PageHead";
export { default as AIRec } from "./AIRec";
export { default as LakebaseTag } from "./LakebaseTag";
export { default as Logo } from "./Logo";
export { default as Sidebar } from "./Sidebar";
export { default as TopBar } from "./TopBar";
export { default as GeniePanel } from "./GeniePanel";
export { ToastProvider, useToast } from "./ToastRegion";
export { TourButton, TourOverlay } from "./TourButton";
export { default as DayPartPlannerCard, staffingFor } from "./DayPartPlannerCard";
export type { DaypartId, DayPartPlannerCardProps } from "./DayPartPlannerCard";
