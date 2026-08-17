import React, { useMemo, useState } from "react";
import {
  ClipboardCheck, Search, X, Cloud, CheckCircle2, MinusCircle, Circle, RadioTower, Link2, Zap, UserCog, ScrollText,
  ChevronDown, ChevronRight, Info, Layers, Users2, ListTodo, BookOpen, AlertCircle, Clock, User,
  Gauge, AlertTriangle, Database, Fingerprint, Globe, Crosshair, Siren, LifeBuoy, Handshake, Bug, GitBranch,
  TrendingUp, Building2,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading, TabBar } from "../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../components/SystemBadges";
import {
  getAllSystems, systemControlMatrix, dataTypesForSystem, IMPLEMENTATION_TYPES,
  PRISMA_LEVELS, COMPLIANCE_LABELS, INSTANCE_STATUS_META,
  cockpitSummary, identityPostureForSystem, exposureForSystem, securityTestsForSystem,
  resilienceForSystem, irForSystem, vendorsForSystem, vulnerabilitiesForSystem, sdlcForSystem,
  topRisksForSystem, FINDING_SEVERITY_META, SEVERITY_LEVELS,
} from "../engine";

// The compliance scale, coloured. Deliberately not assuranceBand's thresholds:
// this is a five-point ordinal rating, not a 0-100 score, and mapping it
// through a score band would imply a precision the rating does not carry.
function ratingColor(rating) {
  if (rating === 100) return C.green;
  if (rating === 75) return C.accent;
  if (rating === 50) return C.amber;
  if (rating === 25) return C.amber;
  return C.red;
}

const SYSTEMS = getAllSystems();
import { POLICIES } from "../data/policies";

// Opens on Production AI Platform — the system most worth landing on by
// default — falling back to the first system if it's ever renamed or removed.
const DEFAULT_SYSTEM_ID = (SYSTEMS.find((s) => s.name === "Production AI Platform") ?? SYSTEMS[0]).id;

// Every visible SCF control belongs to exactly one policy's domain set (verified
// when Policy Center was built — the 307 visible controls split cleanly across
// the 19 policies with zero overlap), so this lookup is always a single hit.
const POLICY_BY_CONTROL = {};
POLICIES.forEach((p) => p.controlIds.forEach((id) => { POLICY_BY_CONTROL[id] = p; }));

// Five states, and every one of them is derived from something real. See the
// git history for the reasoning — this matrix moved from "Assessed" as the
// majority answer to "Not in Scope," on purpose: the honest count of 44
// controls actually looked at out of 271 is uncomfortable by design.
const STATUS_META = {
  inherited: { label: "Inherited", color: C.green, bg: C.greenBg, Icon: Cloud },
  satisfied: { label: "Satisfied", color: C.accent, bg: C.accentBg, Icon: CheckCircle2 },
  partial: { label: "Partial", color: C.amber, bg: C.amberBg, Icon: MinusCircle },
  deficient: { label: "Deficient", color: C.red, bg: C.redBg, Icon: Circle },
  "not-implemented": { label: "Not Implemented", color: C.red, bg: C.redBg, Icon: Circle },
  unassessed: { label: "Not in Scope", color: C.muted, bg: C.panel2, Icon: ScrollText },
};
const STATUS_ORDER = ["inherited", "satisfied", "partial", "deficient", "not-implemented", "unassessed"];

// Primary organizing structure for the control matrix — how a control
// actually gets satisfied, not just which domain it's filed under.
const IMPLEMENTATION_META = [
  { type: IMPLEMENTATION_TYPES.AUTOMATED, Icon: Zap, color: C.accent, bg: C.accentBg, blurb: "Enforced continuously by tooling. Evidence is a system export or scan result, not a person's word." },
  { type: IMPLEMENTATION_TYPES.MANUAL, Icon: UserCog, color: C.amber, bg: C.amberBg, blurb: "Executed by a person on a recurring basis. Needs a named owner and a cadence, or it silently lapses." },
  { type: IMPLEMENTATION_TYPES.PROCESS, Icon: ScrollText, color: C.green, bg: C.greenBg, blurb: "Governed by policy, contract, or documented process. Evidenced by the record, not a system." },
];

const SEVERITY_COLOR = { critical: C.red, high: C.red, medium: C.amber, low: C.muted, info: C.green };

// The 16 numbered document sections grouped into 5 thematic sub-tabs, so the
// page doesn't render as one long scroll. Section numbers stay attached to
// their content below — only which sub-tab shows them changes.
const SUB_TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "security", label: "Security & Exposure", icon: Fingerprint },
  { id: "testing", label: "Testing & Resilience", icon: Crosshair },
  { id: "controls", label: "Control Assurance", icon: Layers },
  { id: "risk", label: "Risk & Remediation", icon: TrendingUp },
];

function assetName(system, assetId) {
  return system.assets.find((a) => a.id === assetId)?.name ?? assetId;
}
function ticketMeta(status) {
  if (status === "closed") return { color: C.green, label: "Closed" };
  if (status === "verified") return { color: C.green, label: "Verified" };
  if (status === "remediating") return { color: C.accent, label: "Remediating" };
  if (status === "accepted") return { color: C.amber, label: "Accepted" };
  return { color: C.red, label: "Open" };
}

// Unique policies referenced by a system's control matrix, with how many of its
// controls each one governs — computed from the same governing-policy lookup the
// control drawer uses, not a separately maintained list.
function getReferencedPolicies(matrix) {
  const counts = new Map();
  matrix.forEach((row) => {
    const policy = POLICY_BY_CONTROL[row.control.id];
    if (!policy) return;
    const existing = counts.get(policy.id);
    counts.set(policy.id, { policy, count: (existing ? existing.count : 0) + 1 });
  });
  return [...counts.values()].sort((a, b) => a.policy.code.localeCompare(b.policy.code));
}

