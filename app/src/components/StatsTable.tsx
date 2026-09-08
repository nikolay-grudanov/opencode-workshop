import type { ReactNode } from "react";
import { C } from "../utils/colors";

/**
 * F-012 polish: shared primitives for the stats panels (RunDetail StatsPanel,
 * ConvoDetail ConvoStatsPanel). One visual language: every section is a ruled
 * table — label left, value right-aligned, rows separated by high-contrast
 * white dividers, no boxed sub-panels.
 */
export const STATS_DIVIDER = "rgba(255,255,255,0.14)";

export function StatsTable({ children }: { children: ReactNode }) {
  return <table className="w-full text-[11px] font-mono border-collapse">{children}</table>;
}

/** Table row carrying the shared divider (omitted on the last row of a section). */
export function StatsRow({ last = false, children }: { last?: boolean; children: ReactNode }) {
  return <tr style={{ borderBottom: last ? undefined : `1px solid ${STATS_DIVIDER}` }}>{children}</tr>;
}

/** Label cell: left-aligned, truncating with hover title. */
export function StatsLabel({ children, title, max = 260 }: { children: ReactNode; title?: string; max?: number }) {
  return <td className="truncate pr-3 py-[5px]" style={{ color: C.fg1, maxWidth: max }} title={title}>{children}</td>;
}

/** Value cell: right-aligned, never wrapping. */
export function StatsValue({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return <td className={`text-right whitespace-nowrap py-[5px] ${className}`} style={{ color: color ?? C.fg2 }}>{children}</td>;
}

/** Section caption between tables; the divider above keeps the ruled look continuous. */
export function StatsCaption({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return (
    <div
      className={`text-[9px] uppercase tracking-wide font-medium ${first ? "pb-1" : "mt-2 pt-2 pb-1"}`}
      style={{ color: C.fg1, borderTop: first ? undefined : `1px solid ${STATS_DIVIDER}` }}
    >
      {children}
    </div>
  );
}
