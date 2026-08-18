import React from "react";
import type { ReactNode } from "react";
import { C } from "../../../theme";

export function IdentificationField({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}
