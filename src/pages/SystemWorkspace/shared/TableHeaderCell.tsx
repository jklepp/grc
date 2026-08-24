import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { C } from "../../../theme";

// The column heading used by every data table in the workspace — the Controls
// table it started in, and the Actions table. Shared rather than copied so the
// two tables sort with the same affordance and read as one component
// (CONTRACT 1.2/1.4).
//
// Renders the <th> itself: both tables are semantic tables now, matching the
// System picker's, and a heading that returned a bare div could not sit inside
// one. `first`/`last` carry the table's outer padding on the edge columns;
// `align: "right"` belongs on the columns whose cells are right-aligned
// tabular numbers, so heading and figure share an edge.
export interface TableSortState<K extends string> { key: K; dir: "asc" | "desc" }

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <ChevronsUpDown size={11} style={{ opacity: 0.5 }} />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

export function TableHeaderCell<K extends string>({
  label, sortKey, sort, onSort, first = false, last = false, align = "left", width,
}: {
  label: ReactNode;
  sortKey?: K;
  sort?: TableSortState<K> | null;
  onSort?: (key: K) => void;
  first?: boolean;
  last?: boolean;
  align?: "left" | "right";
  width?: number;
}) {
  const active = sortKey != null && sort?.key === sortKey;
  const style: CSSProperties = {
    color: active ? C.ink : C.muted,
    background: C.panel2,
    borderBottom: `1px solid ${C.border}`,
    width,
  };
  const cls = [
    first ? "pl-4" : "pl-3",
    last ? "pr-4" : "pr-3",
    "py-2 font-semibold whitespace-nowrap",
    align === "right" ? "text-right" : "",
  ].join(" ");

  if (sortKey == null) return <th className={cls} style={style}>{label}</th>;
  return (
    <th className={cls} style={style}>
      <button onClick={() => onSort?.(sortKey)} className="inline-flex items-center gap-1" style={{ color: "inherit" }}>
        {label} <SortIcon dir={active && sort ? sort.dir : null} />
      </button>
    </th>
  );
}
