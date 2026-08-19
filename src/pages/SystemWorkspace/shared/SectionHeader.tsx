import React from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../../theme";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
  className?: string;
}

// Shared System-workspace subsection title. Keep the icon, title, supporting
// sentence, spacing, and optional right-side status aligned across every tab.
export function SectionHeader({ icon: Icon, title, description, aside, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-4 ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon size={16} className="mt-0.5 shrink-0" color={C.accent} />
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{title}</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{description}</div>
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
