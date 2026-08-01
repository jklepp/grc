import React, { useState } from "react";
import { Search, X, AlertCircle, CheckCircle2, Circle, MinusCircle, Clock, User, RefreshCw, Link2, Lock, Plug, ScrollText } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { requiredControlsCount } from "../data/ccfControls";

const NOW = new Date("2026-07-21");

const CONTROLS = [
  "Encryption at Rest",
  "Encryption in Transit",
  "Access Logging & Review",
  "Least-Privilege Access",
  "DLP Monitoring",
  "Retention & Disposal",
];

// The register's 6 named controls are the workflow-tracked detail (still shown
// in the side drawer); the summary table rolls that same evidence up against the
// full 298-control CCF pool so systems can be compared at the scale auditors
// actually care about. inheritedRate models how much of a system's required
// control set is already covered by its cloud/SaaS vendor's own certification
// (e.g. AWS's or Workday's SOC 2 report) rather than needing separate evidence —
// on-prem systems have no vendor to inherit from, so it's 0.
const INHERITED_RATE = { cloud: 0.2, saas: 0.35, "on-prem": 0 };

function hostingType(env) {
  if (env.includes("on-prem")) return "on-prem";
  if (env.includes("SaaS")) return "saas";
  return "cloud";
}

// Splits a system's required-control count into Inherited / Satisfied / Open Gaps /
// Not Implemented so the four always sum exactly to Required Controls. The split
// reuses this system's real compliant/partial/gap ratio from its 6 tracked controls
// as a stand-in confidence signal, applied to the larger CCF-derived total.
function controlBreakdown(system) {
  const required = requiredControlsCount(system.standards);
  const inherited = Math.round(required * INHERITED_RATE[hostingType(system.env)]);
  const remainder = required - inherited;
  const compliantCount = system.controls.filter((c) => c.status === "compliant").length;
  const partialCount = system.controls.filter((c) => c.status === "partial").length;
  const totalRated = system.controls.length;
  const satisfied = Math.round((remainder * compliantCount) / totalRated);
  const openGaps = Math.round((remainder * partialCount) / totalRated);
  const notImplemented = remainder - satisfied - openGaps;
  return { required, inherited, satisfied, openGaps, notImplemented };
}

const SUMMARY_COLUMNS = [
  { key: "required", label: "Required Controls", color: () => C.ink },
  { key: "inherited", label: "Inherited Controls", color: () => C.green },
  { key: "satisfied", label: "Satisfied Controls", color: () => C.accent },
  { key: "openGaps", label: "Open Gaps", color: () => C.amber },
  { key: "notImplemented", label: "Not Implemented", color: () => C.red },
];

// A compact checklist of foundational controls shown to the left of the CCF
// rollup — encryption at rest/in transit reuse this system's own tracked control
// status; Okta/MFA are separate identity-layer controls not otherwise tracked here.
function keyControls(system) {
  return [
    { label: "Encryption in Transit Enforced", status: system.controls[1].status },
    { label: "Encryption at Rest Enforced", status: system.controls[0].status },
    { label: "Okta Identities Enforced", status: system.oktaEnforced },
    { label: "MFA Enforced", status: system.mfaEnforced },
  ];
}

function daysAgo(dateStr) {
  return Math.floor((NOW - new Date(dateStr)) / 86400000);
}

function mkControl(status, source, lastVerified, evidenceRef) {
  const age = daysAgo(lastVerified);
  const staleThreshold = source === "vanta_test" ? 14 : 30;
  return { status, source, lastVerified, evidenceRef, age, stale: age > staleThreshold };
}

