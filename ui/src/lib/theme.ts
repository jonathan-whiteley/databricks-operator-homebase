// ui/src/lib/theme.ts
import { lakehouseMarket } from "./themes/lakehouse-market";

export interface BrandTheme {
  name: string;
  wordmark: string;
  tagline: string;
  poweredBy: string;
  colors: {
    primary: string; primarySoft: string;
    ink: string; inkSoft: string; paper: string; cream: string;
    success: string; warning: string; info: string;
  };
}

export const theme: BrandTheme = lakehouseMarket;
