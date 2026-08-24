import React, { useRef, useState } from "react";
import { Sun, Moon, LayoutDashboard, Database, Landmark, Share2, ChevronDown, LogOut, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeMode } from "../theme";
import { GOVERNANCE_AREAS } from "../pages/governanceAreas";
import type { GovernanceAreaId } from "../pages/governanceAreas";
import { OVERVIEW_AREAS } from "../pages/overviewAreas";
import type { OverviewAreaId } from "../pages/overviewAreas";
import { ROLE_LABELS, initialsOf } from "../auth/roster";
import type { User } from "../auth/roster";

// Topbar chrome is intentionally fixed dark regardless of the app-wide light/dark
// toggle — it's the "always-on" brand shell, same idea the old Sidebar used.
const TB = {
  bgSolid: "#131217",
  panel: "#1E1D22",
  border: "rgba(255,255,255,0.06)",
  ink: "#F3F1ED",
  muted: "#A39D93",
  accent: "#7A5CC7",
  accentBg: "rgba(122,92,199,0.16)",
  green: "#5FB98A",
};

// Settings is a page but never a nav button: it is admin-only, and a top-level
// item that is missing for four users out of five reads as a broken bar. It is
// reached from the user menu instead, which is where the person it belongs to
// already is.
export type NavigationPageId = "overview" | "data-estate" | "governance" | "graph-explorer" | "settings";

// Governance's sub-areas route through the same legacy ids App.jsx's
// LEGACY_ROUTES already maps to (page: "governance", tab: <area>) — this just
// avoids re-deriving them from the area id text.
const GOVERNANCE_LEGACY_ID: Record<GovernanceAreaId, string> = {
  ccf: "ccf",
  policy: "policy-center",
  procedures: "procedure-library",
  principles: "security-principles",
  schedule: "activity-timeliness",
  exceptions: "exception-register",
};

// Same idea for Overview's sub-areas: the legacy ids App.jsx's LEGACY_ROUTES
// already maps to (page: "overview", tab: <area>).
const OVERVIEW_LEGACY_ID: Record<OverviewAreaId, string> = {
  dashboard: "executive-dashboard",
  "risk-register": "risk-register",
  footprint: "data-footprint",
};

interface NavItem {
  id: NavigationPageId;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { id: "data-estate", label: "Systems", icon: Database },
];

const GRAPH_EXPLORER_ITEM: NavItem = { id: "graph-explorer", label: "Graph Explorer", icon: Share2 };

interface TopNavProps {
  active: NavigationPageId;
  onSelect: (id: string) => void;
  user: User;
  onSignOut: () => void;
  /** Absent when the signed-in user is not an admin; the menu entry is then not drawn. */
  onOpenSettings?: () => void;
  mode: ThemeMode;
  onToggleTheme: () => void;
}

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-16 px-3.5 text-[13.5px] font-medium transition-colors"
      style={{ color: isActive ? TB.ink : TB.muted, borderBottom: `2px solid ${isActive ? TB.accent : "transparent"}` }}
    >
      <Icon size={15} color={isActive ? TB.accent : TB.muted} />
      {item.label}
    </button>
  );
}

