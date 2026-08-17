import React from "react";
import { X, Link2 } from "lucide-react";
import { C } from "../../theme";
import { PRISMA_LEVELS, COMPLIANCE_LABELS, INSTANCE_STATUS_META, findingsForSystem, FINDING_STATUS_META, FINDING_SEVERITY_META } from "../../engine";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";

// Right-side slide-over for a single control row's full detail — the primary
// drill-down experience for Controls: requirement, applicability,
// implementation, evidence, and framework mappings in one place.
export function ControlDetailDrawer({ row, system, onClose }) {
  if (!row) return null;

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const drawerClauses = row.control.frameworks.filter((f) => system.standards.includes(f.standard));
  const statusMeta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const implMeta = IMPLEMENTATION_META.find((m) => m.type === row.control.implementationType);
  const controlFindings = findingsForSystem(system.id).filter((f) => f.controlId === row.control.id);

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[520px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
        <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.control.id} · {row.control.domain}</div>
              <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{row.control.name}</h2>
            </div>
            <button onClick={onClose}><X size={18} color={C.muted} /></button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>
              <statusMeta.Icon size={12} /> {statusMeta.label}
            </span>
            {respMeta && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
                <respMeta.Icon size={12} /> {respMeta.label}
              </span>
            )}
            {implMeta && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: implMeta.bg, color: implMeta.color }}>
                <implMeta.Icon size={12} /> {implMeta.type}
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-lg p-3 mb-6" style={{ background: C.panel2 }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>SCF Control Description</div>
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.control.description}</div>
          </div>

          {row.control.toolHint && (
            <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
              <div className="text-sm" style={{ color: C.ink }}>{row.control.toolHint}</div>
            </div>
          )}

          <div className="rounded-lg p-3 mb-6" style={{ border: `1px solid ${C.border}` }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Why this status</div>
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.explanation}</div>
          </div>

          {row.assessment?.assessed && (
            <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>
                  Maturity Assessment
                </div>
                <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
                  {row.assessment.inherited ? "Inherited from provider" : "Assessed by ACME"}
                </span>
              </div>
              <div className="space-y-2">
                {PRISMA_LEVELS.map((level) => {
                  const L = row.assessment.levels[level];
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
              {row.assessment.ladderInversions.length > 0 && (
                <div className="text-[11px] mt-2" style={{ color: C.amber }}>
                  Rated above the level beneath it: {row.assessment.ladderInversions.join(", ")}.
                </div>
              )}
            </div>
          )}

          {row.instances.length > 0 && (
            <div className="rounded-lg p-4 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
              <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                Sampled assets — {row.keyControl?.friendlyName ?? row.control.name}
              </div>
              <div className="space-y-2">
                {row.instances.map((inst) => (
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

          {controlFindings.length > 0 && (
            <div className="rounded-lg p-4 mb-6" style={{ background: C.redBg, border: `1px solid ${C.red}4D` }}>
              <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.red }}>
                Findings — {row.control.id}
              </div>
              <div className="space-y-2">
                {controlFindings.map((f) => {
                  const statusMetaF = FINDING_STATUS_META[f.status];
                  const severityMetaF = FINDING_SEVERITY_META[f.severity];
                  return (
                    <div key={f.id} className="rounded p-2" style={{ background: C.panel }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                        {severityMetaF && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel2, color: C.muted }}>{severityMetaF.label}</span>
                        )}
                        {statusMetaF && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel2, color: C.muted }}>{statusMetaF.label}</span>
                        )}
                      </div>
                      <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                        {assetName(system, f.assetId)} · owner {f.ownerName} · due {f.due}{f.overdue && " · OVERDUE"}
                      </div>
                    </div>
                  );
                })}
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
  );
}
