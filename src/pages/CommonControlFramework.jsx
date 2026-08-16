import React, { useState, useMemo } from "react";
import { Search, X, ChevronDown, ChevronRight, RefreshCw, LayoutGrid, UserX } from "lucide-react";
import { C } from "../theme";
import { PageHeader } from "../components/Headings";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { STANDARD_ABBR } from "../data/policies";
import {
  getAllSystems, systemControlMatrix, PRISMA_LEVELS, COMPLIANCE_LABELS,
  INSTANCE_STATUS_META, assuranceBand,
} from "../engine";

// This page was the last purely decorative surface in the app. It listed all
// 323 in-scope SCF controls with a clause count in the Status column, an
// "UNOWNED" badge on every single row because ccfControls.js hardcoded
// owner: null, and a banner admitting that implementation and evidence "aren't
// defined yet." It imported nothing from the engine and produced no number.
//
// It is now where the assessment actually reads. Every row is one control
// assessed against one system across the five PRISMA levels, and the three
// things the old page couldn't say — who owns it, what it scores, and why —
// all come off that assessment.
const SYSTEMS = getAllSystems();

const LIST_HEIGHT = 640;

// The compliance scale, coloured. Deliberately not assuranceBand's thresholds:
// a level rating is a five-point ordinal judgment, not a 0-100 score, and
// running it through a score band would imply precision it does not carry.
function ratingColor(rating) {
  if (rating === 100) return C.green;
  if (rating === 75) return C.accent;
  if (rating >= 25) return C.amber;
  return C.red;
}

const STATUS_META = {
  satisfied: { label: "Satisfied", color: "accent" },
  partial: { label: "Partial", color: "amber" },
  deficient: { label: "Deficient", color: "red" },
  "not-implemented": { label: "Not Implemented", color: "red" },
  inherited: { label: "Inherited", color: "green" },
  unassessed: { label: "Not in Scope", color: "muted" },
};

function StatusTag({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.unassessed;
  const muted = meta.color === "muted";
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ background: muted ? C.panel2 : `${C[meta.color]}26`, color: muted ? C.muted : C[meta.color] }}
    >
      {meta.label}
    </span>
  );
}

// Five segments, one per PRISMA level, each as wide as its weight and as filled
// as its rating. The shape of the bar is the shape of the score: Implemented is
// visibly the widest block because it carries 40% of it.
function PrismaBar({ assessment }) {
  if (!assessment?.assessed) {
    return <div className="h-2 rounded-full" style={{ background: C.panel2 }} title="Not in the declared assessment scope" />;
  }
  return (
    <div className="flex gap-0.5 h-2" title={PRISMA_LEVELS.map((l) => `${l} ${assessment.levels[l].rating}`).join(" · ")}>
      {PRISMA_LEVELS.map((level) => {
        const L = assessment.levels[level];
        return (
          <div key={level} className="rounded-sm overflow-hidden" style={{ flexGrow: L.weight * 100, background: C.panel2 }}>
            <div className="h-full" style={{ width: `${L.rating}%`, background: ratingColor(L.rating) }} />
          </div>
        );
      })}
    </div>
  );
}

function OwnerTag({ owners }) {
  if (!owners || owners.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: C.redBg, color: C.red }}>
        <UserX size={10} /> UNOWNED
      </span>
    );
  }
  return <span className="text-xs" style={{ color: C.muted }}>{owners.map((o) => o.name).join(", ")}</span>;
}

function FrameworkMappingLine({ f }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <span className="w-12 shrink-0 font-semibold" style={{ color: C.accent }}>{STANDARD_ABBR[f.standard] ?? f.standard}</span>
      <span className="flex-1 min-w-0 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {f.clauses.join(", ")}
      </span>
    </div>
  );
}

function Tile({ value, label, hint }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>{label}</div>
      {hint && <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{hint}</div>}
    </div>
  );
}

