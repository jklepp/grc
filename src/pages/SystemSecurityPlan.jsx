import React, { useMemo, useState } from "react";
import { ClipboardCheck, Search, X, Cloud, CheckCircle2, MinusCircle, Circle, RadioTower, Link2, Zap, UserCog, ScrollText, ChevronDown, ChevronRight } from "lucide-react";
import { C } from "../theme";
import { ClassificationTag, DataTypeChip, StandardChip } from "../components/SystemBadges";
import { SYSTEMS, getSystemControlMatrix, IMPLEMENTATION_TYPES } from "../data/systemRegister";
import { POLICIES } from "../data/policies";

// Every visible SCF control belongs to exactly one policy's domain set (verified
// when Policy Center was built — the 307 visible controls split cleanly across
// the 19 policies with zero overlap), so this lookup is always a single hit.
const POLICY_BY_CONTROL = {};
POLICIES.forEach((p) => p.controlIds.forEach((id) => { POLICY_BY_CONTROL[id] = p; }));

const RESTRICTED_SYSTEMS = SYSTEMS.filter((s) => s.classification === "Restricted");

const STATUS_META = {
  inherited: { label: "Inherited", color: C.green, bg: C.greenBg, Icon: Cloud },
  satisfied: { label: "Satisfied", color: C.accent, bg: C.accentBg, Icon: CheckCircle2 },
  gap: { label: "Open Gap", color: C.amber, bg: C.amberBg, Icon: MinusCircle },
  "not-implemented": { label: "Not Implemented", color: C.red, bg: C.redBg, Icon: Circle },
};
const STATUS_ORDER = ["inherited", "satisfied", "gap", "not-implemented"];

// Primary organizing structure for the matrix — how a control actually gets
// satisfied, not just which domain it's filed under. Order matters: it's the
// order sections render in.
const IMPLEMENTATION_META = [
  { type: IMPLEMENTATION_TYPES.AUTOMATED, Icon: Zap, color: C.accent, bg: C.accentBg, blurb: "Enforced continuously by tooling. Evidence is a system export or scan result, not a person's word." },
  { type: IMPLEMENTATION_TYPES.MANUAL, Icon: UserCog, color: C.amber, bg: C.amberBg, blurb: "Executed by a person on a recurring basis. Needs a named owner and a cadence, or it silently lapses." },
  { type: IMPLEMENTATION_TYPES.PROCESS, Icon: ScrollText, color: C.green, bg: C.greenBg, blurb: "Governed by policy, contract, or documented process. Evidenced by the record, not a system." },
];

function sourceLabel(source) {
  if (source === "vanta_test") return "Vanta automated test";
  if (source === "private_integration") return "Private integration test";
  return "Manually verified";
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
          {row.control.domain}{row.toolHint && <span> · Enforced by {row.toolHint}</span>}
        </div>
      </div>
      <div className="py-3 pl-3 flex items-center gap-2" style={{ borderLeft: `1px solid ${C.border}` }}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>
          <meta.Icon size={11} /> {meta.label}
        </span>
        {row.isTracked && <RadioTower size={12} color={C.muted} />}
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

export default function SystemSecurityPlan() {
  const [systemId, setSystemId] = useState(RESTRICTED_SYSTEMS[0].id);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());
  const [selectedRow, setSelectedRow] = useState(null);

  const system = RESTRICTED_SYSTEMS.find((s) => s.id === systemId);
  const matrix = useMemo(() => getSystemControlMatrix(system), [system]);

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
    const counts = { inherited: 0, satisfied: 0, gap: 0, "not-implemented": 0 };
    matrix.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [matrix]);

  function selectSystem(id) {
    setSystemId(id);
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
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
          <ClipboardCheck size={13} /> System Security Plan
        </div>
        <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>Restricted-Tier Control Matrix</h1>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          For each Restricted system, every applicable SCF control grouped by how it's actually satisfied — enforced by tooling, run by a person, or governed by policy — rather than one long list. The 6 controls ACME tracks directly show real evidence.
        </p>
      </div>

      <div className="px-8 grid grid-cols-3 gap-4 mb-6">
        {RESTRICTED_SYSTEMS.map((s) => {
          const active = s.id === systemId;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => selectSystem(s.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectSystem(s.id); }}
              className="text-left rounded-xl p-4 cursor-pointer"
              style={{ background: active ? C.accentBg : C.panel, border: `1px solid ${active ? C.accent : C.border}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ClassificationTag level={s.classification} />
                <span className="text-xs" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{s.id}</span>
              </div>
              <div className="text-sm font-semibold mb-1.5" style={{ color: C.ink }}>{s.name}</div>
              <div className="text-xs mb-2" style={{ color: C.muted }}>{s.env}</div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {s.dataTypes.map((t, i) => <DataTypeChip key={i} type={t} />)}
                {s.standards.map((std, i) => <StandardChip key={i} standard={std} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-8 grid grid-cols-4 gap-4 mb-6">
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

      <div className="px-8 pb-12">
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
            rows={filtered.filter((r) => r.implementationType === meta.type)}
            expanded={expandedTypes.has(meta.type)}
            onToggle={() => toggleType(meta.type)}
            onSelectRow={setSelectedRow}
          />
        ))}

        <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: C.muted }}>
          <RadioTower size={12} /> marks the 6 controls ACME tracks with live evidence; every other row is at the tier the Data Classification Register already reports, just broken out control by control. Implementation type is assigned per SCF domain, not audited per control.
        </div>
      </div>

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
                  const im = IMPLEMENTATION_META.find((m) => m.type === selectedRow.implementationType);
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

              {selectedRow.toolHint && (
                <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
                  <div className="text-sm" style={{ color: C.ink }}>{selectedRow.toolHint}</div>
                </div>
              )}

              {selectedRow.isTracked && selectedRow.trackedDetail && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>Tracked Evidence — {selectedRow.trackedName}</div>
                  <div className="text-xs" style={{ color: C.ink }}>{sourceLabel(selectedRow.trackedDetail.source)}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: C.muted }}>
                    <span>Verified {selectedRow.trackedDetail.age === 0 ? "today" : `${selectedRow.trackedDetail.age}d ago`}</span><span>·</span>
                    <span className="flex items-center gap-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}><Link2 size={10} /> {selectedRow.trackedDetail.evidenceRef}</span>
                    {selectedRow.trackedDetail.stale && <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(224,169,78,0.12)", color: C.amber }}>STALE</span>}
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
