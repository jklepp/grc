import React from "react";
import { X, Link2, AlertTriangle, MapPin, FileCheck2, Wrench, Gauge } from "lucide-react";
import { C } from "../../theme";
import {
  PRISMA_LEVELS, COMPLIANCE_LABELS, findingsForSystem,
  FINDING_SEVERITY_META, FINDING_REMEDIATION_STATUS_META, BASIS_META,
  getEvidence, resolveProgramApplicability,
} from "../../engine";
import { STATUS_META, IMPLEMENTATION_META, RESPONSIBILITY_META, ratingColor, assetName, evidenceHealthForRow } from "./controlMeta";
import { POLICY_BY_CONTROL } from "./policyLookup";
import { BasisTag } from "../../components/BasisTag";

// Worst-rated PRISMA level for a control's assessment — the single sentence
// that best answers "what's wrong" or "what to improve" when no finding has
// been filed yet to answer it more concretely.
function worstLevel(assessment) {
  if (!assessment?.assessed) return null;
  return PRISMA_LEVELS.map((level) => assessment.levels[level]).sort((a, b) => a.rating - b.rating)[0];
}

// The single most urgent remediation status across a control's findings —
// Blocked beats In Progress beats Planned beats Complete — so the glance
// strip can show one badge instead of forcing a scroll to find out.
const REMEDIATION_URGENCY = ["Blocked", "In Progress", "Planned", "Complete"];
function mostUrgentRemediation(findings) {
  if (findings.length === 0) return null;
  return REMEDIATION_URGENCY.find((s) => findings.some((f) => f.remediationStatus === s)) ?? findings[0].remediationStatus;
}

function remediationBadgeStyle(colorKey) {
  return { background: C[`${colorKey}Bg`] ?? C.panel2, color: C[colorKey] ?? C.muted };
}

function GlancePill({ Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <Icon size={12} color={C.muted} className="shrink-0" />
      <span className="text-[9.5px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: color ?? C.ink }}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon size={13} color={C.accent} />}
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>{children}</div>
    </div>
  );
}

function EvidenceRow({ e, assetLabel, governing }) {
  return (
    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: C.muted }}>
      <Link2 size={10} className="shrink-0" />
      <span className="min-w-0 truncate">
        {assetLabel && <span style={{ color: C.ink }}>{assetLabel} · </span>}
        {e.source} · {e.result.toUpperCase()}
        {e.exceptionRate != null && ` (${e.exceptions}/${e.population})`} · {e.coveragePct}%
      </span>
      <span className="shrink-0">{e.ageDays === 0 ? "today" : `${e.ageDays}d ago`}</span>
      {e.stale && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.amberBg, color: C.amber }}>STALE</span>}
      {governing && <span className="font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.accentBg, color: C.accent }}>GOVERNING</span>}
    </div>
  );
}

