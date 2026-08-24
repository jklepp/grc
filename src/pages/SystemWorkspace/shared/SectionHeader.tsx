import React from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../../theme";

interface SectionHeaderProps {
  icon?: LucideIcon;
  /** Omitted when the workspace tab already names this section — the sentence and
      the status then stand alone rather than repeating the tab's own label.
      Tabs that hold several sections title each one (Overview's "System
      Posture", Testing's "Vulnerability Scanning"); a tab whose whole body is
      one section does not. */
  title?: string;
  description: string;
  aside?: ReactNode;
  className?: string;
}

// Shared System-workspace subsection title. Keep the icon, title, supporting
// sentence, spacing, and optional right-side status aligned across every tab.
//
// One shape, set by Overview and followed by every tab: the body is a stack of
// Panels at `px-8 pb-10 space-y-8`, and a section's header lives INSIDE its
// Panel as the first child. A header floating on the page background above a
// row of cards is the thing this replaced — it read as a second page title
// under the tab that had already named the page.
//
// Architecture and Assets are the two exceptions: their body is one full-width
// surface (the canvas, the register) that cannot sit inside a padded Panel, so
// there the header stays in a `px-8` block above it.
export function SectionHeader({ icon: Icon, title, description, aside, className = "" }: SectionHeaderProps) {
  if (!title) {
    return (
      <div className={`flex items-start justify-between gap-4 mb-3.5 ${className}`}>
        <div className="text-xs leading-relaxed min-w-0" style={{ color: C.muted }}>{description}</div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-between gap-4 mb-4 ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && <Icon size={16} className="mt-0.5 shrink-0" color={C.accent} />}
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{title}</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{description}</div>
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