// A grouped nav item: clicking the label navigates to the area's landing page
// (same as before); hovering reveals a dropdown that jumps straight into one
// of its areas, skipping the landing page.
function GroupedNavButton({
  id,
  label,
  icon: Icon,
  isActive,
  areas,
  onSelect,
  onSelectArea,
}: {
  id: NavigationPageId;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  areas: { id: string; label: string; icon: LucideIcon }[];
  onSelect: (id: string) => void;
  onSelectArea: (legacyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // A bare mouseleave->setOpen(false) closes the menu the instant the cursor
  // dips off the trigger's own box on its way down to an item below (the item
  // sits outside the trigger's painted area even though it's the same DOM
  // subtree) — that race can unmount the item mid-click and silently eat the
  // click. A short cancellable delay gives the cursor time to land on the
  // panel before it disappears.
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
    <div className="relative h-16" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button
        onClick={() => onSelect(id)}
        className="flex items-center gap-1.5 h-16 px-3.5 text-[13.5px] font-medium transition-colors"
        style={{ color: isActive || open ? TB.ink : TB.muted, background: open ? TB.panel : "transparent", borderBottom: `2px solid ${isActive && !open ? TB.accent : "transparent"}` }}
      >
        <Icon size={15} color={isActive || open ? TB.accent : TB.muted} />
        {label}
        <ChevronDown size={12} color={isActive || open ? TB.ink : TB.muted} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          className="absolute top-16 left-0 w-64 p-2 rounded-xl z-20"
          style={{ background: TB.panel, border: `1px solid ${TB.border}`, boxShadow: "0 16px 32px rgba(0,0,0,0.4)" }}
        >
          {areas.map((area) => {
            const AreaIcon = area.icon;
            return (
              <button
                key={area.id}
                onClick={() => { cancelClose(); setOpen(false); onSelectArea(area.id); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-125"
                style={{ background: "transparent" }}
              >
                <AreaIcon size={16} color={TB.accent} />
                <span className="text-[13px]" style={{ color: TB.ink }}>{area.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopNav({ active, onSelect, user, onSignOut, onOpenSettings, mode, onToggleTheme }: TopNavProps) {
  return (
    <div
      className="w-full h-16 shrink-0 grid items-center gap-4 px-6"
      style={{ background: TB.bgSolid, borderBottom: `1px solid ${TB.border}`, gridTemplateColumns: "1fr auto 1fr" }}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center font-bold text-[13px]" style={{ background: TB.accent, color: TB.bgSolid }}>
          A
        </div>
        <span className="text-sm font-semibold whitespace-nowrap" style={{ color: TB.ink }}>ACME ASSURE</span>
      </div>

      <div className="flex items-center h-16">
        <GroupedNavButton
          id="overview"
          label="Overview"
          icon={LayoutDashboard}
          isActive={active === "overview"}
          areas={OVERVIEW_AREAS.map((a) => ({ id: OVERVIEW_LEGACY_ID[a.id], label: a.label, icon: a.icon }))}
          onSelect={onSelect}
          onSelectArea={onSelect}
        />
        <NavButton item={ITEMS[0]} isActive={active === "data-estate"} onClick={() => onSelect("data-estate")} />
        <GroupedNavButton
          id="governance"
          label="Governance"
          icon={Landmark}
          isActive={active === "governance"}
          areas={GOVERNANCE_AREAS.map((a) => ({ id: GOVERNANCE_LEGACY_ID[a.id], label: a.label, icon: a.icon }))}
          onSelect={onSelect}
          onSelectArea={onSelect}
        />
      </div>

      <div className="flex items-center justify-self-end gap-4 shrink-0">
        <button onClick={onToggleTheme} title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={{ color: TB.muted }}>
          {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <UserMenu user={user} onSignOut={onSignOut} onOpenSettings={onOpenSettings} onSelect={onSelect} graphActive={active === "graph-explorer"} />
      </div>
    </div>
  );
}

// Who is signed in, and — the part that has to be on screen — what they may do.
// Half of this change is invisible without it: an auditor with no write actions
// anywhere looks like a broken app unless the bar says "Auditor".
//
// Same hover-with-delayed-close mechanics as GroupedNavButton, for the same
// reason documented there.
function UserMenu({
  user,
  onSignOut,
  onOpenSettings,
  onSelect,
  graphActive,
}: {
  user: User;
  onSignOut: () => void;
  onOpenSettings?: () => void;
  onSelect: (id: string) => void;
  graphActive: boolean;
}) {
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

  // Someone holding two roles is shown both: R. Chen assesses and owns, and
  // which one applies depends on the system in front of them.
  const roleText = user.roles.map((role) => ROLE_LABELS[role]).join(" · ");
  const GraphIcon = GRAPH_EXPLORER_ITEM.icon;

  return (
    <div className="relative h-16 flex items-center" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button className="flex items-center gap-2.5" style={{ background: "transparent" }}>
        <div
          className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
          style={{ background: TB.accentBg, color: TB.ink, border: `1px solid ${TB.border}` }}
        >
          {initialsOf(user)}
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[12.5px] font-medium whitespace-nowrap" style={{ color: TB.ink }}>{user.name}</span>
          <span className="text-[10.5px] whitespace-nowrap" style={{ color: TB.accent }}>{roleText}</span>
        </div>
        <ChevronDown size={12} color={TB.muted} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          className="absolute top-16 right-0 w-64 p-2 rounded-xl z-20"
          style={{ background: TB.panel, border: `1px solid ${TB.border}`, boxShadow: "0 16px 32px rgba(0,0,0,0.4)" }}
        >
          <div className="px-2.5 pt-1.5 pb-2.5">
            <div className="text-[13px]" style={{ color: TB.ink }}>{user.name}</div>
            <div className="text-[11.5px]" style={{ color: TB.muted }}>{user.email}</div>
            <div className="text-[11.5px] mt-1.5" style={{ color: TB.accent }}>{roleText}</div>
          </div>
          <div className="h-px mx-1 mb-1" style={{ background: TB.border }} />
          <button
            onClick={() => { cancelClose(); setOpen(false); onSelect(GRAPH_EXPLORER_ITEM.id); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-125"
            style={{ background: graphActive ? TB.accentBg : "transparent" }}
          >
            <GraphIcon size={16} color={TB.accent} />
            <span className="text-[13px]" style={{ color: TB.ink }}>{GRAPH_EXPLORER_ITEM.label}</span>
          </button>
          {onOpenSettings && (
            <button
              onClick={() => { cancelClose(); setOpen(false); onOpenSettings(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-125"
              style={{ background: "transparent" }}
            >
              <Settings size={16} color={TB.accent} />
              <span className="text-[13px]" style={{ color: TB.ink }}>Settings</span>
            </button>
          )}
          <button
            onClick={() => { cancelClose(); setOpen(false); onSignOut(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors hover:brightness-125"
            style={{ background: "transparent" }}
          >
            <LogOut size={16} color={TB.accent} />
            <span className="text-[13px]" style={{ color: TB.ink }}>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
