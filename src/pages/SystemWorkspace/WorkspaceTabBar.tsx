import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { C } from "../../theme";
import type { SUB_TABS, SystemWorkspaceTab } from "./tabs";

type Tab = (typeof SUB_TABS)[number];

// Same visual language as Headings.tsx's TabBar variant="secondary" (this
// page's one live consumer of that variant), plus one appended "Details"
// button that folds the details-group tabs into a hover/click dropdown —
// modeled on TopNav.tsx's GroupedNavButton open/close-delay interaction, but
// using this page's light/dark-aware C.* tokens instead of TopNav's fixed
// dark-theme TB.* constants.
export function WorkspaceTabBar({ tabs, active, onChange }: { tabs: readonly Tab[]; active: SystemWorkspaceTab; onChange: (id: SystemWorkspaceTab) => void }) {
  const primaryTabs = tabs.filter((t) => t.group === "primary");
  const detailsTabs = tabs.filter((t) => t.group === "details");
  const detailsActive = detailsTabs.some((t) => t.id === active);

  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }

  return (
    <div className="px-8 pt-6">
      <div className="flex items-center gap-1 flex-wrap" style={{ borderBottom: `1px solid ${C.border}` }}>
        {primaryTabs.map((t) => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors"
              style={{ color: isActive ? "#fff" : C.muted, background: isActive ? C.accentStrong : "transparent" }}
            >
              {Icon && <Icon size={13} />}
              {t.label}
            </button>
          );
        })}

        <div className="relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors"
            style={{ color: detailsActive || open ? "#fff" : C.muted, background: detailsActive || open ? C.accentStrong : "transparent" }}
          >
            Details
            <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
          </button>
          {open && (
            <div
              className="absolute top-full left-0 w-56 p-2 rounded-xl z-20"
              style={{ background: C.panel, border: `1px solid ${C.border}`, boxShadow: "0 16px 32px rgba(0,0,0,0.24)" }}
            >
              {detailsTabs.map((t) => {
                const isActive = active === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => { cancelClose(); setOpen(false); onChange(t.id); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-95"
                    style={{ background: isActive ? C.accentBg : "transparent" }}
                  >
                    {Icon && <Icon size={14} color={isActive ? C.accent : C.muted} />}
                    <span className="text-[13px]" style={{ color: isActive ? C.accent : C.ink }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
