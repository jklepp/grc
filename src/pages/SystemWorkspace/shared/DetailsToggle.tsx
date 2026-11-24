import React from "react";
import { ChevronDown } from "lucide-react";
import { C } from "../../../theme";

// Show/hide control for a Panel's detail body, sized to sit in a
// SectionHeader's `aside` slot.
export function DetailsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md"
      style={{ color: C.muted, padding: "4px 8px", border: `1px solid ${C.border}` }}
    >
      {open ? "Hide details" : "Details"}
      <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
    </button>
  );
}
