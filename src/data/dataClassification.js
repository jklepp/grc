import { requiredControlsCount } from "./ccfControls";

// Minimal mirror of the System Compliance Register's systems — just enough to
// derive cross-page assurance metrics for the Executive Dashboard. Keep the
// standards/env/control-status fields here in sync with the systems defined in
// DataClassificationGapMatrix.jsx if that register changes; the richer detail
// (remediation items, standard-by-standard reasoning) stays local to that page
// since nothing else needs it.
const INHERITED_RATE = { cloud: 0.2, saas: 0.35, "on-prem": 0 };
function hostingType(env) {
  if (env.includes("on-prem")) return "on-prem";
  if (env.includes("SaaS")) return "saas";
  return "cloud";
}

const REGISTER_SYSTEMS = [
  { id: "SYS-014", env: "Production — AWS", standards: ["SOC 2", "ISO 27001"], controlStatuses: ["compliant", "compliant", "compliant", "compliant", "compliant", "compliant"], oktaEnforced: "compliant", mfaEnforced: "compliant" },
  { id: "SYS-027", env: "Production — SaaS (Zendesk)", standards: ["SOC 2", "HIPAA"], controlStatuses: ["compliant", "compliant", "gap", "partial", "gap", "compliant"], oktaEnforced: "compliant", mfaEnforced: "partial" },
  { id: "SYS-031", env: "Production — on-prem", standards: ["SOC 2", "PCI DSS"], controlStatuses: ["partial", "gap", "gap", "partial", "gap", "gap"], oktaEnforced: "gap", mfaEnforced: "gap" },
  { id: "SYS-042", env: "Production — SaaS (Workday)", standards: ["SOC 2", "GDPR"], controlStatuses: ["compliant", "compliant", "compliant", "partial", "compliant", "compliant"], oktaEnforced: "compliant", mfaEnforced: "compliant" },
  { id: "SYS-055", env: "Production — GCP", standards: ["SOC 2", "GDPR"], controlStatuses: ["compliant", "gap", "compliant", "compliant", "gap", "partial"], oktaEnforced: "compliant", mfaEnforced: "compliant" },
];

// Same split logic as the System Compliance Register: required controls (from
// the real 298-control CCF pool) get divided into inherited / satisfied / open
// gaps / not implemented, using this system's compliant/partial ratio from its
// 6 tracked controls as the confidence signal.
function breakdown(sys) {
  const required = requiredControlsCount(sys.standards);
  const inherited = Math.round(required * INHERITED_RATE[hostingType(sys.env)]);
  const remainder = required - inherited;
  const compliantCount = sys.controlStatuses.filter((s) => s === "compliant").length;
  const partialCount = sys.controlStatuses.filter((s) => s === "partial").length;
  const satisfied = Math.round((remainder * compliantCount) / sys.controlStatuses.length);
  const openGaps = Math.round((remainder * partialCount) / sys.controlStatuses.length);
  return { required, inherited, satisfied, openGaps };
}

const totals = REGISTER_SYSTEMS.reduce(
  (acc, sys) => {
    const b = breakdown(sys);
    acc.required += b.required;
    acc.covered += b.inherited + b.satisfied;
    return acc;
  },
  { required: 0, covered: 0 }
);
export const DATA_PROTECTION_PCT = Math.round((totals.covered / totals.required) * 100);

// Operational Readiness: the four foundational checks (encryption at rest/in
// transit, Okta, MFA) tracked per system, rolled up into one compliant rate.
const keyControlChecks = REGISTER_SYSTEMS.flatMap((sys) => [
  sys.controlStatuses[0], sys.controlStatuses[1], sys.oktaEnforced, sys.mfaEnforced,
]);
export const OPERATIONAL_READINESS_PCT = Math.round(
  (keyControlChecks.filter((s) => s === "compliant").length / keyControlChecks.length) * 100
);
