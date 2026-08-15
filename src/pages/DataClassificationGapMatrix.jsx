import React, { useState } from "react";
import {
  Search, X, AlertCircle, CheckCircle2, Circle, MinusCircle, Clock, User, RefreshCw, Link2, Lock, ScrollText, ShieldCheck,
  Users, HeartPulse, DollarSign, FileText, KeyRound, Activity, Briefcase, Megaphone, Sparkles,
} from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, DataTypeChip, StandardChip, SourceBadge } from "../components/SystemBadges";
import {
  getAllSystems, systemCoverageBreakdown, systemStandardMappings, dataTypesForSystem,
  criticalityBand, assuranceBand, riskBand, ASSURANCE_TARGET, ADEQUATE_THRESHOLD, tierTargetScore,
} from "../engine";

const SYSTEMS = getAllSystems();

const DATA_ELEMENT_ICON = {
  pii: Users,
  phi: HeartPulse,
  financial: DollarSign,
  documents: FileText,
  secrets: KeyRound,
  telemetry: Activity,
  employee: Briefcase,
  marketing: Megaphone,
  modelData: Sparkles,
  metadata: Activity,
  auditLog: ScrollText,
};

// Every control in scope now resolves to one of these five states, each of
// which means something specific. The previous four (Inherited / Satisfied /
// Open Gaps / Not Implemented) were produced by applying six tracked controls'
// compliant-to-gap ratio to the full 323-control total, so the split was a
// proportion of a sample presented as a count of the whole. "Assessed" is the
// new one and by far the largest: controls with no individual implementation,
// covered by the system's category-level assessment. It's a weaker claim than
// Satisfied, and showing it as its own state is the point.
const SUMMARY_COLUMNS = [
  { key: "required", label: "Required Controls", color: () => C.ink },
  { key: "inherited", label: "Inherited from Provider", color: () => C.green },
  { key: "satisfied", label: "Measured & Satisfied", color: () => C.accent },
  { key: "assessed", label: "Assessed at Category", color: () => C.muted },
  { key: "deficient", label: "Deficient", color: () => C.red },
];

function ownerFor(system) {
  return system.roles?.find((r) => r.role === "System Owner")?.assignment ?? "—";
}

// The coarse tags this column used to carry as a hand-typed `dataTypes: ["PII"]`
// on the system. Derived now from the data types its assets actually hold, so a
// system that starts handling a new category is tagged for it without anyone
// remembering to add the string.
function dataTags(system) {
  const types = dataTypesForSystem(system.id);
  const tags = new Set();
  types.forEach((t) => {
    if (t.kind === "pii" || t.kind === "employee") tags.add("PII");
    t.regulatedBy.forEach((r) => tags.add(r));
  });
  return [...tags];
}

// A system row reads straight off the system rollup now. It used to average
// its own assets locally here — correct, but a second implementation of a
// rollup the engine also performs, so the two could diverge. Assurance is also
// criticality-weighted in the engine rather than a flat mean, so a weak
// critical asset can no longer be offset by a healthy peripheral one.
function systemAssetRollup(system) {
  return {
    criticality: system.criticality,
    assurance: system.overallAssurance,
    evidenceConfidence: system.evidenceConfidence,
    residualScore: system.residualScore,
  };
}

function ScoreTile({ label, value, band }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color: band ? C[band.color] : C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
    </div>
  );
}

function DataTypeTile({ item }) {
  const Icon = DATA_ELEMENT_ICON[item.kind] || FileText;
  return (
    <div className="rounded-lg p-3 flex items-center gap-2.5" style={{ background: C.panel2 }}>
      <div className="shrink-0 rounded-md p-1.5" style={{ background: C.accentBg }}>
        <Icon size={14} color={C.accent} />
      </div>
      <span className="text-xs font-medium" style={{ color: C.ink }}>{item.name}</span>
    </div>
  );
}

// Collapses riskBand()'s real 5-tier scale (Critical/High/Moderate/Low/Minimal)
// into the 3 states this column shows, without inventing new thresholds.
function systemRiskMeta(residualScore) {
  const band = riskBand(residualScore);
  if (band.label === "Critical") return { label: "High", color: band.color };
  if (band.label === "Minimal") return { label: "Low", color: band.color };
  return band;
}

