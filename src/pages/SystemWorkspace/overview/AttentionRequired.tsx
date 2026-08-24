import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { C } from "../../../theme";
import { Panel } from "../shared/Panel";
import { SectionHeader } from "../shared/SectionHeader";
import type { CockpitItem } from "../../../engine";
import type { CockpitSummary } from "../types";
import type { SystemWorkspaceTab } from "../tabs";

// Read at call time: C is mutated in place by applyTheme, so a module-scope
// map keeps the theme that was active when this module first evaluated.
const severityColor = (severity: string): string =>
  ({ critical: C.red, high: C.red, medium: C.amber, low: C.muted, info: C.green } as Record<string, string>)[severity] ?? C.red;

// Presentation-layer routing only — which tab best explains a cockpit item's
// domain. Not a scoring decision; mirrors the existing POLICY_BY_CONTROL/
// STATUS_META pattern of small local lookup tables.
export const DOMAIN_TO_TAB: Partial<Record<string, SystemWorkspaceTab>> = {
  "Security Testing": "testing",
  Resilience: "testing",
  "Incident Response": "testing",
  "Vendor Assurance": "testing",
  "Identity & Access": "identity",
  Vulnerability: "security",
  Exposure: "security",
  Findings: "actions",
  Risk: "risk",
  "Control Assurance": "controls",
};

function AttentionRow({ item, onNavigate }: { item: CockpitItem; onNavigate: (tab: SystemWorkspaceTab) => void }) {
  const tab = DOMAIN_TO_TAB[item.domain];
  const Wrapper = tab ? "button" : "div";
  return (
    <Wrapper
      onClick={tab ? () => onNavigate(tab) : undefined}
      className="w-full flex items-start gap-2 py-1.5 text-left"
      style={tab ? { cursor: "pointer" } : undefined}
    >
      <AlertTriangle size={13} className="shrink-0 mt-0.5" color={severityColor(item.severity)} />
      <div className="min-w-0">
        <span className="text-sm" style={{ color: C.ink }}>{item.label}</span>
        <span className="text-xs ml-2" style={{ color: C.muted }}>{item.detail}</span>
      </div>
    </Wrapper>
  );
}

function PositiveRow({ item }: { item: CockpitItem }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <CheckCircle2 size={13} className="shrink-0 mt-0.5" color={C.green} />
      <div className="min-w-0">
        <span className="text-sm" style={{ color: C.ink }}>{item.label}</span>
        <span className="text-xs ml-2" style={{ color: C.muted }}>{item.detail}</span>
      </div>
    </div>
  );
}

export function AttentionRequired({ cockpit, onNavigate }: { cockpit: CockpitSummary; onNavigate: (tab: SystemWorkspaceTab) => void }) {
  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeader icon={CheckCircle2} title="Positive Assurance" description="Recent evidence that demonstrates this system's controls are operating as intended." />
        {cockpit.positiveAssurance.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>Nothing proven yet.</div>
        ) : cockpit.positiveAssurance.map((item, i) => <PositiveRow key={i} item={item} />)}
      </Panel>
      <Panel>
        <SectionHeader
          icon={AlertTriangle}
          title="Attention Required"
          description="The highest-priority posture, testing, identity, vendor, and risk signals requiring action."
          aside={cockpit.attentionRequired.length > 0 ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redBg, color: C.red }}>
              {cockpit.attentionRequired.length}
            </span>
          ) : undefined}
        />
        {cockpit.attentionRequired.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>Nothing outstanding.</div>
        ) : cockpit.attentionRequired.map((item, i) => <AttentionRow key={i} item={item} onNavigate={onNavigate} />)}
      </Panel>
    </div>
  );
}
