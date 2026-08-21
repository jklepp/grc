import React, { useRef, useState } from "react";
import { Sun, Moon, LayoutDashboard, Circle, Database, Landmark, Share2, ChevronDown, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeMode } from "../theme";
import { CONTROL_AREAS } from "../pages/controlAreas";
import { GOVERNANCE_AREAS } from "../pages/governanceAreas";
import type { GovernanceAreaId } from "../pages/governanceAreas";

// Topbar chrome is intentionally fixed dark regardless of the app-wide light/dark
// toggle — it's the "always-on" brand shell, same idea the old Sidebar used.
const TB = {
  bgSolid: "#131217",
  panel: "#1E1D22",
  border: "rgba(255,255,255,0.06)",
  ink: "#F3F1ED",
  muted: "#A39D93",
  accent: "#3D74B0",
  accentBg: "rgba(61,116,176,0.16)",
  green: "#5FB98A",
};

export type NavigationPageId = "overview" | "data-estate" | "assurance" | "governance" | "graph-explorer";

// Governance's sub-areas route through the same legacy ids App.jsx's
// LEGACY_ROUTES already maps to (page: "governance", tab: <area>) — this just
// avoids re-deriving them from the area id text.
const GOVERNANCE_LEGACY_ID: Record<GovernanceAreaId, string> = {
  policy: "policy-center",
  procedures: "procedure-library",
  principles: "security-principles",
  schedule: "activity-timeliness",
  exceptions: "exception-register",
};

interface NavItem {
  id: NavigationPageId;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "data-estate", label: "Systems", icon: Database },
];

const GRAPH_EXPLORER_ITEM: NavItem = { id: "graph-explorer", label: "Graph Explorer", icon: Share2 };

interface TopNavProps {
  active: NavigationPageId;
  onSelect: (id: string) => void;
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

export default function TopNav({ active, onSelect, mode, onToggleTheme }: TopNavProps) {
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
        <NavButton item={ITEMS[0]} isActive={active === "overview"} onClick={() => onSelect("overview")} />
        <NavButton item={ITEMS[1]} isActive={active === "data-estate"} onClick={() => onSelect("data-estate")} />
        <GroupedNavButton
          id="assurance"
          label="Controls"
          icon={ShieldCheck}
          isActive={active === "assurance"}
          areas={CONTROL_AREAS.map((a) => ({ id: a.id, label: a.label, icon: a.icon }))}
          onSelect={onSelect}
          onSelectArea={onSelect}
        />
        <GroupedNavButton
          id="governance"
          label="Governance"
          icon={Landmark}
          isActive={active === "governance"}
          areas={GOVERNANCE_AREAS.map((a) => ({ id: GOVERNANCE_LEGACY_ID[a.id], label: a.label, icon: a.icon }))}
          onSelect={onSelect}
          onSelectArea={onSelect}
        />
        <NavButton item={GRAPH_EXPLORER_ITEM} isActive={active === "graph-explorer"} onClick={() => onSelect("graph-explorer")} />
      </div>

      <div className="flex items-center justify-self-end gap-4 shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: TB.panel, border: `1px solid ${TB.border}` }}>
          <Circle size={6} fill={TB.green} color={TB.green} />
          <span className="text-[11px]" style={{ color: TB.muted }}>Vanta · 8m ago</span>
        </div>
        <button onClick={onToggleTheme} title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={{ color: TB.muted }}>
          {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
}