// Right-side slide-over for a single control row's full detail. Organized as
// one narrative — What's wrong -> Where it's wrong -> What evidence proves it
// -> What should we improve -> How was it scored — followed by a reference
// block (description, policy, framework mappings) for what the control is.
export function ControlDetailDrawer({ row, system, onClose }) {
  if (!row) return null;

  const governingPolicy = POLICY_BY_CONTROL[row.control.id];
  const drawerClauses = row.control.frameworks.filter((f) => system.standards.includes(f.standard));
  const statusMeta = STATUS_META[row.status];
  const respMeta = RESPONSIBILITY_META[row.responsibility];
  const implMeta = IMPLEMENTATION_META.find((m) => m.type === row.control.implementationType);
  const controlFindings = findingsForSystem(system.id).filter((f) => f.controlId === row.control.id);
  const urgentRemediation = mostUrgentRemediation(controlFindings);
  const worst = worstLevel(row.assessment);
  const isProgramScoped = row.keyControl?.scope === "program";
  const programApplicability = isProgramScoped ? resolveProgramApplicability(system.id, row.control.id) : null;
  const evidenceHealth = evidenceHealthForRow(row);

  // Every instance's applicability reasons are usually identical (the same
  // rule matched every asset the same way) — say it once at the section
  // level instead of repeating the same sentence per asset.
  const applicabilityRationales = [...new Set(
    row.instances.flatMap((inst) => (inst.applicability?.reasons ?? []).map((r) => r.rationale))
  )];

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

          {/* Glance strip — the answer to all five questions in one row,
              before reading a word of prose below. */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <GlancePill Icon={FileCheck2} label="Evidence" value={evidenceHealth.label} color={evidenceHealth.color} />
            {urgentRemediation && (
              <GlancePill
                Icon={Wrench}
                label="Remediation"
                value={urgentRemediation}
                color={C[FINDING_REMEDIATION_STATUS_META[urgentRemediation]?.color] ?? C.ink}
              />
            )}
            {row.assessment?.assessed && (
              <GlancePill Icon={Gauge} label="Basis" value={BASIS_META[row.basis]?.label ?? row.basis} />
            )}
          </div>
        </div>

        <div className="p-6">
          {/* 1. What's wrong */}
          <div className="rounded-lg p-4 mb-6" style={{ background: controlFindings.length > 0 ? C.redBg : C.panel2, border: controlFindings.length > 0 ? `1px solid ${C.red}4D` : `1px solid ${C.border}` }}>
            <SectionLabel icon={AlertTriangle}>What's wrong</SectionLabel>
            {controlFindings.length > 0 ? (
              <div className="space-y-2">
                {controlFindings.map((f) => {
                  const severityMetaF = FINDING_SEVERITY_META[f.severity];
                  return (
                    <div key={f.id} className="rounded p-2" style={{ background: C.panel }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                        {severityMetaF && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: C.panel2, color: C.muted }}>{severityMetaF.label}</span>
                        )}
                      </div>
                      <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{f.detail}</div>
                      <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                        {assetName(system, f.assetId)}
                        {f.source && f.source !== "control-gap" && ` · Source: ${f.source.replace(/-/g, " ")}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : worst && worst.rating < 100 ? (
              <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                No finding has been filed yet. The assessment shows: {worst.rationale}
              </div>
            ) : (
              <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.explanation}</div>
            )}
          </div>

          {/* 2. Where it's wrong */}
          <div className="rounded-lg p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
            <SectionLabel icon={MapPin}>Where it's wrong</SectionLabel>
            {isProgramScoped ? (
              <div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                  Program-scoped — evaluated once for the whole {system.name} boundary, not per asset.
                </div>
                {programApplicability?.reasons?.length > 0 && (
                  <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>
                    {programApplicability.reasons.map((r) => r.rationale).join(" ")}
                  </div>
                )}
              </div>
            ) : row.instances.length > 0 ? (
              <div>
                {applicabilityRationales.length === 1 && (
                  <div className="text-[11px] mb-2 leading-snug" style={{ color: C.muted }}>
                    Applies because: {applicabilityRationales[0]}
                  </div>
                )}
                <div className="space-y-1.5">
                  {row.instances.map((inst) => (
                    <div key={`${inst.assetId}-${inst.controlId}`} className="rounded px-2.5 py-1.5" style={{ background: C.panel2 }}>
                      <span className="text-xs font-semibold" style={{ color: C.ink }}>{assetName(system, inst.assetId)}</span>
                      <span className="text-[11px] leading-snug" style={{ color: C.muted }}> — {inst.statement}</span>
                    </div>
                  ))}
                </div>
                {applicabilityRationales.length > 1 && (
                  <div className="text-[11px] mt-2 leading-snug" style={{ color: C.muted }}>
                    Applies for different reasons per asset: {applicabilityRationales.join(" · ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm" style={{ color: C.muted }}>No in-scope assets carry this control.</div>
            )}
          </div>

          {/* 3. What evidence proves it */}
          <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <SectionLabel icon={FileCheck2}>What evidence proves it</SectionLabel>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ml-auto" style={{ background: evidenceHealth.bg, color: evidenceHealth.color }}>
                {evidenceHealth.label}
              </span>
            </div>
            {row.instances.some((i) => i.evidence.length > 0) ? (
              <div className="space-y-1">
                {row.instances.flatMap((inst) =>
                  inst.evidence.map((e) => (
                    <EvidenceRow
                      key={e.id}
                      e={e}
                      assetLabel={assetName(system, inst.assetId)}
                      governing={inst.governing?.id === e.id}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="text-sm" style={{ color: C.muted }}>No evidence records are on file for this control.</div>
            )}
          </div>

          {/* 4. What should we improve */}
          <div className="rounded-lg p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
            <SectionLabel icon={Wrench}>What should we improve</SectionLabel>
            {controlFindings.length > 0 ? (
              <div className="space-y-3">
                {controlFindings.map((f) => {
                  const remMeta = FINDING_REMEDIATION_STATUS_META[f.remediationStatus];
                  return (
                    <div key={f.id} className="rounded p-2" style={{ background: C.panel2 }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: C.ink }}>{f.title}</span>
                        {remMeta && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={remediationBadgeStyle(remMeta.color)}>{remMeta.label}</span>
                        )}
                      </div>
                      {f.remediationPlan && (
                        <div className="text-[11px] mt-1 leading-snug" style={{ color: C.ink }}>{f.remediationPlan}</div>
                      )}
                      <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                        {f.remediationOwnerName ?? f.ownerName} · target {f.targetDate ?? f.due}{f.overdue && " · OVERDUE"}
                      </div>
                      {f.remediationStatus === "Complete" && (
                        <div className="text-[11px] mt-1" style={{ color: C.green }}>
                          Closed {f.closedDate}
                          {(f.closureEvidenceIds ?? []).length > 0 && (
                            <div className="mt-1">
                              {f.closureEvidenceIds.map((id) => {
                                const ev = getEvidence(id);
                                return ev ? <EvidenceRow key={id} e={ev} /> : null;
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : worst && worst.rating < 100 ? (
              <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                No remediation plan has been filed yet. Based on the assessment: {worst.rationale}
              </div>
            ) : (
              <div className="text-sm" style={{ color: C.muted }}>No outstanding remediation.</div>
            )}
          </div>

          {/* 5. How was it scored */}
          {row.assessment?.assessed && (
            <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <SectionLabel icon={Gauge}>How was it scored</SectionLabel>
                <span className="ml-auto"><BasisTag basis={row.basis} /></span>
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
                        <BasisTag basis={L.basis} />
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

          {/* Reference: what this control is, not part of the narrative above */}
          <div className="text-[10px] uppercase tracking-wide mb-3 mt-8 pt-4" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
            Control Reference
          </div>

          <div className="rounded-lg p-3 mb-4" style={{ background: C.panel2 }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>SCF Control Description</div>
            <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{row.control.description}</div>
          </div>

          {row.control.toolHint && (
            <div className="rounded-lg p-3 mb-4" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Enforced By</div>
              <div className="text-sm" style={{ color: C.ink }}>{row.control.toolHint}</div>
            </div>
          )}

          {governingPolicy && (
            <div className="rounded-lg p-3 mb-4" style={{ border: `1px solid ${C.border}` }}>
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