export default function CommonControlFramework() {
  const [systemId, setSystemId] = useState(SYSTEMS[0]?.id);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [openFramework, setOpenFramework] = useState(null);

  const system = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0];
  const rows = useMemo(() => systemControlMatrix(system.id), [system.id]);

  // Domains, counted against THIS system's applicable set rather than the whole
  // catalogue — the rail should agree with the table beside it.
  const domains = useMemo(() => {
    const counts = {};
    rows.forEach((r) => {
      counts[r.control.domain] ||= { name: r.control.domain, total: 0, assessed: 0 };
      counts[r.control.domain].total += 1;
      if (r.score != null) counts[r.control.domain].assessed += 1;
    });
    return Object.values(counts).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (domainFilter === "All" || r.control.domain === domainFilter) &&
          (scopeFilter === "All" ||
            (scopeFilter === "Assessed" && r.score != null) ||
            (scopeFilter === "Not in scope" && r.score == null)) &&
          (r.control.name?.toLowerCase().includes(query.toLowerCase()) ||
            r.controlId?.toLowerCase().includes(query.toLowerCase()))
      ),
    [rows, query, domainFilter, scopeFilter]
  );

  const cov = system.coverage;
  const band = assuranceBand(system.overallAssurance);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={LayoutGrid}
        title="Common Controls"
        tagline="Unified Compliance Matrix"
        right={
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <RefreshCw size={12} /> Imported from Secure Controls Framework 2026.1
          </div>
        }
      />

      <div className="px-8 flex items-center gap-2 mb-4 flex-wrap">
        {SYSTEMS.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSystemId(s.id); setDomainFilter("All"); setSelected(null); }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: s.id === system.id ? C.accentBg : C.panel,
              color: s.id === system.id ? C.accent : C.muted,
              border: `1px solid ${s.id === system.id ? C.accent : C.border}`,
            }}
          >
            {s.name}
            <span className="ml-2 text-[11px]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s.overallAssurance}</span>
          </button>
        ))}
      </div>

      <div className="px-8 grid grid-cols-4 gap-4 mb-5">
        <Tile
          value={system.overallAssurance}
          label={`${band.label} — ${system.name} assurance`}
          hint={`Assurance categories weighted by the ${system.classification} profile.`}
        />
        <Tile
          value={`${cov.assessedPct}%`}
          label="Assessment coverage"
          hint={`${cov.assessed} of ${cov.applicable} applicable controls. The rest are reported as unassessed, never scored as zero.`}
        />
        <Tile
          value={cov.inherited}
          label={`Inherited from ${system.provider}`}
          hint="Scored from the provider's certification, held below what ACME could claim for a control it verified itself."
        />
        <Tile
          value={cov.unassessed}
          label="Outside the assessment scope"
          hint={system.assessments.length > 0 ? "Applicable, and not examined by this engagement." : ""}
        />
      </div>

      <div className="px-8 flex gap-5 pb-12">
        <div className="w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          <div className="p-3 flex items-center justify-between text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <span>CONTROL DOMAINS ({domains.length})</span><span>{rows.length}</span>
          </div>
          <button
            onClick={() => setDomainFilter("All")}
            className="w-full flex items-center justify-between px-3 py-2 text-sm"
            style={{ background: domainFilter === "All" ? C.panel2 : "transparent", color: domainFilter === "All" ? C.accent : C.ink }}
          >
            <span>Show All Domains</span>
            <span className="text-xs" style={{ color: C.muted }}>{rows.length}</span>
          </button>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {domains.map((d) => (
              <button
                key={d.name}
                onClick={() => setDomainFilter(d.name)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs"
                style={{ background: domainFilter === d.name ? C.panel2 : "transparent", color: domainFilter === d.name ? C.accent : C.muted, borderTop: `1px solid ${C.border}` }}
              >
                <span className="truncate pr-2">{d.name}</span>
                {/* assessed / applicable, so the rail shows where the coverage
                    actually is rather than only how big each domain is. */}
                <span className="shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{d.assessed}/{d.total}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <Search size={14} color={C.muted} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search controls or SCF #" className="bg-transparent text-sm outline-none w-full" style={{ color: C.ink }} />
            </div>
            {["All", "Assessed", "Not in scope"].map((f) => (
              <button
                key={f}
                onClick={() => setScopeFilter(f)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: scopeFilter === f ? C.accentBg : C.panel,
                  color: scopeFilter === f ? C.accent : C.muted,
                  border: `1px solid ${scopeFilter === f ? C.accent : C.border}`,
                }}
              >
                {f}
              </button>
            ))}
            <span className="text-xs px-3 py-2 rounded-full" style={{ background: C.panel2, color: C.muted }}>
              Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
            </span>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 1.6fr 130px 1.4fr 130px 60px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <div>SCF #</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>OWNER</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>MATURITY</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STATUS</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>SCORE</div>
            </div>
            <div style={{ maxHeight: LIST_HEIGHT, overflowY: "auto" }}>
              {filtered.map((row) => (
                <button
                  key={row.controlId}
                  onClick={() => { setSelected(row); setOpenFramework(null); }}
                  className="grid px-4 w-full text-left"
                  style={{ gridTemplateColumns: "90px 1.6fr 130px 1.4fr 130px 60px", borderBottom: `1px solid ${C.border}` }}
                >
                  <div className="pt-3 pb-3">
                    <div className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{row.controlId}</div>
                  </div>
                  <div className="pt-3 pb-3 pl-3 pr-2 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <div className="text-sm leading-snug" style={{ color: row.score == null ? C.muted : C.ink }}>{row.control.name}</div>
                    <div className="text-[10px] mt-1" style={{ color: C.muted }}>{row.control.domain}</div>
                  </div>
                  <div className="flex items-center pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <OwnerTag owners={row.assessment?.owners} />
                  </div>
                  <div className="flex items-center pl-3 pr-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <div className="w-full"><PrismaBar assessment={row.assessment} /></div>
                  </div>
                  <div className="flex items-center pl-3" style={{ borderLeft: `1px solid ${C.border}` }}><StatusTag status={row.status} /></div>
                  <div className="flex items-center pl-3 text-sm font-semibold" style={{ borderLeft: `1px solid ${C.border}`, color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {row.score ?? "—"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-[640px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {selected.controlId} · {selected.control.domain} · {system.name}
                  </div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.control.name}</h2>
                </div>
                <button onClick={() => setSelected(null)}><X size={18} color={C.muted} /></button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StatusTag status={selected.status} />
                {selected.score != null && (
                  <span className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{selected.score}</span>
                )}
              </div>
              <div className="mt-3"><OwnerTag owners={selected.assessment?.owners} /></div>
            </div>

            <div className="p-6">
              {/* The five levels, and what each one stood on. This block is what
                  replaced the banner admitting nothing was defined yet. */}
              {selected.assessment?.assessed ? (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>Maturity Assessment</div>
                    <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
                      {selected.assessment.inherited ? `Inherited from ${system.provider}` : "Assessed by ACME"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {PRISMA_LEVELS.map((level) => {
                      const L = selected.assessment.levels[level];
                      return (
                        <div key={level} className="rounded p-2" style={{ background: C.panel }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold w-24 shrink-0" style={{ color: C.ink }}>{level}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                              <div className="h-full rounded-full" style={{ width: `${L.rating}%`, background: ratingColor(L.rating) }} />
                            </div>
                            <span className="text-[10px] w-28 shrink-0 text-right" style={{ color: C.muted }}>{COMPLIANCE_LABELS[L.rating]}</span>
                            <span className="text-xs font-semibold tabular-nums w-16 shrink-0 text-right" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
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
                  {selected.assessment.ladderInversions.length > 0 && (
                    <div className="text-[11px] mt-2" style={{ color: C.amber }}>
                      Rated above the level beneath it: {selected.assessment.ladderInversions.join(", ")}. HITRUST rates the five
                      levels independently, so this is reported rather than clamped.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.muted }}>Not in the assessment scope</div>
                  <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                    This control applies to {system.name} and was not part of the declared engagement. It is reported as
                    unassessed rather than scored zero — nobody looking is a different fact from looking and finding nothing.
                  </div>
                </div>
              )}

              {/* The sampling population behind the Implemented level. */}
              {selected.instances?.length > 0 && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                    Sampled assets — {selected.instances.length} in this boundary
                  </div>
                  <div className="space-y-1.5">
                    {selected.instances.map((inst) => {
                      const meta = INSTANCE_STATUS_META[inst.status];
                      const muted = meta.color === "muted";
                      return (
                        <div key={inst.assetId} className="rounded p-2" style={{ background: C.panel }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.ink }}>{inst.asset.name}</span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                              style={{ color: muted ? C.muted : C[meta.color], background: muted ? "transparent" : C[`${meta.color}Bg`] }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{inst.statement}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACME's own statement of the control. Shown as the RUBRIC the
                  levels above were rated against — 939 hand-written requirement
                  bullets across 194 statements, which is exactly the material an
                  assessor argues a rating from. Displayed, never scored. */}
              {CONSOLIDATED_CONTROLS[selected.controlId] && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                    ACME Consolidated Control — what the ratings above were judged against
                  </div>
                  <div className="text-sm leading-relaxed mb-4" style={{ color: C.ink }}>{CONSOLIDATED_CONTROLS[selected.controlId].statement}</div>
                  <div className="space-y-2.5">
                    {CONSOLIDATED_CONTROLS[selected.controlId].requirements.map((r, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="text-xs font-semibold shrink-0 w-4" style={{ color: C.accent }}>{i + 1}.</span>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: C.ink }}>{r.title}</div>
                          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{r.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg p-3 mb-6" style={{ background: C.panel2 }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                  {CONSOLIDATED_CONTROLS[selected.controlId] ? "Original SCF Description" : "SCF Control Description"}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selected.control.description}</div>
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Framework Mappings</div>
              <div className="rounded-lg mb-2" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3">
                  {selected.control.frameworks.map((f, i) => {
                    const isOpen = openFramework === i;
                    return (
                      <div key={i} style={{ borderBottom: i < selected.control.frameworks.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <button onClick={() => setOpenFramework(isOpen ? null : i)} className="w-full flex items-center gap-3 py-2.5 text-left">
                          {isOpen ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
                          <div className="w-24 shrink-0 text-xs font-medium" style={{ color: C.ink }}>{f.standard}</div>
                          <div className="flex-1 text-[11px]" style={{ color: C.muted }}>{f.clauses.length} clause{f.clauses.length !== 1 ? "s" : ""} mapped</div>
                        </button>
                        {isOpen && (
                          <div className="pb-3 pl-7 pr-2 space-y-1.5">
                            {f.clauses.map((code, ci) => (
                              <div key={ci} className="flex items-center justify-between rounded p-2" style={{ background: C.bg }}>
                                <span className="text-xs" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{code}</span>
                                <span className="text-[10px]" style={{ color: C.muted }}>Mapped</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.control.frameworks.length > 0 && (
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  <FrameworkMappingLine f={selected.control.frameworks[0]} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
