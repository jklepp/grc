import React, { useState } from "react";
import { Search, X, AlertCircle, CheckCircle2, Circle, MinusCircle, Clock, User, RefreshCw, Link2, Lock, ScrollText } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { ClassificationTag, DataTypeChip, StandardChip, SourceBadge } from "../components/SystemBadges";
import { SYSTEMS, CONTROLS, controlBreakdown } from "../data/systemRegister";

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