const SYSTEMS = [
  {
    id: "SYS-014",
    name: "Customer Data Warehouse",
    env: "Production — AWS",
    classification: "Restricted",
    dataTypes: ["PII", "Financial"],
    standards: ["SOC 2", "ISO 27001"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-4471"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-4472"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-4473"),
      mkControl("compliant", "vanta_test", "2026-07-21", "EV-4474"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-4475"),
      mkControl("compliant", "vanta_test", "2026-06-30", "EV-4476"),
    ],
    remediation: [],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.1", control: "Encryption at Rest", confidence: 95, status: "full", reasoning: "Direct match — AES-256 at rest fully evidenced across all data stores in scope." },
        { req: "CC6.7", control: "Encryption in Transit", confidence: 90, status: "full", reasoning: "TLS 1.2+ enforced on all external and internal connections, matching requirement scope." },
        { req: "CC7.2", control: "Access Logging & Review", confidence: 88, status: "full", reasoning: "Centralized logging with quarterly review evidenced; matches monitoring requirement." },
      ],
      "ISO 27001": [
        { req: "A.8.24", control: "Encryption at Rest", confidence: 90, status: "full", reasoning: "Cryptographic controls clause fully met, including key management evidence." },
        { req: "A.8.20", control: "Encryption in Transit", confidence: 82, status: "full", reasoning: "Network security clause satisfied; minor scope note on third-party connections." },
        { req: "A.5.15", control: "Least-Privilege Access", confidence: 76, status: "partial", reasoning: "ISO requires periodic access recertification with a defined cadence — current evidence shows access control but not a documented recertification schedule." },
      ],
    },
  },
  {
    id: "SYS-027",
    name: "Support Ticketing Platform",
    env: "Production — SaaS (Zendesk)",
    classification: "Restricted",
    dataTypes: ["PII", "PHI"],
    standards: ["SOC 2", "HIPAA"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "partial",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-5011"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-5012"),
      mkControl("gap", "vanta_test", "2026-07-19", "EV-5013"),
      mkControl("partial", "vanta_test", "2026-07-19", "EV-5014"),
      mkControl("gap", "vanta_test", "2026-07-17", "EV-5015"),
      mkControl("compliant", "vanta_test", "2026-07-01", "EV-5016"),
    ],
    remediation: [
      { title: "Enable audit log export to SIEM", control: "Access Logging & Review", ticketStatus: "in_progress", owner: "D. Reyes", due: "2026-08-01", overdue: false, jira: "SEC-2231" },
      { title: "Restrict agent role to view PHI on need-to-know basis", control: "Least-Privilege Access", ticketStatus: "not_started", owner: "D. Reyes", due: "2026-07-15", overdue: true, jira: "SEC-2198" },
      { title: "Configure DLP rule for PHI in ticket attachments", control: "DLP Monitoring", ticketStatus: "blocked", owner: "S. Patel", due: "2026-07-10", overdue: true, jira: "SEC-2144" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC7.2", control: "Access Logging & Review", confidence: 55, status: "partial", reasoning: "Logging exists but isn't exported to SIEM yet, so continuous monitoring evidence is incomplete for this requirement." },
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 60, status: "partial", reasoning: "Agent roles aren't scoped to need-to-know for PHI, weakening evidence for least-privilege access control." },
        { req: "CC6.8", control: "DLP Monitoring", confidence: 40, status: "gap", reasoning: "No DLP rule covers PHI in attachments — a real control gap, not just a documentation shortfall." },
      ],
      HIPAA: [
        { req: "164.312(b)", control: "Access Logging & Review", confidence: 50, status: "partial", reasoning: "HIPAA's audit control standard requires activity logs to be reviewed; SIEM export gap limits how audit-ready this evidence is." },
        { req: "164.312(a)(1)", control: "Least-Privilege Access", confidence: 58, status: "partial", reasoning: "Access control standard requires role-based restriction to ePHI/PHI — current role scope is broader than the standard expects." },
        { req: "164.312(c)(1)", control: "DLP Monitoring", confidence: 35, status: "gap", reasoning: "Integrity controls for PHI in transit through attachments aren't in place." },
      ],
    },
  },
  {
    id: "SYS-031",
    name: "Legacy Billing DB",
    env: "Production — on-prem",
    classification: "Restricted",
    dataTypes: ["Financial"],
    standards: ["SOC 2", "PCI DSS"],
    syncSource: "private_integration",
    lastSynced: "6 hrs ago",
    oktaEnforced: "gap",
    mfaEnforced: "gap",
    controls: [
      mkControl("partial", "manual", "2026-06-28", "EV-6601"),
      mkControl("gap", "manual", "2026-06-28", "EV-6602"),
      mkControl("gap", "manual", "2026-06-20", "EV-6603"),
      mkControl("partial", "manual", "2026-06-20", "EV-6604"),
      mkControl("gap", "manual", "2026-05-30", "EV-6605"),
      mkControl("gap", "manual", "2026-05-30", "EV-6606"),
    ],
    remediation: [
      { title: "Migrate to AES-256 at-rest encryption (currently AES-128)", control: "Encryption at Rest", ticketStatus: "in_progress", owner: "M. Alavi", due: "2026-09-01", overdue: false, jira: "SEC-2087" },
      { title: "Enforce TLS 1.2+ for internal DB connections", control: "Encryption in Transit", ticketStatus: "not_started", owner: "M. Alavi", due: "2026-07-18", overdue: true, jira: "SEC-2091" },
      { title: "Enable query-level access logging", control: "Access Logging & Review", ticketStatus: "not_started", owner: "T. Osei", due: "2026-08-15", overdue: false, jira: "SEC-2093" },
      { title: "Remove shared service account, move to per-user access", control: "Least-Privilege Access", ticketStatus: "blocked", owner: "M. Alavi", due: "2026-07-05", overdue: true, jira: "SEC-2088" },
      { title: "No DLP tooling deployed on this system", control: "DLP Monitoring", ticketStatus: "not_started", owner: "S. Patel", due: "2026-09-30", overdue: false, jira: "SEC-2101" },
      { title: "Define and implement disposal schedule for records >7yr", control: "Retention & Disposal", ticketStatus: "not_started", owner: "R. Chen", due: "2026-08-20", overdue: false, jira: "SEC-2102" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.1", control: "Encryption at Rest", confidence: 60, status: "partial", reasoning: "AES-128 provides encryption but falls short of the algorithm strength typically expected for this requirement at Restricted tier." },
        { req: "CC6.7", control: "Encryption in Transit", confidence: 30, status: "gap", reasoning: "No enforced TLS on internal DB connections — a direct, unresolved gap against this requirement." },
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 45, status: "partial", reasoning: "Shared service account undermines individual accountability that this requirement expects." },
      ],
      "PCI DSS": [
        { req: "3.5", control: "Encryption at Rest", confidence: 55, status: "partial", reasoning: "PCI's key management and encryption strength expectations aren't fully met by AES-128 for cardholder-adjacent financial data." },
        { req: "4.2", control: "Encryption in Transit", confidence: 25, status: "gap", reasoning: "PCI requires strong cryptography for transmission over open/public networks and internal segments handling financial data." },
        { req: "8.3", control: "Least-Privilege Access", confidence: 40, status: "gap", reasoning: "PCI explicitly requires unique IDs per user; a shared service account directly violates this requirement." },
      ],
    },
  },
  {
    id: "SYS-042",
    name: "HR Information System",
    env: "Production — SaaS (Workday)",
    classification: "Confidential",
    dataTypes: ["PII"],
    standards: ["SOC 2", "GDPR"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-7001"),
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-7002"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-7003"),
      mkControl("partial", "vanta_test", "2026-07-19", "EV-7004"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-7005"),
      mkControl("compliant", "vanta_test", "2026-07-02", "EV-7006"),
    ],
    remediation: [
      { title: "Quarterly access review overdue for manager role", control: "Least-Privilege Access", ticketStatus: "in_progress", owner: "R. Chen", due: "2026-07-25", overdue: false, jira: "SEC-2210" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.3", control: "Least-Privilege Access", confidence: 78, status: "partial", reasoning: "Overdue quarterly review is a timing gap, not a design gap." },
      ],
      GDPR: [
        { req: "Art. 32", control: "Least-Privilege Access", confidence: 80, status: "partial", reasoning: "GDPR's security-of-processing article expects up-to-date access controls." },
      ],
    },
  },
  {
    id: "SYS-055",
    name: "Marketing Analytics Pipeline",
    env: "Production — GCP",
    classification: "Confidential",
    dataTypes: ["PII"],
    standards: ["SOC 2", "GDPR"],
    syncSource: "vanta",
    lastSynced: "8 min ago",
    oktaEnforced: "compliant",
    mfaEnforced: "compliant",
    controls: [
      mkControl("compliant", "vanta_test", "2026-07-20", "EV-8101"),
      mkControl("gap", "vanta_test", "2026-07-19", "EV-8102"),
      mkControl("compliant", "vanta_test", "2026-07-19", "EV-8103"),
      mkControl("compliant", "vanta_test", "2026-07-18", "EV-8104"),
      mkControl("gap", "vanta_test", "2026-07-17", "EV-8105"),
      mkControl("partial", "vanta_test", "2026-06-25", "EV-8106"),
    ],
    remediation: [
      { title: "Enforce TLS on internal Kafka stream between ingest and warehouse", control: "Encryption in Transit", ticketStatus: "not_started", owner: "M. Alavi", due: "2026-08-05", overdue: false, jira: "SEC-2244" },
      { title: "Deploy DLP scanning on export bucket", control: "DLP Monitoring", ticketStatus: "in_progress", owner: "S. Patel", due: "2026-07-28", overdue: false, jira: "SEC-2239" },
      { title: "Document retention schedule for raw event logs", control: "Retention & Disposal", ticketStatus: "not_started", owner: "R. Chen", due: "2026-08-10", overdue: false, jira: "SEC-2247" },
    ],
    standardMappings: {
      "SOC 2": [
        { req: "CC6.7", control: "Encryption in Transit", confidence: 45, status: "gap", reasoning: "Internal Kafka stream between ingest and warehouse isn't TLS-enforced." },
        { req: "CC6.8", control: "DLP Monitoring", confidence: 62, status: "partial", reasoning: "DLP scanning is being deployed but not yet live on the export bucket." },
      ],
      GDPR: [
        { req: "Art. 32", control: "Encryption in Transit", confidence: 50, status: "partial", reasoning: "Same internal-stream encryption gap weakens GDPR's security-of-processing expectations." },
        { req: "Art. 5(1)(e)", control: "Retention & Disposal", confidence: 68, status: "partial", reasoning: "Storage limitation principle expects a documented retention period — none defined yet." },
      ],
    },
  },
];

