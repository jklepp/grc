import React from "react";
import { C } from "../../../theme";

// A narrow "narrow this list" dropdown, shared by the Controls table and the
// Findings list so the two filter bars are the same control rather than two
// that drift. Lived in SystemControls until Findings needed it; moved rather
// than copied.
//
// The empty value means "any" and is always the first option, so clearing a
// filter is the same gesture everywhere.
export interface FilterOption { value: string; label: string }

export function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-[11px] font-medium rounded px-1.5 py-1"
        style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
      >
        <option value="">Any</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
