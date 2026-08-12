import React from "react";
import {
  Menu, Sun, Moon, LayoutDashboard, LayoutGrid, ShieldCheck, AlertTriangle,
  FileText, Circle, Database, ClipboardCheck, Network,
} from "lucide-react";

// Sidebar chrome is intentionally fixed dark regardless of the app-wide light/dark
// toggle — it's the "always-on" brand shell, same idea as the reference screenshot.
const SB = {
  bg: "#12142080",
  bgSolid: "#12131F",
  panel: "#1A1C2C",
  border: "rgba(255,255,255,0.06)",
  ink: "#F1F2F6",
  muted: "#8B90A8",
  accent: "#7C6FEE",
  accentBg: "rgba(124,111,238,0.16)",
  green: "#5FB98A",
};

// PROGRAM items with a real `id` route to an actual page in App.jsx's PAGES map.
const GROUPS = [
  {
    label: "Program",
    items: [
      { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
      { id: "data-footprint", label: "Data Footprint", icon: Database },
      { id: "data-map", label: "Enterprise Data Map", icon: Network },
      { id: "ccf", label: "Common Controls", icon: LayoutGrid },
      { id: "gap-matrix", label: "Data Classification Register", icon: ShieldCheck },
      { id: "ssp", label: "System Security Plan", icon: ClipboardCheck },
      { id: "risk-register", label: "Risk Register", icon: AlertTriangle },
      { id: "policy-center", label: "Policy Center", icon: FileText },
    ],
  },
];

export default function Sidebar({ expanded, onToggle, active, onSelect, mode, onToggleTheme }) {
  return (
    <div
      className="h-screen shrink-0 flex flex-col transition-all duration-200"
      style={{ width: expanded ? 248 : 64, background: SB.bgSolid, borderRight: `1px solid ${SB.border}` }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center gap-3 px-4 py-5">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
          style={{ background: SB.accent, color: "#0F1420" }}
          title="Toggle menu"
        >
          A
        </button>
        {expanded && (
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: SB.ink }}>ACME GRC</div>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: SB.muted }}>Command Center</div>
          </div>
        )}
        {expanded && (
          <button onClick={onToggle} className="ml-auto p-1 rounded" style={{ color: SB.muted }} title="Collapse">
            <Menu size={16} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 space-y-4 overflow-y-auto">
        {GROUPS.map((group) => (
          <div key={group.label}>
            {expanded && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: SB.muted }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => !item.disabled && onSelect(item.id)}
                    disabled={item.disabled}
                    title={item.disabled ? `${item.label} — coming soon` : item.label}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                    style={{
                      background: isActive ? SB.accentBg : "transparent",
                      opacity: item.disabled ? 0.4 : 1,
                      cursor: item.disabled ? "default" : "pointer",
                    }}
                  >
                    <Icon size={17} color={isActive ? SB.accent : SB.muted} className="shrink-0" />
                    {expanded && (
                      <span className="text-sm truncate" style={{ color: isActive ? SB.ink : SB.muted }}>
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors"
        style={{ color: SB.muted, borderTop: `1px solid ${SB.border}` }}
      >
        {mode === "dark" ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
        {expanded && <span className="text-sm">{mode === "dark" ? "Light mode" : "Dark mode"}</span>}
      </button>

      {/* Vanta connection status */}
      <div className="p-3">
        <div className="rounded-lg p-3" style={{ background: SB.panel, border: `1px solid ${SB.border}` }}>
          <div className="flex items-center gap-2">
            <Circle size={7} fill={SB.green} color={SB.green} />
            {expanded ? (
              <>
                <span className="text-xs font-medium" style={{ color: SB.ink }}>Vanta Connected</span>
                <span className="text-[10px] ml-auto" style={{ color: SB.muted }}>8m ago</span>
              </>
            ) : (
              <span className="text-[9px]" style={{ color: SB.muted }}>Live</span>
            )}
          </div>
          {expanded && (
            <div className="mt-1.5 text-[10px] leading-relaxed" style={{ color: SB.muted }}>
              1,284 tests synchronized
              <br />
              42 evidence objects updated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