function DocSection({ number, title, icon, children, hint, right }) {
  return (
    <div className="px-8 pb-10">
      <SectionHeading icon={icon} number={number} hint={hint} right={right}>{title}</SectionHeading>
      {children}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

function IdentificationField({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

// ---- Cockpit strip components -------------------------------------------------
// A tiny ring chart for a single 0-100 value — just enough visual weight to
// tell these four tiles apart from an ordinary stat card at a glance, without
// pretending to be a real analytics widget.
function StatRing({ pct, color, size = 40, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (filled / 100) * c} strokeLinecap="round"
      />
    </svg>
  );
}

// `pct` renders a ring for tiles whose value is already a 0-100 measure
// (assurance, target, coverage); `ring`/`ringColor` overrides that with a
// value on a different scale (residual risk's severity-derived fill) so the
// card doesn't imply the number itself is a percentage.
function StatTile({ label, value, sub, color, pct, ring, ringColor, muted }) {
  const ringPct = ring !== undefined ? ring : pct;
  const ringCol = ringColor || color || (muted ? C.muted : C.accent);
  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="min-w-0">
        <div className="text-2xl font-semibold" style={{ color: color || C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
        <div className="text-xs mt-1" style={{ color: C.muted }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</div>}
      </div>
      {ringPct !== undefined && ringPct !== null && <StatRing pct={ringPct} color={ringCol} />}
    </div>
  );
}

function AttentionRow({ item }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" color={SEVERITY_COLOR[item.severity] ?? C.red} />
      <div className="min-w-0">
        <span className="text-sm" style={{ color: C.ink }}>{item.label}</span>
        <span className="text-xs ml-2" style={{ color: C.muted }}>{item.detail}</span>
      </div>
    </div>
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

function CadenceBadge({ cadence }) {
  if (!cadence) return <span className="text-xs" style={{ color: C.muted }}>Not tracked</span>;
  if (cadence.overdue) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redBg, color: C.red }}>OVERDUE</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.greenBg, color: C.green }}>Due in {cadence.daysUntilDue}d</span>;
}

function CoverageBar({ pct, color }) {
  if (pct == null) return <span className="text-xs" style={{ color: C.muted }}>—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border, minWidth: 40 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color || C.accent }} />
      </div>
      <span className="text-xs tabular-nums w-9 text-right" style={{ color: C.muted }}>{pct}%</span>
    </div>
  );
}

function ControlRow({ row, onSelect }) {
  const meta = STATUS_META[row.status];
  const policy = POLICY_BY_CONTROL[row.control.id];
  return (
    <button
      onClick={() => onSelect(row)}
      className="w-full grid px-4 text-left hover:bg-white/[0.02] transition-colors"
      style={{ gridTemplateColumns: "90px 2fr 150px 150px", borderBottom: `1px solid ${C.border}` }}
    >
      <div className="py-3 text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.control.id}</div>
      <div className="py-3 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
        <div className="text-sm leading-snug" style={{ color: C.ink }}>{row.control.name}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
          {row.control.domain}{row.control.toolHint && <span> · Enforced by {row.control.toolHint}</span>}
        </div>
      </div>
      <div className="py-3 pl-3 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
          <meta.Icon size={11} /> {meta.label}
        </span>
        {row.keyControl && <RadioTower size={12} color={C.muted} />}
        {row.score != null && (
          <span className="text-[11px] ml-auto tabular-nums" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{row.score}</span>
        )}
      </div>
      <div className="py-3 pl-3 text-[11px] truncate" style={{ borderLeft: `1px solid ${C.border}`, color: C.muted }}>
        {policy ? policy.code : "—"}
      </div>
    </button>
  );
}

function ImplementationSection({ meta, rows, expanded, onToggle, onSelectRow }) {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
          <meta.Icon size={15} color={meta.color} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: C.ink }}>{meta.type}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.muted }}>{rows.length}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{meta.blurb}</div>
        </div>
        {expanded ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 2fr 150px 150px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <div>SCF #</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STATUS</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>GOVERNING POLICY</div>
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {rows.map((row) => <ControlRow key={row.control.id} row={row} onSelect={onSelectRow} />)}
            {rows.length === 0 && <div className="p-6 text-xs text-center" style={{ color: C.muted }}>No controls match this filter.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function POAMRow({ item }) {
  const meta = ticketMeta(item.status);
  const sevMeta = item.severity ? FINDING_SEVERITY_META[item.severity] : null;
  return (
    <div className="rounded-lg p-4 mb-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{item.title}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>Affected control: {item.controlName}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sevMeta && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sevMeta.color === "red" ? C.red : sevMeta.color === "amber" ? C.amber : C.muted, background: sevMeta.color === "red" ? C.redBg : sevMeta.color === "amber" ? C.amberBg : C.panel2 }}>
              {sevMeta.label.toUpperCase()}
            </span>
          )}
          {item.overdue && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, background: C.redBg }}>
              <AlertCircle size={11} /> OVERDUE
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2.5 text-xs flex-wrap">
        <span className="flex items-center gap-1" style={{ color: meta.color }}><Circle size={7} fill={meta.color} color={meta.color} /> {meta.label}</span>
        {item.source && item.source !== "control-gap" && (
          <span className="text-[11px]" style={{ color: C.muted }}>Source: {item.source.replace(/-/g, " ")}</span>
        )}
        <span className="flex items-center gap-1" style={{ color: C.muted }}><User size={11} /> {item.ownerName}</span>
        <span className="flex items-center gap-1" style={{ color: item.overdue ? C.red : C.muted }}><Clock size={11} /> Target {item.due}</span>
        <span className="flex items-center gap-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={11} /> {item.jira}</span>
      </div>
    </div>
  );
}