function statusMeta(status) {
  if (status === "compliant" || status === "full") return { color: C.green, bg: C.greenBg, Icon: CheckCircle2, label: "Compliant" };
  if (status === "partial") return { color: C.amber, bg: C.amberBg, Icon: MinusCircle, label: "Partial" };
  if (status === "gap") return { color: C.red, bg: C.redBg, Icon: Circle, label: "Gap" };
  return { color: C.muted, bg: C.panel2, Icon: Circle, label: "N/A" };
}
function ticketMeta(status) {
  if (status === "closed") return { color: C.green, label: "Closed" };
  if (status === "verified") return { color: C.green, label: "Verified" };
  if (status === "remediating") return { color: C.accent, label: "Remediating" };
  if (status === "accepted") return { color: C.amber, label: "Accepted" };
  return { color: C.red, label: "Open" };
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
  const { color, label } = ticketMeta(item.status);
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
      <div className="text-xs mt-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{item.controlName}</div>
      <div className="flex items-center gap-4 mt-2.5 text-xs flex-wrap">
        <span className="flex items-center gap-1" style={{ color }}><Circle size={7} fill={color} color={color} /> {label}</span>
        <span className="flex items-center gap-1" style={{ color: C.muted }}><User size={11} /> {item.ownerName}</span>
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

  // Gaps and stale evidence are now counted from real control implementations
  // and their evidence records, not from a six-element status array whose
  // position had to line up with a separate array of control names.
  const systemsWithGaps = SYSTEMS.filter((s) => s.deficientControls.length > 0).length;
  const totalOverdue = SYSTEMS.flatMap((s) => s.findings).filter((r) => r.overdue).length;
  const totalOpenItems = SYSTEMS.flatMap((s) => s.findings).filter((r) => r.status !== "closed").length;
  const staleCount = SYSTEMS.reduce((a, s) => a + s.staleEvidenceCount, 0);
  const selectedBreakdown = selected ? systemCoverageBreakdown(selected.id) : null;
  const selectedRoll = selected ? systemAssetRollup(selected) : null;
  const selectedCoveragePct = selectedBreakdown ? selectedBreakdown.coveredPct : null;
  const selectedTarget = selected ? tierTargetScore(selected.classification) : null;
  const selectedRisk = selectedRoll ? systemRiskMeta(selectedRoll.residualScore) : null;

  function openSystem(s) {
    setSelected(s);
    setDrawerStandard(s.standards[0]);
    setOpenReq(null);
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={ShieldCheck}
        title="Systems Register"
        tagline="Data Classification Policy v3.2 · Confidential & Restricted"
        description="Systems handling data classified Confidential or Restricted under policy, evaluated against the six controls required for their tier. Status reflects live test results — this view does not modify Vanta or Jira."
        right={
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <Lock size={12} /><span>Read-only</span><span style={{ color: C.border }}>|</span><RefreshCw size={12} /><span>Synced from Vanta · 8 min ago</span>
          </div>
        }
      />

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
          <div className="grid" style={{ gridTemplateColumns: "320px 170px repeat(4, 1fr)" }}>
            <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }} />
            {["Owner", "Criticality", "Assurance", "Target", "Risk"].map((label) => (
              <div key={label} className="p-3 text-center text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, color: C.muted }}>{label}</div>
            ))}
            {filtered.map((s) => {
              const roll = systemAssetRollup(s);
              const critColor = C[criticalityBand(roll.criticality).color];
              const assureColor = C[assuranceBand(roll.assurance).color];
              const target = tierTargetScore(s.classification);
              const risk = systemRiskMeta(roll.residualScore);
              const riskColor = C[risk.color];
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => openSystem(s)} className="p-4 text-left hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ClassificationTag level={s.classification} />
                      <div className="text-sm font-medium" style={{ color: C.ink }}>{s.name}</div>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{s.id} · {s.env}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {dataTags(s).map((t, i) => <DataTypeChip key={i} type={t} />)}
                      <SourceBadge syncSource={s.syncSource} />
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {s.standards.map((std, i) => <StandardChip key={i} standard={std} />)}
                    </div>
                  </button>
                  <div className="cursor-pointer flex items-center px-3" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }} onClick={() => openSystem(s)}>
                    <span className="text-sm truncate" style={{ color: C.ink }}>{ownerFor(s)}</span>
                  </div>
                  <div className="cursor-pointer flex flex-col items-center justify-center gap-1.5" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }} onClick={() => openSystem(s)}>
                    <span className="text-sm font-semibold" style={{ color: critColor, fontFamily: "'IBM Plex Mono', monospace" }}>{roll.criticality}</span>
                    <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                      <div className="h-full rounded-full" style={{ width: `${roll.criticality}%`, background: critColor }} />
                    </div>
                  </div>
                  <div className="cursor-pointer flex flex-col items-center justify-center gap-1.5" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }} onClick={() => openSystem(s)}>
                    <span className="text-sm font-semibold" style={{ color: assureColor, fontFamily: "'IBM Plex Mono', monospace" }}>{roll.assurance}</span>
                    <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                      <div className="h-full rounded-full" style={{ width: `${roll.assurance}%`, background: assureColor }} />
                    </div>
                  </div>
                  <div className="cursor-pointer flex items-center justify-center" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }} onClick={() => openSystem(s)}>
                    <span className="text-sm font-semibold" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{target}</span>
                  </div>
                  <div className="cursor-pointer flex items-center justify-center gap-1.5" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }} onClick={() => openSystem(s)}>
                    <Circle size={7} fill={riskColor} color={riskColor} />
                    <span className="text-xs font-semibold" style={{ color: riskColor }}>{risk.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div className="text-xs mt-3" style={{ color: C.muted }}>
          Criticality and Assurance are averaged across each system's own assets from the Asset Register. Target is the assurance score a system's classification tier requires at full effectiveness against its Required Control Profile. Risk is each system's average residual risk across those same assets. Click a row for the full CCF rollup and control detail.
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
                {dataTags(selected).map((t, i) => <DataTypeChip key={i} type={t} />)}
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

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Data Types</div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {dataTypesForSystem(selected.id).map((item) => <DataTypeTile key={item.id} item={item} />)}
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Score</div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <ScoreTile label="Criticality" value={selectedRoll.criticality} band={criticalityBand(selectedRoll.criticality)} />
                <ScoreTile label="Required Assurance" value={selectedTarget} />
                <ScoreTile label="Assurance" value={selectedRoll.assurance} band={assuranceBand(selectedRoll.assurance)} />
                <ScoreTile label="Evidence Confidence" value={selectedRoll.evidenceConfidence} band={assuranceBand(selectedRoll.evidenceConfidence)} />
                <ScoreTile
                  label="Compliance Coverage"
                  value={`${selectedCoveragePct}%`}
                  band={selectedCoveragePct >= ASSURANCE_TARGET ? { label: "Strong", color: "green" } : selectedCoveragePct >= ADEQUATE_THRESHOLD ? { label: "Adequate", color: "amber" } : { label: "Weak", color: "red" }}
                />
                <ScoreTile label="Residual Risk" value={selectedRisk.label} band={selectedRisk} />
              </div>

              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: C.muted }}>Framework Requirements</div>
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {selected.standards.map((std) => (
                  <StandardChip key={std} standard={std} active={drawerStandard === std} onClick={() => { setDrawerStandard(std); setOpenReq(null); }} />
                ))}
              </div>
              <div className="rounded-lg mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3">
                  {systemStandardMappings(selected.id, drawerStandard).map((m, i) => (
                    <RequirementRow key={i} mapping={m} isOpen={openReq === i} onToggle={() => setOpenReq(openReq === i ? null : i)} />
                  ))}
                </div>
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
                Remediation Items {selected.findings.length > 0 && `(${selected.findings.length})`}
              </div>
              {selected.findings.length === 0 ? (
                <div className="text-sm p-4 rounded-lg" style={{ background: C.greenBg, color: C.green }}>
                  No open remediation items — this system is fully compliant.
                </div>
              ) : (
                selected.findings.map((r) => <RemediationRow key={r.id} item={r} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
