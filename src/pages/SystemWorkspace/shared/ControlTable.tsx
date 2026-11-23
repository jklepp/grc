import React from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { C } from "../../../theme";

// The pieces every controls table is built from — the HITRUST Controls tab,
// the framework-baseline Controls tab, and an audit's Controls tab — so the
// three read as one component with different columns rather than three
// tables that drift (CONTRACT 1.2/1.4). Column headings are TableHeaderCell;
// filter dropdowns are FilterSelect; everything else is here.

export const CELL = "py-2.5";
/** A function, not a constant: C is re-themed in place. */
export const cellDivider = () => ({ borderBottom: `1px solid ${C.border}` });

/** The square-cornered, icon-led status chip every controls table uses. */
export function Badge({ meta, title }: { meta: { label: string; Icon?: LucideIcon; color: string; bg: string }; title?: string }) {
  const Icon = meta.Icon;
  return (
    <span title={title} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap" style={{ background: meta.bg, color: meta.color }}>
      {Icon && <Icon size={11} />} {meta.label}
    </span>
  );
}

/** Card shell: title and count on the left, an action on the right, a filter band, then the table. */
export function TableCard({ title, count, noun = "control", action, band, children, maxHeight = true }: {
  title: ReactNode;
  count: number;
  noun?: string;
  action?: ReactNode;
  band?: ReactNode;
  children: ReactNode;
  /** Cap the table at 480px on desktop and scroll inside it, as the HITRUST tab always has. */
  maxHeight?: boolean;
}) {
  return (
    <div className="rounded-xl overflow-hidden min-w-0" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{count} {noun}{count !== 1 ? "s" : ""}</div>
        </div>
        {action}
      </div>
      {band}
      <div className={`overflow-auto ${maxHeight ? "lg:max-h-[560px]" : ""}`}>{children}</div>
    </div>
  );
}

/** The quiet action a card header carries, e.g. "View all applicable controls". */
export function CardAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs px-2 py-1 rounded font-medium shrink-0" style={{ background: C.panel2, color: C.muted }}>
      {children}
    </button>
  );
}

/** The grey band of filters directly under a card header. */
export function FilterBand({ children, onClear, trailing }: { children: ReactNode; onClear?: (() => void) | null; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 flex-wrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
      {children}
      {(onClear || trailing) && (
        <div className="ml-auto flex items-center gap-3">
          {trailing}
          {onClear && <button type="button" onClick={onClear} className="text-[11px] font-medium" style={{ color: C.accent }}>Clear filters</button>}
        </div>
      )}
    </div>
  );
}

/** A search box sized and styled like FilterSelect, for the same band. */
export function SearchFilter({ value, onChange, placeholder = "Search controls" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex items-center gap-1.5 rounded px-1.5 py-1" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <Search size={11} color={C.muted} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-transparent text-[11px] font-medium outline-none w-40" style={{ color: C.ink }} />
    </label>
  );
}

/** A checkbox filter, styled like FilterSelect's label. */
export function CheckFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
