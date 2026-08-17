import React from "react";
import { C } from "../../../theme";

export function Panel({ children, className = "" }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}