function statusMeta(status) {
  if (status === "compliant" || status === "full") return { color: C.green, bg: C.greenBg, Icon: CheckCircle2, label: "Compliant" };
  if (status === "partial") return { color: C.amber, bg: C.amberBg, Icon: MinusCircle, label: "Partial" };
  if (status === "gap") return { color: C.red, bg: C.redBg, Icon: Circle, label: "Gap" };
  return { color: C.muted, bg: C.panel2, Icon: Circle, label: "N/A" };
}
function ticketMeta(status) {
  if (status === "done") return { color: C.green, label: "Done" };
  if (status === "in_progress") return { color: C.accent, label: "In progress" };
  if (status === "blocked") return { color: C.red, label: "Blocked" };
  return { color: C.muted, label: "Not started" };
}
function sourceLabel(source) {
  if (source === "vanta_test") return "Vanta automated test";
  if (source === "private_integration") return "Private integration test";
  return "Manually verified";
}

function ClassificationTag({ level }) {
  const meta = CLASS_META[level];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide" style={{ background: meta.bg, color: meta.color, letterSpacing: "0.04em" }}>
      {level}
    </span>
  );
}
function StandardChip({ standard, active, onClick }) {
  const clickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors"
      style={{ border: `1px solid ${C.accent}`, color: active ? "#0F1420" : C.accent, background: active ? C.accent : "transparent", cursor: clickable ? "pointer" : "default" }}
    >
      {standard}
    </button>
  );
}
function DataTypeChip({ type }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
      {type}
    </span>
  );
}
function SourceBadge({ syncSource }) {
  const isVanta = syncSource === "vanta";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: isVanta ? C.accentBg : C.amberBg, color: isVanta ? C.accent : C.amber }}>
      <Plug size={10} />
      {isVanta ? "Vanta-monitored" : "Private integration"}
    </span>
  );
}
function CoverageBar({ confidence, status }) {
  const color = statusMeta(status).color;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: C.border }}>
        <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-9 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace", color }}>{confidence}%</span>
    </div>
  );
}
function RequirementRow({ mapping, isOpen, onToggle }) {
  const meta = statusMeta(mapping.status);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 py-2.5 text-left">
        <div className="w-16 shrink-0 text-xs" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{mapping.req}</div>
        <div className="flex-1"><CoverageBar confidence={mapping.confidence} status={mapping.status} /></div>
        <div className="text-[10px] uppercase tracking-wide w-14 text-right font-medium" style={{ color: meta.color }}>{meta.label}</div>
      </button>
      {isOpen && (
        <div className="pb-3 pr-2">
          <div className="text-xs mb-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{mapping.control}</div>
          <div className="text-sm leading-relaxed p-2.5 rounded" style={{ background: C.panel2, color: C.muted, borderLeft: `2px solid ${meta.color}` }}>{mapping.reasoning}</div>
        </div>
      )}
    </div>
  );
}
function RemediationRow({ item }) {
  const { color, label } = ticketMeta(item.ticketStatus);
  return (
    <div className="py-3 px-4 rounded-lg mb-2" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium" style={{ color: C.ink }}>{item.title}</div>
        {item.overdue && (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, background: C.redBg }}>
            <AlertCircle size={11} /> OVERDUE
          </span>
        )}
      </div>
      <div className="text-xs mt-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{item.control}</div>
      <div className="flex items-center gap-4 mt-2.5 text-xs flex-wrap">
        <span className="flex items-center gap-1" style={{ color }}><Circle size={7} fill={color} color={color} /> {label}</span>
        <span className="flex items-center gap-1" style={{ color: C.muted }}><User size={11} /> {item.owner}</span>
        <span className="flex items-center gap-1" style={{ color: item.overdue ? C.red : C.muted }}><Clock size={11} /> Due {item.due}</span>
        <span className="flex items-center gap-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={11} /> {item.jira}</span>
      </div>
    </div>
  );
}