export default function SystemRegister() {
  const [systemId, setSystemId] = useState(DEFAULT_SYSTEM_ID);
  const [subTab, setSubTab] = useState(SUB_TABS[0].id);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [selectedRow, setSelectedRow] = useState(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const matrix = useMemo(() => systemControlMatrix(system.id), [system]);
  const referencedPolicies = useMemo(() => getReferencedPolicies(matrix), [matrix]);

  const cockpit = useMemo(() => cockpitSummary(system.id), [system]);
  const identity = useMemo(() => identityPostureForSystem(system.id), [system]);
  const exposure = useMemo(() => exposureForSystem(system.id), [system]);
  const secTests = useMemo(() => securityTestsForSystem(system.id), [system]);
  const ir = useMemo(() => irForSystem(system.id), [system]);
  const resilience = useMemo(() => resilienceForSystem(system.id), [system]);
  const vendors = useMemo(() => vendorsForSystem(system.id), [system]);
  const vuln = useMemo(() => vulnerabilitiesForSystem(system.id), [system]);
  const sdlc = useMemo(() => sdlcForSystem(system.id), [system]);
  const topRisks = useMemo(() => topRisksForSystem(system.id, 5), [system]);

  const domains = useMemo(() => {
    const set = new Set(matrix.map((r) => r.control.domain));
    return [...set].sort();
  }, [matrix]);

  const filtered = matrix.filter(
    (r) =>
      (domainFilter === "All" || r.control.domain === domainFilter) &&
      (statusFilter === "All" || r.status === statusFilter) &&
      (r.control.name.toLowerCase().includes(query.toLowerCase()) || r.control.id.toLowerCase().includes(query.toLowerCase()))
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    matrix.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [matrix]);

  function selectSystem(id) {
    setSystemId(id);
    setSubTab(SUB_TABS[0].id);
    setDomainFilter("All");
    setStatusFilter("All");
    setQuery("");
    setSelectedRow(null);
    setExpandedTypes(new Set());
  }

  function toggleType(type) {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const governingPolicy = selectedRow ? POLICY_BY_CONTROL[selectedRow.control.id] : null;
  const drawerClauses = selectedRow ? selectedRow.control.frameworks.filter((f) => system.standards.includes(f.standard)) : [];

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={ClipboardCheck}
        title={
          <span className="inline-flex items-center gap-3">
            {system.name}
            <ClassificationTag level={system.classification} />
            <AssuranceBadge pct={system.overallAssurance} />
          </span>
        }
        description="A complete view of this system's security posture — what it contains, how it's exposed, how it's protected, and what the evidence proves."
        descriptionClassName="max-w-none whitespace-nowrap"
        right={<SystemPicker systems={SYSTEMS} systemId={systemId} onSelect={selectSystem} />}
      />

      <TabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} variant="secondary" />

      <div className="pt-6" />

      {subTab === "overview" && (
      <>
      {/* ---- Assurance Cockpit --------------------------------------------------
          Lives at the top of Overview rather than its own tab — it's the
          at-a-glance status the rest of the numbered sections back up with
          detail, so it reads as the opening summary, not a peer section. */}
      <div className="px-8 pb-10">
        <SectionHeading icon={Gauge}>Assurance Cockpit</SectionHeading>
        <div className="grid grid-cols-4 gap-4 mb-5">
          <StatTile
            label="Assurance"
            value={cockpit.assurance ?? "—"}
            color={cockpit.assuranceBand?.color === "green" ? C.green : cockpit.assuranceBand?.color === "amber" ? C.amber : cockpit.assuranceBand?.color === "red" ? C.red : C.ink}
            sub={cockpit.assuranceBand?.label}
            pct={cockpit.assurance}
          />
          <StatTile label="Target" value={cockpit.target ?? "—"} sub={`${system.classification} tier`} pct={cockpit.target} muted />
          <StatTile
            label="Assessment Coverage"
            value={`${cockpit.coverage?.assessedPct ?? 0}%`}
            sub={`${cockpit.coverage?.assessed ?? 0} of ${cockpit.coverage?.applicable ?? 0} controls`}
            pct={cockpit.coverage?.assessedPct}
          />
          <StatTile
            label="Residual Risk"
            value={cockpit.residualRisk.top ? cockpit.residualRisk.top.residual.severity : "—"}
            color={cockpit.residualRisk.top?.residual.severity === "Severe" ? C.red : C.ink}
            sub={cockpit.residualRisk.top ? `Top of ${cockpit.residualRisk.count} scenarios` : "No mapped scenarios"}
            ring={cockpit.residualRisk.top ? (SEVERITY_LEVELS.indexOf(cockpit.residualRisk.top.residual.severity) + 1) * 25 : 0}
            ringColor={cockpit.residualRisk.top?.residual.severity === "Severe" ? C.red : C.amber}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.red }}>Attention Required</div>
            {cockpit.attentionRequired.length === 0 ? (
              <div className="text-sm" style={{ color: C.muted }}>Nothing outstanding.</div>
            ) : cockpit.attentionRequired.map((item, i) => <AttentionRow key={i} item={item} />)}
          </Panel>
          <Panel>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.green }}>Positive Assurance</div>
            {cockpit.positiveAssurance.length === 0 ? (
              <div className="text-sm" style={{ color: C.muted }}>Nothing proven yet.</div>
            ) : cockpit.positiveAssurance.map((item, i) => <PositiveRow key={i} item={item} />)}
          </Panel>
        </div>
      </div>

      {/* ---- 1. System Context ------------------------------------------------ */}
      <DocSection number="1" title="System Context" icon={Info}>
        <Panel className="grid grid-cols-4 gap-5">
          <IdentificationField label="System Name" value={system.name} />
          <IdentificationField label="System ID" value={system.id} />
          <IdentificationField label="Classification" value={system.classification} />
          <IdentificationField label="Hosting Environment" value={system.env} />
          <IdentificationField label="Availability Tier" value={system.availabilityTier.replace(/-/g, " ")} />
          <IdentificationField label="Internet Facing" value={system.internetFacing ? "Yes" : "No"} />
          <IdentificationField label="Users" value={system.userCount.toLocaleString()} />
          <IdentificationField label="Regions" value={system.regions.join(", ")} />
          <IdentificationField label="Compliance Standards In Scope" value={system.standards.join(", ")} />
          <div className="col-span-4">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Purpose</div>
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{system.mission}</div>
          </div>
          <div className="col-span-4">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Boundary</div>
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{system.boundary}</div>
          </div>
        </Panel>
      </DocSection>

      {/* ---- 2. Data ------------------------------------------------------------ */}
      <DocSection number="2" title="Data" icon={Database}>
        <Panel className="grid grid-cols-4 gap-5">
          <IdentificationField label="Data Types Processed" value={dataTypesForSystem(system.id).map((t) => t.name).join(", ")} />
          <IdentificationField label="Data Subjects" value={system.dataProfile.subjects.join(", ")} />
          <IdentificationField label="Approx. Records" value={system.dataProfile.approxRecords.toLocaleString()} />
          <IdentificationField label="Residency" value={system.dataProfile.residency.join(", ")} />
          <div className="col-span-4">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Retention</div>
            <div className="text-sm" style={{ color: C.ink }}>{system.dataProfile.retention}</div>
          </div>
          <div className="col-span-4 flex gap-2 flex-wrap">
            {[...new Set(dataTypesForSystem(system.id).flatMap((t) => t.regulatoryFlags))].map((f) => (
              <span key={f} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.accentBg, color: C.accent }}>{f}</span>
            ))}
            {dataTypesForSystem(system.id).every((t) => t.regulatoryFlags.length === 0) && (
              <span className="text-xs" style={{ color: C.muted }}>No regulated-data categories flagged.</span>
            )}
          </div>
        </Panel>
      </DocSection>
      </>
      )}

      {subTab === "security" && (
      <>
      {/* ---- 3. Identity & Access ------------------------------------------------ */}
      <DocSection number="3" title="Identity & Access" icon={Fingerprint}>
        <Panel>
          <div className="grid overflow-x-auto">
            <div className="grid text-[11px] font-medium pb-2 mb-2" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <div>Identity Type</div>
              <div className="text-right">Total</div>
              <div>SSO</div>
              <div>MFA</div>
              <div>Strong MFA</div>
              <div className="text-right">Dormant</div>
            </div>
            {identity.populations.map((p) => (
              <div key={p.id} className="grid items-center py-1.5" style={{ gridTemplateColumns: "1.2fr 90px 1fr 1fr 1fr 90px" }}>
                <div className="text-sm capitalize" style={{ color: C.ink }}>{p.identityType.replace(/-/g, " ")}</div>
                <div className="text-sm text-right tabular-nums" style={{ color: C.ink }}>{p.totalCount}</div>
                <div><CoverageBar pct={p.ssoCoveragePct} color={C.accent} /></div>
                <div><CoverageBar pct={p.mfaCoveragePct} color={C.amber} /></div>
                <div><CoverageBar pct={p.strongMfaCoveragePct} color={C.green} /></div>
                <div className="text-sm text-right tabular-nums" style={{ color: p.dormantCount > 0 ? C.amber : C.muted }}>{p.dormantCount}</div>
              </div>
            ))}
            {identity.populations.length === 0 && <div className="text-sm py-4" style={{ color: C.muted }}>No identity population is tracked for this system.</div>}
          </div>
          <div className="grid grid-cols-4 gap-4 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <IdentificationField label="Shared Accounts" value={identity.totals.shared} />
            <IdentificationField label="Local Accounts Bypassing SSO" value={identity.totals.localBypass} />
            <IdentificationField label="Accounts Awaiting Termination" value={identity.totals.awaitingTermination} />
            <div>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Last Access Review</div>
              {identity.review ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: C.ink }}>{identity.review.reviewedAt} · {identity.review.reviewedCount}/{identity.review.totalCount}</span>
                  <CadenceBadge cadence={identity.review.cadence} />
                </div>
              ) : <span className="text-sm" style={{ color: C.muted }}>None on record</span>}
            </div>
          </div>
        </Panel>
      </DocSection>

      {/* ---- 4. Exposure ---------------------------------------------------------- */}
      <DocSection number="4" title="Exposure / Attack Surface" icon={Globe}>
        <Panel>
          <div className="grid grid-cols-5 gap-5 mb-5">
            <IdentificationField label="Internet-Facing Services" value={exposure.externalServices.filter((s) => s.internetFacing).length} />
            <IdentificationField label="Externally Reachable" value={exposure.externallyReachableCount} />
            <IdentificationField label="Inbound Integrations" value={exposure.posture?.inboundIntegrationCount ?? "—"} />
            <IdentificationField label="Outbound Integrations" value={exposure.posture?.outboundIntegrationCount ?? "—"} />
            <IdentificationField label="Connected Vendors" value={vendors.vendors.length} />
          </div>
          <div className="grid grid-cols-3 gap-5 mb-5">
            <IdentificationField label="Egress Posture" value={exposure.posture?.egressPosture.replace(/-/g, " ") ?? "—"} />
            <IdentificationField label="Admin Posture" value={exposure.posture?.adminPosture.replace(/-/g, " ") ?? "—"} />
            <IdentificationField label="API Posture" value={exposure.posture?.apiPosture.replace(/-/g, " ") ?? "—"} />
          </div>
          <div className="space-y-1.5 mb-4">
            {exposure.externalServices.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                {s.kind === "admin-interface" ? <Crosshair size={12} color={C.muted} /> : <Globe size={12} color={C.muted} />}
                {s.name}
                <span className="text-xs" style={{ color: C.muted }}>({s.kind.replace(/-/g, " ")}{s.internetFacing ? ", internet-facing" : ", private"})</span>
                {!s.wafProtected && s.internetFacing && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.amberBg, color: C.amber }}>No WAF</span>}
              </div>
            ))}
          </div>
          {exposure.dangerousConditionsUnmitigated.length > 0 && (
            <div className="space-y-1 mb-3">
              {exposure.dangerousConditionsUnmitigated.map((c) => (
                <div key={c} className="flex items-center gap-2 text-sm" style={{ color: C.red }}><AlertTriangle size={12} /> {c.replace(/-/g, " ")}</div>
              ))}
            </div>
          )}
          {exposure.exceptions.map((e) => (
            <div key={e.id} className="rounded-lg p-3 mt-2" style={{ background: C.greenBg }}>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.green }}><CheckCircle2 size={12} /> {e.condition.replace(/-/g, " ")} — accepted</div>
              <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{e.reason}</div>
            </div>
          ))}
        </Panel>
      </DocSection>
      </>
      )}

      {subTab === "testing" && (
      <>
      {/* ---- 5. Security Testing --------------------------------------------------- */}
      <DocSection number="5" title="Security Testing" icon={Crosshair}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {["penetration-test", "red-team"].map((type) => {
            const latest = secTests.latestByType[type];
            return (
              <Panel key={type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{type === "penetration-test" ? "External Penetration Test" : "Red Team"}</div>
                  {latest && <CadenceBadge cadence={latest.cadence} />}
                </div>
                {latest ? (
                  <div className="space-y-1.5 text-sm" style={{ color: C.ink }}>
                    <div>Last completed <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{latest.completedAt}</span> · {latest.vendor}</div>
                    <div className="text-xs" style={{ color: C.muted }}>{latest.scope}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span style={{ color: latest.criticalFindingCount > 0 ? C.red : C.muted }}>Critical: {latest.criticalFindingCount}</span>
                      <span style={{ color: latest.highFindingCount > 0 ? C.amber : C.muted }}>High: {latest.highFindingCount}</span>
                      {type === "red-team" && latest.objectiveAchieved !== undefined && (
                        <span style={{ color: latest.objectiveAchieved ? C.green : C.red }}>Objective {latest.objectiveAchieved ? "achieved" : "not achieved"}</span>
                      )}
                    </div>
                  </div>
                ) : <div className="text-sm" style={{ color: C.muted }}>Never conducted.</div>}
              </Panel>
            );
          })}
        </div>
        {secTests.openFindings.length > 0 && (
          <div>
            <div className="text-xs mb-2" style={{ color: C.muted }}>Open findings from these exercises:</div>
            {secTests.openFindings.map((f) => <POAMRow key={f.id} item={f} />)}
          </div>
        )}
      </DocSection>

      {/* ---- 6. Incident Response --------------------------------------------------- */}
      <DocSection number="6" title="Incident Response" icon={Siren}>
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>IR Plan</div>
              {ir.planCurrency && <CadenceBadge cadence={ir.planCurrency.cadence} />}
            </div>
            <div className="text-sm" style={{ color: C.ink }}>{ir.planCurrency ? `Last reviewed ${ir.planCurrency.lastReviewedAt}` : "No plan on record"}</div>
            <div className="text-sm mt-3 pt-3" style={{ color: C.ink, borderTop: `1px solid ${C.border}` }}>Last production incident</div>
            <div className="text-sm" style={{ color: C.muted }}>
              {ir.lastIncident ? `${ir.lastIncident.occurredAt} · ${ir.lastIncident.severity} · lessons learned ${ir.lastIncident.lessonsLearnedComplete ? "complete" : "outstanding"}` : "None on record"}
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>Last Tabletop</div>
              {ir.lastTabletop && <CadenceBadge cadence={ir.lastTabletop.cadence} />}
            </div>
            {ir.lastTabletop ? (
              <div className="space-y-1.5 text-sm" style={{ color: C.ink }}>
                <div>{ir.lastTabletop.conductedAt} · {ir.lastTabletop.scenario}</div>
                <div className="text-xs" style={{ color: C.muted }}>{ir.lastTabletop.scope === "program" ? "Program-wide exercise" : "System-specific exercise"}</div>
                <div style={{ color: C.muted }}>Issues identified: {ir.lastTabletop.issuesIdentified}</div>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {ir.lastTabletop.participatingFunctions.map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.greenBg, color: C.green }}><CheckCircle2 size={9} className="inline mr-1" />{f.replace(/-/g, " ")}</span>
                  ))}
                  {["legal", "customer-comms"].filter((f) => !ir.lastTabletop.participatingFunctions.includes(f)).map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.amberBg, color: C.amber }}><AlertTriangle size={9} className="inline mr-1" />{f.replace(/-/g, " ")} not exercised</span>
                  ))}
                </div>
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No tabletop on record.</div>}
          </Panel>
        </div>
        {ir.openFindings.length > 0 && (
          <div className="mt-4">
            <div className="text-xs mb-2" style={{ color: C.muted }}>Open items from tabletop exercises:</div>
            {ir.openFindings.map((f) => <POAMRow key={f.id} item={f} />)}
          </div>
        )}
      </DocSection>

      {/* ---- 7. Resilience --------------------------------------------------------- */}
      <DocSection number="7" title="Resilience / Backup / Recovery" icon={LifeBuoy}>
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <div className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Backup Configuration</div>
            {resilience.backup ? (
              <div className="grid grid-cols-2 gap-4">
                <IdentificationField label="Enabled" value={resilience.backup.enabled ? "Yes" : "No"} />
                <IdentificationField label="Coverage" value={`${resilience.backup.coveragePct}%`} />
                <IdentificationField label="Immutable" value={resilience.backup.immutable ? "Yes" : "No"} />
                <IdentificationField label="Cross-Region" value={resilience.backup.crossRegion ? "Yes" : "No"} />
                <IdentificationField label="RPO Target" value={`${resilience.backup.rpoTargetMinutes}m`} />
                <IdentificationField label="RTO Target" value={`${resilience.backup.rtoTargetMinutes}m`} />
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No backup configuration on record.</div>}
          </Panel>
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: C.ink }}>Last Recovery Test</div>
              {resilience.lastDrTest && <CadenceBadge cadence={resilience.lastDrTest.cadence} />}
            </div>
            {resilience.lastDrTest ? (
              <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: C.ink }}>
                <IdentificationField label="Date" value={resilience.lastDrTest.conductedAt} />
                <IdentificationField label="Restore Successful" value={resilience.lastDrTest.restoreSuccessful ? "Yes" : "No"} />
                <IdentificationField label="Actual RPO" value={`${resilience.lastDrTest.actualRpoMinutes}m`} />
                <IdentificationField label="Actual RTO" value={`${resilience.lastDrTest.actualRtoMinutes}m`} />
                <div className="col-span-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: resilience.targetsMetLastTest ? C.greenBg : C.redBg, color: resilience.targetsMetLastTest ? C.green : C.red }}>
                    Targets {resilience.targetsMetLastTest ? "met" : "not met"}
                  </span>
                </div>
                {resilience.lastDrTest.issues && <div className="col-span-2 text-xs" style={{ color: C.amber }}>{resilience.lastDrTest.issues}</div>}
              </div>
            ) : <div className="text-sm" style={{ color: C.muted }}>No recovery test on record.</div>}
          </Panel>
        </div>
      </DocSection>

      {/* ---- 8. Vendor Assurance ------------------------------------------------------ */}
      <DocSection number="8" title="Vendor / Dependency Assurance" icon={Handshake}>
        <div className="space-y-3">
          {vendors.vendors.map((v) => (
            <Panel key={v.vendorId}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{v.vendor?.name ?? v.vendorId}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{v.dependency}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: C.panel2, color: C.muted }}>{v.criticality}</span>
                  {v.assurance && <CadenceBadge cadence={v.assurance.cadence} />}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: C.muted }}>
                <span>Reassessed: {v.assurance?.reassessedAt ?? "never"}</span>
                <span style={{ color: v.assurance?.sharedResponsibilityReviewed ? C.green : C.amber }}>
                  Shared responsibility {v.assurance?.sharedResponsibilityReviewed ? "reviewed" : "not reviewed"}
                </span>
                {v.assurance?.certification && <span>Backed by {v.assurance.certification.id}</span>}
                {v.dataAccessible.length > 0 && <span>Data: {v.dataAccessible.length} type{v.dataAccessible.length !== 1 ? "s" : ""} accessible</span>}
              </div>
            </Panel>
          ))}
          {vendors.vendors.length === 0 && <div className="text-sm" style={{ color: C.muted }}>No dependencies registered for this system.</div>}
        </div>
      </DocSection>
      </>
      )}

      {subTab === "security" && (
      <>
      {/* ---- 9. Vulnerability & Configuration --------------------------------------- */}
      <DocSection number="9" title="Vulnerability & Configuration" icon={Bug}>
        <Panel>
          {vuln ? (
            <>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <StatTile label="Critical" value={vuln.criticalCount} color={vuln.criticalCount > 0 ? C.red : C.green} />
                <StatTile label="High" value={vuln.highCount} color={vuln.highCount > 0 ? C.amber : C.green} />
                <StatTile label="Past SLA" value={vuln.pastSlaCount} color={vuln.pastSlaCount > 0 ? C.red : C.green} />
                <StatTile label="Patch SLA Compliance" value={`${vuln.patchSlaCompliancePct}%`} />
              </div>
              <div className="grid grid-cols-3 gap-5">
                <IdentificationField label="Configuration Findings" value={vuln.configFindingCount} />
                <IdentificationField label="Unsupported Components" value={vuln.unsupportedComponentCount} />
                <IdentificationField label="Internet-Facing Critical" value={vuln.internetFacingCriticalCount} />
              </div>
              <div className="text-[11px] mt-3" style={{ color: C.muted }}>As of {vuln.asOf}</div>
            </>
          ) : <div className="text-sm" style={{ color: C.muted }}>No vulnerability scan on record.</div>}
        </Panel>
      </DocSection>

      {/* ---- 10. Secure SDLC ---------------------------------------------------------- */}
      {sdlc?.applicable && (
        <DocSection number="10" title="Secure Development" icon={GitBranch}>
          <Panel className="grid grid-cols-4 gap-4">
            {[
              ["Branch Protection", sdlc.repoBranchProtection], ["PR Review Required", sdlc.prReviewRequired],
              ["SAST", sdlc.sastEnabled], ["SCA", sdlc.scaEnabled],
              ["Secret Scanning", sdlc.secretScanningEnabled], ["IaC Scanning", sdlc.iacScanningEnabled],
              ["CI/CD Identity Hardened", sdlc.cicdIdentityHardened], ["Deploy Approval Required", sdlc.deployApprovalRequired],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                {val ? <CheckCircle2 size={13} color={C.green} /> : <Circle size={13} color={C.red} />}
                <span className="text-sm" style={{ color: C.ink }}>{label}</span>
              </div>
            ))}
            <div className="col-span-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <IdentificationField label="Last Threat Model" value={sdlc.lastThreatModelAt ?? "None on record"} />
            </div>
          </Panel>
        </DocSection>
      )}
      {sdlc && !sdlc.applicable && (
        <DocSection number="10" title="Secure Development" icon={GitBranch}>
          <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.muted }}>Not applicable — {sdlc.notApplicableReason}</div>
        </DocSection>
      )}
      </>
      )}

      {subTab === "risk" && (
      <>
      {/* ---- 11. Risk ------------------------------------------------------------- */}
      <DocSection number="11" title="Top Risk Scenarios" icon={TrendingUp}>
        <div className="space-y-2">
          {topRisks.map((r) => (
            <div key={r.id} className="rounded-lg p-4 flex items-center justify-between gap-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.ink }}>{r.scenario}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{r.domain} · Owner: {r.owner}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-xs">
                <span style={{ color: r.residual.severity === "Severe" ? C.red : C.muted }}>Residual: {r.residual.severity} / {r.residual.likelihood}</span>
                <span style={{ color: C.muted }}>Control assurance: {r.assurance.pct ?? "—"}</span>
                <span className={r.appetiteRatio > 1 ? "font-semibold" : ""} style={{ color: r.appetiteRatio > 1 ? C.red : C.green }}>
                  {r.appetiteRatio}x appetite
                </span>
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <div className="text-sm" style={{ color: C.muted }}>No risk scenarios map to this system's assets.</div>}
        </div>
      </DocSection>
      </>
      )}

      {subTab === "overview" && (
      <>
      {/* ---- 12. Physical / Environmental ------------------------------------------ */}
      <DocSection number="12" title="Physical / Environmental" icon={Building2}>
        <div className="text-sm p-4 rounded-lg" style={{ background: C.panel2, color: C.ink }}>
          Hosting model: {system.hostingType}. Physical and environmental controls are inherited from {system.provider}'s own certification —
          see the Vendor / Dependency Assurance section above for what backs that claim. No ACME-operated facility is in scope for this system.
        </div>
      </DocSection>
      </>
      )}

      {subTab === "controls" && (
      <>
      {/* ---- 13. Control Assurance -------------------------------------------------- */}
      <DocSection number="13" title="Control Assurance" icon={Layers}>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div key={status} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="text-2xl font-semibold" style={{ color: meta.color, fontFamily: "'Source Serif 4', serif" }}>{statusCounts[status]}</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>{meta.label} · of {matrix.length} required</div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <Search size={14} color={C.muted} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search controls or SCF #" className="bg-transparent text-sm outline-none w-full" style={{ color: C.ink }} />
          </div>
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
            className="text-xs pl-3 pr-7 py-2 rounded-lg font-medium" style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}>
            <option value="All">All domains</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs pl-3 pr-7 py-2 rounded-lg font-medium" style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}>
            <option value="All">All statuses</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <span className="text-xs px-3 py-2 rounded-full" style={{ background: C.panel2, color: C.muted }}>
            Showing {filtered.length.toLocaleString()} of {matrix.length.toLocaleString()}
          </span>
        </div>

        {IMPLEMENTATION_META.map((meta) => (
          <ImplementationSection
            key={meta.type}
            meta={meta}
            rows={filtered.filter((r) => r.control.implementationType === meta.type)}
            expanded={expandedTypes.has(meta.type)}
            onToggle={() => toggleType(meta.type)}
            onSelectRow={setSelectedRow}
          />
        ))}

        <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: C.muted }}>
          <RadioTower size={12} /> marks the controls ACME tracks with live evidence; every other row is at the tier the Data Classification Register already reports, just broken out control by control. Implementation type is assigned per SCF domain, not audited per control.
        </div>
      </DocSection>
      </>
      )}

      {subTab === "overview" && (
      <>
      <DocSection number="14" title="Roles & Responsibilities" icon={Users2}>
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {system.roles.map((r, i) => (
            <div
              key={i}
              className="grid px-4 py-3"
              style={{ gridTemplateColumns: "220px 1fr", borderTop: i > 0 ? `1px solid ${C.border}` : "none", background: i % 2 ? "transparent" : C.panel2 }}
            >
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{r.role}</div>
              <div className="text-sm" style={{ color: C.muted }}>{r.assignment}</div>
            </div>
          ))}
        </div>
      </DocSection>
      </>
      )}

      {subTab === "risk" && (
      <>
      <DocSection number="15" title="Plan of Action & Milestones (POA&M)" icon={ListTodo}>
        <p className="text-xs mb-3" style={{ color: C.muted }}>
          Every control not yet fully implemented, with the planned remediation, the resource responsible, and a target date — pulled from ACME's live remediation tracker, not a static appendix.
        </p>
        {system.findings.length === 0 ? (
          <div className="text-sm p-4 rounded-lg" style={{ background: C.greenBg, color: C.green }}>
            No open items — every tracked control on this system is fully implemented.
          </div>
        ) : (
          system.findings.map((item) => <POAMRow key={item.id} item={item} />)
        )}
      </DocSection>
      </>
      )}

      {subTab === "overview" && (
      <>
      <DocSection number="16" title="Referenced Policies & Procedures" icon={BookOpen}>
        <p className="text-xs mb-3" style={{ color: C.muted }}>
          Every ACME policy that governs at least one control required for this system, computed from the control matrix above — not a separately maintained list that can drift out of sync.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {referencedPolicies.map(({ policy, count }) => (
            <div key={policy.id} className="flex items-center justify-between gap-2 rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{policy.code}</div>
                <div className="text-sm truncate" style={{ color: C.ink }}>{policy.title}</div>
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.muted }}>{count} control{count !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </DocSection>
      </>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedRow(null)} />
          <div className="relative w-[520px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{selectedRow.control.id} · {selectedRow.control.domain}</div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selectedRow.control.name}</h2>
                </div>
                <button onClick={() => setSelectedRow(null)}><X size={18} color={C.muted} /></button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {(() => {
                  const meta = STATUS_META[selectedRow.status];
                  return (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: meta.bg, color: meta.color }}>
                      <meta.Icon size={12} /> {meta.label}
                    </span>
                  );
                })()}
                {(() => {
                  const im = IMPLEMENTATION_META.find((m) => m.type === selectedRow.control.implementationType);
                  return (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: im.bg, color: im.color }}>
                      <im.Icon size={12} /> {im.type}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-lg p-3 mb-6" style={{ background: C.panel2 }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>SCF Control Description</div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selectedRow.control.description}</div>
              </div>

              {selectedRow.control.toolHint && (
                <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
                  <div className="text-sm" style={{ color: C.ink }}>{selectedRow.control.toolHint}</div>
                </div>
              )}

              <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Why this status</div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selectedRow.explanation}</div>
              </div>

              {selectedRow.assessment?.assessed && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>
                      Maturity Assessment
                    </div>
                    <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
                      {selectedRow.assessment.inherited ? "Inherited from provider" : "Assessed by ACME"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {PRISMA_LEVELS.map((level) => {
                      const L = selectedRow.assessment.levels[level];
                      return (
                        <div key={level} className="rounded p-2" style={{ background: C.panel }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold w-24 shrink-0" style={{ color: C.ink }}>{level}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                              <div className="h-full rounded-full" style={{ width: `${L.rating}%`, background: ratingColor(L.rating) }} />
                            </div>
                            <span className="text-[10px] w-28 shrink-0 text-right" style={{ color: C.muted }}>
                              {COMPLIANCE_LABELS[L.rating]}
                            </span>
                            <span className="text-xs font-semibold tabular-nums w-14 shrink-0 text-right" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                              {L.rating} ×{L.weight}
                            </span>
                          </div>
                          <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                            {L.rating !== L.derived && <span className="font-semibold" style={{ color: C.amber }}>Overridden from {L.derived}. </span>}
                            {L.rationale}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedRow.assessment.ladderInversions.length > 0 && (
                    <div className="text-[11px] mt-2" style={{ color: C.amber }}>
                      Rated above the level beneath it: {selectedRow.assessment.ladderInversions.join(", ")}.
                    </div>
                  )}
                </div>
              )}

              {selectedRow.instances.length > 0 && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                    Sampled assets — {selectedRow.keyControl?.friendlyName ?? selectedRow.control.name}
                  </div>
                  <div className="space-y-2">
                    {selectedRow.instances.map((inst) => (
                      <div key={`${inst.assetId}-${inst.controlId}`} className="rounded p-2" style={{ background: C.panel }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.ink }}>
                            {assetName(system, inst.assetId)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel2, color: C.muted }}>
                            {INSTANCE_STATUS_META[inst.status]?.label ?? inst.status}
                          </span>
                        </div>
                        <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{inst.statement}</div>
                        {inst.evidence.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: C.muted }}>
                            <Link2 size={10} />
                            <span className="min-w-0 truncate">
                              {e.source} · {e.result.toUpperCase()}
                              {e.exceptionRate != null && ` (${e.exceptions}/${e.population})`} · {e.coveragePct}%
                            </span>
                            <span className="shrink-0">{e.ageDays === 0 ? "today" : `${e.ageDays}d ago`}</span>
                            {e.stale && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.amberBg, color: C.amber }}>STALE</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {governingPolicy && (
                <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Governing Policy</div>
                  <div className="text-sm" style={{ color: C.ink }}>{governingPolicy.code} · {governingPolicy.title}</div>
                </div>
              )}

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
                Framework Clauses Satisfied ({system.standards.join(", ")})
              </div>
              <div className="rounded-lg" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3 py-1">
                  {drawerClauses.length === 0 && (
                    <div className="py-3 text-xs" style={{ color: C.muted }}>No direct clause mapping for this system's in-scope standards.</div>
                  )}
                  {drawerClauses.map((f, i) => (
                    <div key={i} className="py-2.5" style={{ borderBottom: i < drawerClauses.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <div className="text-xs font-medium mb-1" style={{ color: C.ink }}>{f.standard}</div>
                      <div className="text-[11px]" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{f.clauses.join(", ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
