import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, RadioTower, Layers, BookOpen, ShieldCheck } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { STATUS_META, STATUS_ORDER, IMPLEMENTATION_META, RESPONSIBILITY_META, APPLICABILITY_META } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";

function ControlRow({ row, onSelect }) {
  const meta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const policy = POLICY_BY_CONTROL[row.control.id];
  return (
    <button
      onClick={() => onSelect(row)}
      className="w-full grid px-4 text-left hover:bg-white/[0.02] transition-colors"
      style={{ gridTemplateColumns: "90px 2fr 150px 170px 150px", borderBottom: `1px solid ${C.border}` }}
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
      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
        {respMeta && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
            <respMeta.Icon size={11} /> {respMeta.label}
          </span>
        )}
      </div>
      <div className="py-3 pl-3 text-[11px] truncate" style={{ borderLeft: `1px solid ${C.border}`, color: C.muted }}>
        {policy ? policy.code : "—"}
      </div>
    </button>
  );
}

// Not Applicable and Pending controls, shown on demand — real rows with a
// real stated reason, not folded silently out of the page the way they were
// before this control had any representation at all.
function ExcludedControlList({ title, meta, items, getReason }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 text-left">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
          <meta.Icon size={15} color={meta.color} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: C.ink }}>{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.muted }}>{items.length}</span>
          </div>
        </div>
        {open ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, maxHeight: 360, overflowY: "auto" }}>
          {items.map((item) => {
            const control = item.control;
            return (
              <div key={control.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{control.id}</span>
                  <span className="text-sm" style={{ color: C.ink }}>{control.name}</span>
                </div>
                <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{getReason(item)}</div>
              </div>
            );
          })}
          {items.length === 0 && <div className="p-4 text-xs text-center" style={{ color: C.muted }}>None.</div>}
        </div>
      )}
    </div>
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
          <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 2fr 150px 170px 150px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <div>SCF #</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STATUS</div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>RESPONSIBILITY</div>
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

// What controls should exist, are they implemented, and can we prove them?
// Requirement → Control → Implementation → Evidence chain, drilled into via
// ControlDetailDrawer on row click.
export function SystemControls({
  matrix, statusCounts, filtered, domains, referencedPolicies,
  query, setQuery, domainFilter, setDomainFilter, statusFilter, setStatusFilter,
  expandedTypes, toggleType, onSelectRow,
  applicabilitySummary, posture,
}) {
  const resp = applicabilitySummary?.byResponsibility;
  return (
    <div className="px-8 pb-10 space-y-8">
      {applicabilitySummary && (
        <div>
          <SectionHeading icon={ShieldCheck}>Control Applicability</SectionHeading>
          <div className="rounded-xl p-5 mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex items-baseline gap-3 flex-wrap mb-4">
              <span className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{applicabilitySummary.total}</span>
              <span className="text-xs" style={{ color: C.muted }}>common controls</span>
              <span className="text-2xl font-semibold ml-4" style={{ color: C.accent, fontFamily: "'Source Serif 4', serif" }}>{applicabilitySummary.applicable}</span>
              <span className="text-xs" style={{ color: C.muted }}>applicable to this system</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { respKey: "internal", count: resp?.owned },
                { respKey: "shared", count: resp?.shared },
                { respKey: "enterprise", count: resp?.enterprise },
                { respKey: "vendor", count: resp?.vendor },
              ].map(({ respKey, count }) => {
                const meta = RESPONSIBILITY_META[respKey];
                return (
                  <div key={respKey} className="rounded-lg p-3" style={{ background: C.panel2 }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <meta.Icon size={12} color={meta.color} />
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>{meta.label}</span>
                    </div>
                    <div className="text-lg font-semibold" style={{ color: meta.color, fontFamily: "'Source Serif 4', serif" }}>{count}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
              <span><span className="font-semibold" style={{ color: C.ink }}>{applicabilitySummary.notApplicable}</span> Not Applicable</span>
              <span><span className="font-semibold" style={{ color: C.ink }}>{applicabilitySummary.pending}</span> Pending</span>
            </div>
          </div>

          {posture && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{posture.compliance}%</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Compliance — are applicable controls implemented</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{posture.assurance}%</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Assurance — confidence controls operate effectively</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{posture.coverage}%</div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>Assessment Coverage — have applicable controls been assessed</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <SectionHeading icon={Layers}>Controls</SectionHeading>
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
            onSelectRow={onSelectRow}
          />
        ))}

        <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: C.muted }}>
          <RadioTower size={12} /> marks the controls ACME tracks with live evidence; every other row is at the tier the Data Classification Register already reports, just broken out control by control. Implementation type is assigned per SCF domain, not audited per control.
        </div>
      </div>

      {applicabilitySummary && (
        <div>
          <ExcludedControlList
            title="Not Applicable"
            meta={APPLICABILITY_META["not-applicable"]}
            items={applicabilitySummary.notApplicableControls}
            getReason={(item) => item.reason}
          />
          <ExcludedControlList
            title="Pending"
            meta={APPLICABILITY_META.pending}
            items={applicabilitySummary.pendingControls}
            getReason={(item) => item.reason}
          />
        </div>
      )}

      <div>
        <SectionHeading icon={BookOpen}>Referenced Policies & Procedures</SectionHeading>
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
      </div>
    </div>
  );
}
