import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { C } from "../../../theme";

// The column heading used by every data table in the workspace — the Controls
// table it started in, and Findings & CAPs. Shared rather than copied so the
// two tables sort with the same affordance and read as one component
// (CONTRACT 1.2/1.4).
//
// `first` drops the divider on the leading column: the table's own left edge
// is already there.
export interface TableSortState<K extends string> { key: K; dir: "asc" | "desc" }

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <ChevronsUpDown size={11} style={{ opacity: 0.5 }} />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

export function TableHeaderCell<K extends string>({ label, sortKey, sort, onSort, first = false }: {
  label: ReactNode;
  sortKey?: K;
  sort?: TableSortState<K> | null;
  onSort?: (key: K) => void;
  first?: boolean;
}) {
  const style: CSSProperties = { borderLeft: first ? "none" : `1px solid ${C.border}`, paddingLeft: first ? 0 : 12, color: C.muted };
  if (sortKey == null) {
    return <div style={style}>{label}</div>;
  }
  const active = sort?.key === sortKey;
  return (
    <button
      onClick={() => onSort?.(sortKey)}
      className="flex items-center gap-1 text-left"
      style={{ ...style, color: active ? C.ink : C.muted }}
    >
      {label} <SortIcon dir={active ? sort.dir : null} />
    </button>
  );
}
