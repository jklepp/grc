import React from "react";
import type { ReactNode } from "react";
import { C } from "../../../theme";

// A card nested inside a Panel. Panels sit on the page; a SubCard sits on a
// Panel, so it drops the border and steps the background instead — two
// bordered cards of the same colour inside one another read as a mistake.
export function SubCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg p-4 ${className}`} style={{ background: C.panel2 }}>
      {children}
    </div>
  );
}
