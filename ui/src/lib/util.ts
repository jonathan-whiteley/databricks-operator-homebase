// ui/src/lib/util.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...x: ClassValue[]) => twMerge(clsx(x));
export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
