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
// dark-theme TB.* constants. Clicking "Details" opens the group's own landing
// page rather than only unfurling the menu — the same split TopNav uses,
// where the label goes somewhere and the dropdown skips ahead.
// The row sits inside SystemHeader's identity band and has no rule of its own:
// the band's bottom border is the line these chips sit on.
// One row of the Details menu — the group's landing page and each of its areas
// are the same kind of destination, so they are drawn the same way.
function DetailsMenuRow({ tab, isActive, onClick }: { tab: Tab; isActive: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-95"
      style={{ background: isActive ? C.accentBg : "transparent" }}
    >
      {Icon && <Icon size={14} color={isActive ? C.accent : C.muted} />}
      <span className="text-[13px]" style={{ color: isActive ? C.accent : C.ink }}>{tab.label}</span>
    </button>
  );
}

// One tab chip. Extracted so the inline row and the unfolded group below
// `lg` cannot drift into two slightly different chips.
function TabChip({ tab, isActive, onClick }: { tab: Tab; isActive: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium transition-colors"
      style={{ color: isActive ? "#fff" : C.muted, background: isActive ? C.accentStrong : "transparent" }}
    >
      {Icon && <Icon size={13} />}
      {tab.label}
    </button>
  );
}

export function WorkspaceTabBar({ tabs, active, onChange }: { tabs: readonly Tab[]; active: SystemWorkspaceTab; onChange: (id: SystemWorkspaceTab) => void }) {
  const primaryTabs = tabs.filter((t) => t.group === "primary");
  const detailsTabs = tabs.filter((t) => t.group === "details");
  const detailsHome = tabs.find((t) => t.group === "details-home");
  const detailsActive = active === detailsHome?.id || detailsTabs.some((t) => t.id === active);

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
    <div className="px-4 lg:px-8 pt-2">
      <div className="flex items-center gap-1 flex-wrap">
        {primaryTabs.map((t) => (
          <TabChip key={t.id} tab={t} isActive={active === t.id} onClick={() => onChange(t.id)} />
        ))}

        {/* Below `lg` the group unfolds into ordinary chips. The dropdown it
            stands in for opens on hover only, so on a touch screen these six
            tabs had no route at all: tapping "Details" navigates to the
            group's landing page, which does not list them, and the menu never
            appears. `contents` drops the chips straight into the flex row so
            they wrap alongside the primary tabs rather than forming a block. */}
        <div className="contents lg:hidden">
          {detailsHome && (
            <TabChip tab={detailsHome} isActive={active === detailsHome.id} onClick={() => onChange(detailsHome.id)} />
          )}
          {detailsTabs.map((t) => (
            <TabChip key={t.id} tab={t} isActive={active === t.id} onClick={() => onChange(t.id)} />
          ))}
        </div>

        <div className="hidden lg:block relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
          <button
            onClick={() => { if (detailsHome) { cancelClose(); setOpen(false); onChange(detailsHome.id); } else setOpen(true); }}
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
              {/* The group's own landing page leads its menu. Clicking "Details" still
                  opens it, but a page reachable only by clicking the button that also
                  unfurls a menu is a page nobody finds. */}
              {detailsHome && (
                <>
                  <DetailsMenuRow tab={detailsHome} isActive={active === detailsHome.id} onClick={() => { cancelClose(); setOpen(false); onChange(detailsHome.id); }} />
                  <div className="my-1 mx-1" style={{ borderTop: `1px solid ${C.border}` }} />
                </>
              )}
              {detailsTabs.map((t) => (
                <DetailsMenuRow key={t.id} tab={t} isActive={active === t.id} onClick={() => { cancelClose(); setOpen(false); onChange(t.id); }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