export default function DataClassificationGapMatrix() {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [standardFilter, setStandardFilter] = useState("All");
  const [drawerStandard, setDrawerStandard] = useState(null);
  const [openReq, setOpenReq] = useState(null);

  const presentClasses = CLASS_ORDER.filter((c) => SYSTEMS.some((s) => s.classification === c));
  const presentStandards = [...new Set(SYSTEMS.flatMap((s) => s.standards))].sort();

  const filtered = SYSTEMS.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) &&
      (classFilter === "All" || s.classification === classFilter) &&
      (standardFilter === "All" || s.standards.includes(standardFilter))
  );

  const gapCount = (s) => s.controls.filter((c) => c.status === "gap" || c.status === "partial").length;
  const systemsWithGaps = SYSTEMS.filter((s) => gapCount(s) > 0).length;
  const totalOverdue = SYSTEMS.flatMap((s) => s.remediation).filter((r) => r.overdue).length;
  const totalOpenItems = SYSTEMS.flatMap((s) => s.remediation).filter((r) => r.ticketStatus !== "done").length;
  const staleCount = SYSTEMS.flatMap((s) => s.controls).filter((c) => c.stale).length;
  const selectedBreakdown = selected ? controlBreakdown(selected) : null;

  function openSystem(s) {
    setSelected(s);
    setDrawerStandard(s.standards[0]);
    setOpenReq(null);
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              Data Classification Policy v3.2 · Confidential & Restricted
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>System Compliance Register</h1>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <Lock size={12} /><span>Read-only</span><span style={{ color: C.border }}>|</span><RefreshCw size={12} /><span>Synced from Vanta · 8 min ago</span>
          </div>
        </div>
        <p className="text-sm mt-2 max-w-xl" style={{ color: C.muted }}>
          Systems handling data classified Confidential or Restricted under policy, evaluated against the six controls required for their tier. Status reflects live test results — this view does not modify Vanta or Jira.
        </p>
      </div>

      <div className="px-8 grid grid-cols-5 gap-4 mb-5">
        {[
          { label: "Systems in register", value: SYSTEMS.length, color: C.ink },
          { label: "Systems with gaps", value: systemsWithGaps, color: C.red },
          { label: "Open remediation items", value: totalOpenItems, color: C.accent },
          { label: "Overdue items", value: totalOverdue, color: C.red },
          { label: "Stale evidence", value: staleCount, color: C.amber },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="text-2xl font-semibold" style={{ color: s.color, fontFamily: "'Source Serif 4', serif" }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="px-8 mb-3 space-y-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-64" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <Search size={14} color={C.muted} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search systems" className="bg-transparent text-sm outline-none w-full" style={{ color: C.ink }} />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setClassFilter("All")} className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={{ background: classFilter === "All" ? C.ink : C.panel, color: classFilter === "All" ? C.bg : C.muted, border: `1px solid ${classFilter === "All" ? C.ink : C.border}` }}>
              All tiers
            </button>
            {presentClasses.map((level) => {
              const meta = CLASS_META[level];
              const active = classFilter === level;
              return (
                <button key={level} onClick={() => setClassFilter(level)} className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                  style={{ background: active ? meta.color : C.panel, color: active ? "#0F1420" : meta.color, border: `1px solid ${active ? meta.color : C.border}` }}>
                  {level}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs flex items-center gap-1 mr-1" style={{ color: C.muted }}><ScrollText size={12} /> Standard:</span>
          <StandardChip standard="All" active={standardFilter === "All"} onClick={() => setStandardFilter("All")} />
          {presentStandards.map((std) => (
            <StandardChip key={std} standard={std} active={standardFilter === std} onClick={() => setStandardFilter(std)} />
          ))}
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="grid" style={{ gridTemplateColumns: "320px 210px repeat(5, 1fr)" }}>
            <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }} />
            <div className="p-3 text-center text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, color: C.muted }}>Key Controls</div>
            {SUMMARY_COLUMNS.map((col) => (
              <div key={col.key} className="p-3 text-center text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, color: C.muted }}>{col.label}</div>
            ))}
            {filtered.map((s) => {
              const breakdown = controlBreakdown(s);
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => openSystem(s)} className="p-4 text-left hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ClassificationTag level={s.classification} />
                      <div className="text-sm font-medium" style={{ color: C.ink }}>{s.name}</div>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{s.id} · {s.env}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {s.dataTypes.map((t, i) => <DataTypeChip key={i} type={t} />)}
                      <SourceBadge syncSource={s.syncSource} />
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {s.standards.map((std, i) => <StandardChip key={i} standard={std} />)}
                    </div>
                  </button>
                  <div
                    className="cursor-pointer p-3 space-y-1.5"
                    style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}
                    onClick={() => openSystem(s)}
                  >
                    {keyControls(s).map((item, i) => {
                      const meta = statusMeta(item.status);
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <meta.Icon size={11} color={meta.color} strokeWidth={2.5} className="shrink-0" />
                          <span style={{ color: C.ink }}>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {SUMMARY_COLUMNS.map((col) => {
                    const value = breakdown[col.key];
                    const pct = Math.min(100, Math.round((value / breakdown.required) * 100));
                    return (
                      <div
                        key={col.key}
                        className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                        style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}
                        onClick={() => openSystem(s)}
                      >
                        <span className="text-sm font-semibold" style={{ color: col.color(), fontFamily: "'IBM Plex Mono', monospace" }}>{value.toLocaleString()}</span>
                        {col.key !== "required" && (
                          <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col.color() }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div className="text-xs mt-3" style={{ color: C.muted }}>
          Key Controls is a quick read on foundational protections, independent of the CCF rollup. Required Controls is the count of the 298 CCF-matched controls that apply to each system's compliance standards; Inherited Controls are covered by the hosting cloud/SaaS vendor's own certification rather than needing separate evidence.
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-[460px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ClassificationTag level={selected.classification} />
                    <span className="text-xs" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{selected.id}</span>
                  </div>
                  <h2 className="text-xl mt-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.name}</h2>
                  <div className="text-sm mt-1" style={{ color: C.muted }}>{selected.env}</div>
                </div>
                <button onClick={() => setSelected(null)}><X size={18} color={C.muted} /></button>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap items-center">
                {selected.dataTypes.map((t, i) => <DataTypeChip key={i} type={t} />)}
                <SourceBadge syncSource={selected.syncSource} />
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: C.muted }}>
                <RefreshCw size={11} /> Last synced {selected.lastSynced}
              </div>
            </div>

            <div className="p-6">
              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>CCF Coverage ({selected.standards.join(", ")})</div>
              <div className="grid grid-cols-5 gap-2 mb-6">
                {SUMMARY_COLUMNS.map((col) => (
                  <div key={col.key} className="rounded-lg p-2 text-center" style={{ background: C.panel2 }}>
                    <div className="text-base font-semibold" style={{ color: col.color(), fontFamily: "'IBM Plex Mono', monospace" }}>{selectedBreakdown[col.key]}</div>
                    <div className="text-[9px] mt-0.5 leading-tight" style={{ color: C.muted }}>{col.label}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Tracked Control Detail</div>
              <div className="space-y-2 mb-6">
                {CONTROLS.map((c, i) => {
                  const control = selected.controls[i];
                  const meta = statusMeta(control.status);
                  return (
                    <div key={i} className="p-2.5 rounded-lg" style={{ background: meta.bg }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <meta.Icon size={13} color={meta.color} />
                          <span style={{ color: C.ink }}>{c}</span>
                        </div>
                        {control.stale && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(224,169,78,0.12)", color: C.amber }}>STALE</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 pl-5 text-[11px]" style={{ color: C.muted }}>
                        <span>{sourceLabel(control.source)}</span><span>·</span>
                        <span>Verified {control.age === 0 ? "today" : `${control.age}d ago`}</span><span>·</span>
                        <span className="flex items-center gap-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={10} /> {control.evidenceRef}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Framework Requirements</div>
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {selected.standards.map((std) => (
                  <StandardChip key={std} standard={std} active={drawerStandard === std} onClick={() => { setDrawerStandard(std); setOpenReq(null); }} />
                ))}
              </div>
              <div className="rounded-lg mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3">
                  {(selected.standardMappings[drawerStandard] || []).map((m, i) => (
                    <RequirementRow key={i} mapping={m} isOpen={openReq === i} onToggle={() => setOpenReq(openReq === i ? null : i)} />
                  ))}
                </div>
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
                Remediation Items {selected.remediation.length > 0 && `(${selected.remediation.length})`}
              </div>
              {selected.remediation.length === 0 ? (
                <div className="text-sm p-4 rounded-lg" style={{ background: C.greenBg, color: C.green }}>
                  No open remediation items — this system is fully compliant.
                </div>
              ) : (
                selected.remediation.map((r, i) => <RemediationRow key={i} item={r} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
