// ui/src/components/Toast.tsx
//
// Backwards-compatible re-export shim. The real implementation now lives in
// `components/db/ToastRegion.tsx`. Phase 12 will delete this file once all
// imports have been migrated.
export { ToastProvider, useToast } from "@/components/db/ToastRegion";
