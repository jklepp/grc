import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { C } from "../../../theme";
import { Panel } from "../shared/Panel";

const SEVERITY_COLOR = { critical: C.red, high: C.red, medium: C.amber, low: C.muted, info: C.green };

// Presentation-layer routing only — which tab best explains a cockpit item's
// domain. Not a scoring decision; mirrors the existing POLICY_BY_CONTROL/
// STATUS_META pattern of small local lookup tables.
const DOMAIN_TO_TAB = {
  "Security Testing": "testing",
  Resilience: "testing",
  "Incident Response": "testing",
  "Vendor Assurance": "testing",
  "Identity & Access": "security",
  Vulnerability: "security",
  Exposure: "security",
  Findings: "risk",
  Risk: "risk",
  "Control Assurance": "controls",
};

function AttentionRow({ item, onNavigate }) {
  const tab = DOMAIN_TO_TAB[item.domain];
  const Wrapper = tab ? "button" : "div";
  return (
    <Wrapper
      onClick={tab ? () => onNavigate(tab) : undefined}
      className="w-full flex items-start gap-2 py-1.5 text-left"
      style={tab ? { cursor: "pointer" } : undefined}
    >
      <AlertTriangle size={13} className="shrink-0 mt-0.5" color={SEVERITY_COLOR[item.severity] ?? C.red} />
      <div className="min-w-0">
        <span className="text-sm" style={{ color: C.ink }}>{item.label}</span>
        <span className="text-xs ml-2" style={{ color: C.muted }}>{item.detail}</span>
      </div>
    </Wrapper>
  );
}

function PositiveRow({ item }) {
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

export function AttentionRequired({ cockpit, onNavigate }) {
  return (
    <div className="space-y-4">
      <Panel>
        <div className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.green }}>Positive Assurance</div>
        {cockpit.positiveAssurance.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>Nothing proven yet.</div>
        ) : cockpit.positiveAssurance.map((item, i) => <PositiveRow key={i} item={item} />)}
      </Panel>
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: C.red }}>Attention Required</div>
          {cockpit.attentionRequired.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redBg, color: C.red }}>
              {cockpit.attentionRequired.length}
            </span>
          )}
        </div>
        {cockpit.attentionRequired.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>Nothing outstanding.</div>
        ) : cockpit.attentionRequired.map((item, i) => <AttentionRow key={i} item={item} onNavigate={onNavigate} />)}
      </Panel>
    </div>
  );
}
