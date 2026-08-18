import React from "react";
import { C } from "../theme";
import { BASIS_META } from "../engine";
import type { Basis } from "../graph/nodes/taxonomy";

// Renders a control/level's basis (measured / assessed / inherited /
// unassessed) using the vocabulary BASIS_META already defines — the
// provenance answer to "how was this scored", shared between GraphExplorer's
// trace view and the control detail drawer so the two don't drift apart.
interface BasisTagProps {
  basis?: Basis | null;
}

export function BasisTag({ basis }: BasisTagProps) {
  if (!basis) return null;
  const meta = BASIS_META[basis];
  const key: "green" | "accent" | "amber" | "na" = basis === "measured" ? "green" : basis === "inherited" ? "accent" : basis === "assessed" ? "amber" : "na";
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      title={meta?.detail}
      style={{ color: key === "na" ? C.muted : C[key], background: key === "na" ? "transparent" : C[`${key}Bg`], border: key === "na" ? `1px solid ${C.border}` : "none" }}
    >
      {meta?.label ?? basis}
    </span>
  );
}
