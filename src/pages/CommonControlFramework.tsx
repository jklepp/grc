import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { Search, RefreshCw, LayoutGrid, ArrowLeft, Columns2 } from "lucide-react";
import { C } from "../theme";
import { useLiveEngine } from "../engine/useLiveEngine";
import { PageHeader } from "../components/Headings";
import { CrossCheckPane } from "../components/CrossCheckPane";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { STANDARD_ABBR } from "../data/policies";
import { IN_SCOPE_CONTROLS, getAllSystems } from "../engine";
import { controlLensView, type ControlLensView, type LensRequirement } from "../engine/frameworkLens";
import { hasSourceText, paragraphMarker, sourceClause, SOURCE_DOCUMENTS } from "../engine/sourceText";
import type { Control, ControlFramework } from "../graph/nodes/controls";

// The catalog side of the control model: every common control ACME has in scope,
// its domain, and the framework clauses it satisfies — independent of any one
// system's assessment. How a given system scores against these lives on that
// system's own Security Profile; this page answers "what do we have," not
// "how is any one boundary doing against it."
//
// The framework bar narrows what the page shows to what chosen frameworks ask
// for. It is off by default: a common control is the aggregation of every
// framework, so every control opens with all of its requirements.
const LIST_HEIGHT = 640;
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Source Serif 4', serif";

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

// Chips keep their place whatever the lens says; only their color changes, so
// the list doesn't reflow every time a framework is toggled.
function StandardChips({ frameworks, lens }: { frameworks: ControlFramework[]; lens: readonly string[] }) {
  if (frameworks.length === 0) return <span className="text-xs" style={{ color: C.muted }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {frameworks.map((f) => {
        const style = lens.length === 0
          ? { background: C.accentBg, color: C.accent }
          : lens.includes(f.standard)
            ? { background: C.accentStrong, color: "#FFFFFF" }
            : { background: "transparent", color: C.muted, boxShadow: `inset 0 0 0 1px ${C.border}` };
        return (
          <span key={f.standard} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={style}>
            {STANDARD_ABBR[f.standard] ?? f.standard}
          </span>
        );
      })}
    </div>
  );
}

// The catalog at a glance. Compact on purpose: the framework bar and the
// control list below are what the page is for.
function SummaryTile({ value, label, hint, children }: { value: ReactNode; label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4 min-w-0" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold" style={{ color: C.ink, fontFamily: SERIF }}>{value}</span>
          <span className="text-xs" style={{ color: C.muted }}>{label}</span>
        </div>
        {hint && <div className="text-[10px] mt-0.5 leading-snug" style={{ color: C.muted }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-xs font-semibold tracking-wider uppercase" style={{ color: C.muted }}>{children}</h3>;
}

function RequirementRow({ r }: { r: LensRequirement }) {
  return (
    <div className="flex gap-3.5 py-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
      <span className="w-6 shrink-0 text-right text-[13px] font-semibold leading-snug" style={{ color: C.accent, fontFamily: MONO }}>{r.number}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-snug" style={{ color: C.ink }}>{r.title}</div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{r.detail}</div>
      </div>
    </div>
  );
}

// A clause in the standard's own words, opened from its chip under Framework
// Mappings. Enclosing paragraphs come first so an implementation specification
// reads under the Standard it implements.
function ClauseText({ standard, clause, onClose }: { standard: string; clause: string; onClose: () => void }) {
  const hit = sourceClause(standard, clause);
  if (!hit) return null;
  const doc = SOURCE_DOCUMENTS[standard];
  const lines = [...hit.ancestors, hit.paragraph];
  return (
    <div className="mt-2 rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px]" style={{ color: C.accent, fontFamily: MONO }}>45 CFR {clause}</div>
          <div className="text-[11px]" style={{ color: C.muted }}>§ {hit.section.id} {hit.section.title}</div>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] underline shrink-0" style={{ color: C.accent }}>Close</button>
      </div>
      {lines.map((p) => {
        const target = p === hit.paragraph;
        return (
          <div key={p.id} className="mt-2 text-xs leading-relaxed" style={{ color: target ? C.ink : C.muted }}>
            <span style={{ fontFamily: MONO }}>{paragraphMarker(p)} </span>
            {p.heading && <span className="italic font-semibold">{p.heading} </span>}
            {p.text}
          </div>
        );
      })}
      <a href={doc.source} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[10px] underline" style={{ color: C.muted }}>
        eCFR, as of {doc.asOf}
      </a>
    </div>
  );
}

// One control, opened in the frame the control list occupies. Reading on the
// left (statement, requirements, what other frameworks would add); reference
// on the right (clause mappings, the SCF source text).
function ControlDetail({ control, view, lensActive, lensName, backLabel, onBack, onClearLens }: {
  control: Control;
  view: ControlLensView;
  lensActive: boolean;
  lensName: string;
  backLabel: string;
  onBack: () => void;
  onClearLens: () => void;
}) {
  const consolidated = CONSOLIDATED_CONTROLS[control.id];
  const backRef = useRef<HTMLButtonElement>(null);
  const [openClause, setOpenClause] = useState<{ standard: string; clause: string } | null>(null);
  const [crossCheckStd, setCrossCheckStd] = useState<string | null>(null);
  useEffect(() => { backRef.current?.focus(); setOpenClause(null); setCrossCheckStd(null); }, [control.id]);

  return (
    <section aria-labelledby="control-detail-title" className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="px-6 pt-4 pb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 -ml-2 mb-3"
          style={{ minHeight: 32, color: C.accent }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> {backLabel}
        </button>
        <div className="text-xs tracking-wide" style={{ color: C.accent, fontFamily: MONO }}>{control.id} · {control.domain}</div>
        <h2 id="control-detail-title" className="mt-1 text-[22px]" style={{ color: C.ink, fontFamily: SERIF, fontWeight: 600 }}>{control.name}</h2>
      </div>

      <div className="flex flex-wrap gap-6 px-6 py-5 items-start">
        <div className="flex flex-col gap-5 min-w-0" style={{ flex: "999 1 520px" }}>
          {lensActive ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: C.accentBg, border: `1px solid ${C.accent}` }}>
              <div className="text-[13px]">
                <span className="font-semibold" style={{ color: C.ink }}>{lensName}</span>
                <span style={{ color: C.muted }}>
                  {" · "}
                  {view.total > 0
                    ? `${view.shown.length} of ${view.total} requirements`
                    : view.reached ? "maps to this control" : "doesn't map to this control"}
                </span>
              </div>
              <button type="button" onClick={onClearLens} className="text-xs font-medium underline" style={{ color: C.accent }}>
                {view.total > 0 ? `Show all ${view.total}` : "Show all frameworks"}
              </button>
            </div>
          ) : null}

          {/* ACME's own statement of the control — the rubric a per-system
              assessment is judged against, shown here at the definition
              level rather than tied to any one boundary. */}
          <section>
            <SectionLabel>{consolidated ? "ACME Consolidated Control" : "Control description"}</SectionLabel>
            <div className="mt-1 py-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
              <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line" style={{ color: C.ink }}>{consolidated ? consolidated.statement : control.description}</p>
              {consolidated && lensActive && view.reached && (
                <p className="mt-2 mb-0 text-xs leading-relaxed" style={{ color: C.muted }}>
                  The statement describes the whole control. The requirements below are the parts {lensName} maps to.
                </p>
              )}
            </div>
          </section>

          {consolidated && (
            <section>
              <SectionLabel>Requirements</SectionLabel>
              <div className="mt-1">
                {view.shown.length > 0 ? (
                  view.shown.map((r) => <RequirementRow key={r.number} r={r} />)
                ) : (
                  <div className="rounded-lg p-4 mt-2 text-[13px] leading-relaxed" style={{ background: C.panel2 }}>
                    <div className="font-semibold" style={{ color: C.ink }}>{lensName} doesn't require anything from this control</div>
                    <div className="mt-1" style={{ color: C.muted }}>Clear the lens to see all {view.total} requirements.</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {view.outside.length > 0 && (
            <section className="rounded-xl px-4 py-4" style={{ border: `1px solid ${C.border}` }}>
              <SectionLabel>Outside {lensName}</SectionLabel>
              <p className="mt-1 mb-0 text-xs" style={{ color: C.muted }}>The rest of this control, grouped by the frameworks that would add it.</p>
              <div className="grid gap-4 mt-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {view.outside.map((g) => (
                  <div key={g.standard ?? "none"}>
                    <div className="text-[13px] font-semibold mb-1" style={{ color: C.ink }}>{g.standard ?? "No framework clause"}</div>
                    {g.requirements.map((r) => (
                      <div key={r.number} className="flex gap-2.5 py-1 text-xs leading-snug" style={{ color: C.muted }}>
                        <span className="w-6 shrink-0 text-right" style={{ fontFamily: MONO }}>{r.number}</span>
                        <span>{r.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 min-w-0" style={{ flex: "1 1 280px", maxWidth: 400 }}>
          {view.total > 0 && (
            <section>
              <SectionLabel>Coverage</SectionLabel>
              <div className="mt-1 py-3 flex items-baseline gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <span className="text-xl font-semibold" style={{ color: C.ink, fontFamily: SERIF }}>{view.total}</span>
                <span className="text-xs" style={{ color: C.muted }}>
                  requirements, mapped from {control.frameworks.length} framework{control.frameworks.length === 1 ? "" : "s"}
                </span>
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Framework Mappings</SectionLabel>
            {view.mappings.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: C.muted }}>No {lensName} clause maps to this control.</p>
            ) : view.mappings.map((f) => (
              <div key={f.standard} className="py-3 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[13px] font-semibold" style={{ color: C.ink }}>{f.standard}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: C.muted }}>{f.clauses.length} clause{f.clauses.length === 1 ? "" : "s"}</span>
                    {hasSourceText(f.standard) && (
                      <button
                        type="button"
                        onClick={() => setCrossCheckStd(f.standard)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
                        style={{ color: C.accent, border: `1px solid ${C.accent}` }}
                      >
                        <Columns2 size={12} aria-hidden="true" /> Cross-check
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.clauses.map((code) => {
                    if (!hasSourceText(f.standard)) {
                      return <span key={code} className="text-[11px] px-2 py-1 rounded" style={{ background: C.bg, color: C.ink, fontFamily: MONO }}>{code}</span>;
                    }
                    const on = openClause?.standard === f.standard && openClause.clause === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-expanded={on}
                        title="Read the source text"
                        onClick={() => setOpenClause(on ? null : { standard: f.standard, clause: code })}
                        className="text-[11px] px-2 py-1 rounded underline decoration-dotted underline-offset-2"
                        style={{ background: on ? C.accentStrong : C.bg, color: on ? "#FFFFFF" : C.accent, fontFamily: MONO }}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
                {hasSourceText(f.standard) && openClause?.standard === f.standard && (
                  <ClauseText standard={f.standard} clause={openClause.clause} onClose={() => setOpenClause(null)} />
                )}
                {hasSourceText(f.standard) && openClause?.standard !== f.standard && (
                  <div className="text-[10px] mt-1.5" style={{ color: C.muted }}>Select a clause to read the source text.</div>
                )}
              </div>
            ))}
          </section>

          {crossCheckStd && (
            <CrossCheckPane control={control} standard={crossCheckStd} onClose={() => setCrossCheckStd(null)} />
          )}

          {consolidated && (
            <section className="rounded-xl p-4" style={{ background: C.panel2 }}>
              <div className="text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: C.muted }}>Original catalog description</div>
              <p className="m-0 text-xs leading-relaxed whitespace-pre-line" style={{ color: C.ink }}>{control.description}</p>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function CommonControlFramework() {
  // IN_SCOPE_CONTROLS is an `export let` the engine reassigns on publish().
  // Captured at module scope it froze against the first engine; read here it
  // follows every commit, which is also why it belongs in the deps below.
  const liveEngine = useLiveEngine();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const CONTROLS = useMemo(() => IN_SCOPE_CONTROLS, [liveEngine]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const SYSTEMS = useMemo(() => getAllSystems(), [liveEngine]);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [lens, setLens] = useState<string[]>([]);
  const [systemId, setSystemId] = useState("");

  // The list stays mounted (hidden) while a control is open, so search and
  // domain survive the round trip; scroll position is saved and put back.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  // Each domain with the SCF id prefixes it holds (some hold several, e.g.
  // Governance: CPL/GOV/IAO/PRM) and its control count.
  const domains = useMemo(() => {
    const byDomain = new Map<string, { prefixes: Set<string>; count: number }>();
    for (const c of CONTROLS) {
      const d = byDomain.get(c.domain) ?? { prefixes: new Set<string>(), count: 0 };
      d.prefixes.add(c.id.split("-")[0]);
      d.count++;
      byDomain.set(c.domain, d);
    }
    return [...byDomain.entries()]
      .map(([name, d]) => ({ name, prefixes: [...d.prefixes].sort().join("/"), count: d.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [CONTROLS]);

  const standards = useMemo(() => {
    const set = new Set(CONTROLS.flatMap((c) => c.frameworks.map((f) => f.standard)));
    return [...set].sort();
  }, [CONTROLS]);

  const views = useMemo(() => new Map(CONTROLS.map((c) => [c.id, controlLensView(c, lens)])), [CONTROLS, lens]);
  const lensActive = lens.length > 0;
  const lensName = joinNames(lens);

  // Under a lens the sidebar keeps only domains the lens reaches, counting the
  // reached controls in each. A picked domain the lens hides falls back to All.
  const domainsInView = useMemo(() => {
    if (!lensActive) return domains;
    const reached = new Map<string, number>();
    for (const c of CONTROLS) if (views.get(c.id)?.reached) reached.set(c.domain, (reached.get(c.domain) ?? 0) + 1);
    return domains.filter((d) => reached.has(d.name)).map((d) => ({ ...d, count: reached.get(d.name) ?? 0 }));
  }, [domains, lensActive, CONTROLS, views]);
  const domainsInViewTotal = domainsInView.reduce((sum, d) => sum + d.count, 0);
  const activeDomain = domainFilter === "All" || domainsInView.some((d) => d.name === domainFilter) ? domainFilter : "All";

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return CONTROLS.filter(
      (c) =>
        (activeDomain === "All" || c.domain === activeDomain) &&
        (c.name?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q))
    );
  }, [query, activeDomain, CONTROLS]);
  const reachedCount = filtered.filter((c) => views.get(c.id)?.reached).length;

  const open = openId ? CONTROLS.find((c) => c.id === openId) ?? null : null;
  const openView = open ? views.get(open.id) : undefined;

  const openControl = (id: string) => {
    savedScroll.current = listScrollRef.current?.scrollTop ?? 0;
    setOpenId(id);
  };
  const backToList = () => setOpenId(null);
  useLayoutEffect(() => {
    if (!open && listScrollRef.current) listScrollRef.current.scrollTop = savedScroll.current;
  }, [open]);

  const pickDomain = (name: string) => {
    setDomainFilter(name);
    setOpenId(null);
    savedScroll.current = 0;
  };

  const applyLens = (next: string[], fromSystem = "") => {
    setLens(next);
    setSystemId(fromSystem);
  };
  const toggleStandard = (std: string) =>
    applyLens(lens.includes(std) ? lens.filter((s) => s !== std) : [...lens, std]);
  const pickSystem = (id: string) => {
    const system = SYSTEMS.find((s) => s.id === id);
    // A system's standards can name frameworks the crosswalk doesn't carry
    // (Workday's GDPR); the lens can only filter by ones it does.
    applyLens(system ? system.standards.filter((s) => standards.includes(s)) : [], system ? id : "");
  };

  const domainButton = (key: string, label: ReactNode, count: number, active: boolean, onClick: () => void, first = false) => (
    <button
      key={key}
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs"
      style={{ background: active ? C.panel2 : "transparent", color: active ? C.accent : C.ink, borderTop: first ? "none" : `1px solid ${C.border}` }}
    >
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <span className="shrink-0" style={{ color: C.muted, fontFamily: MONO }}>{count}</span>
    </button>
  );

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={LayoutGrid}
        title="Common Controls"
        right={
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <RefreshCw size={12} /> Imported from Secure Controls Framework 2026.1
          </div>
        }
      />

      <div className="px-4 lg:px-8 pb-12 flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SummaryTile value={standards.length} label="Standards mapped">
            <div className="flex flex-wrap justify-end gap-1 max-w-[220px]">
              {standards.map((s) => (
                <span key={s} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.greenBg, color: C.green }}>
                  {STANDARD_ABBR[s] ?? s}
                </span>
              ))}
            </div>
          </SummaryTile>
          <SummaryTile value={domains.length} label="Control domains" hint="Every control domain with at least one control in ACME's scope." />
          <SummaryTile value={CONTROLS.length} label="Common controls" hint="The full in-scope common-control set, before any system-specific assessment." />
        </div>

        <section
          aria-label="Framework lens"
          className="rounded-xl flex flex-wrap items-center gap-1.5 py-2 pl-3.5 pr-2.5"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
        >
          <span className="text-xs font-semibold mr-1.5" style={{ color: C.muted }}>Framework</span>
          <div role="group" aria-label="Frameworks" className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {standards.map((s) => {
              const on = lens.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStandard(s)}
                  className="text-xs font-medium px-2.5 rounded-full"
                  style={{
                    minHeight: 30,
                    background: on ? C.accentStrong : C.panel,
                    color: on ? "#FFFFFF" : C.ink,
                    border: `1px solid ${on ? C.accent : C.border}`,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {lensActive && (
              <button type="button" onClick={() => applyLens([])} className="text-xs font-medium px-2 underline" style={{ minHeight: 30, color: C.accent }}>
                Clear
              </button>
            )}
            <select
              aria-label="Match a system's frameworks"
              value={systemId}
              onChange={(e) => pickSystem(e.target.value)}
              className="text-xs font-medium pl-3 pr-8 rounded-lg outline-none"
              style={{ minHeight: 30, background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
            >
              <option value="">Any system</option>
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </section>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
          <nav aria-label="Control domains" className="w-full lg:w-72 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
            <div className="p-3 flex items-center justify-between text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <span>CONTROL DOMAINS</span><span style={{ fontFamily: MONO }}>{lensActive ? `${domainsInView.length} of ${domains.length}` : domains.length}</span>
            </div>
            {domainButton("All", <span className="font-medium">All domains</span>, domainsInViewTotal, activeDomain === "All", () => pickDomain("All"), true)}
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {domainsInView.map((d) =>
                domainButton(
                  d.name,
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="shrink-0 text-[10px]" style={{ color: activeDomain === d.name ? C.accent : C.muted, fontFamily: MONO }}>{d.prefixes}</span>
                    <span className="truncate">{d.name}</span>
                  </span>,
                  d.count,
                  activeDomain === d.name,
                  () => pickDomain(d.name),
                )
              )}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <div hidden={!!open}>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <Search size={14} color={C.muted} aria-hidden="true" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search controls or SCF #" aria-label="Search controls" className="bg-transparent text-sm outline-none w-full" style={{ color: C.ink }} />
                </label>
                <span className="text-xs px-3 py-2 rounded-full" style={{ background: C.panel2, color: C.muted }}>
                  {lensActive
                    ? `${reachedCount} of ${filtered.length} reached by ${lensName}`
                    : `Showing ${filtered.length.toLocaleString()} of ${CONTROLS.length.toLocaleString()}`}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 2fr 1.4fr", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                  <div>SCF #</div>
                  <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
                  <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STANDARDS MAPPED</div>
                </div>
                <div ref={listScrollRef} style={{ maxHeight: LIST_HEIGHT, overflowY: "auto" }}>
                  {filtered.map((control) => {
                    const v = views.get(control.id);
                    const reached = v?.reached ?? true;
                    const total = v?.total ?? 0;
                    // Always one line, so toggling the lens never changes row height.
                    const countText = !lensActive
                      ? (total > 0 ? `${total} requirements` : "No itemized requirements")
                      : !reached
                        ? `Not required by ${lensName}`
                        : total > 0 ? `${v?.shown.length ?? 0} of ${total} requirements` : "Whole control";
                    return (
                      <button
                        key={control.id}
                        type="button"
                        onClick={() => openControl(control.id)}
                        className="grid px-4 w-full text-left"
                        style={{ gridTemplateColumns: "90px 2fr 1.4fr", borderBottom: `1px solid ${C.border}` }}
                      >
                        <div className="pt-3 pb-3">
                          <div className="text-xs" style={{ color: reached ? C.accent : C.muted, fontFamily: MONO }}>{control.id}</div>
                        </div>
                        <div className="pt-3 pb-3 pl-3 pr-2 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                          <div className="text-sm leading-snug" style={{ color: reached ? C.ink : C.muted }}>{control.name}</div>
                          <div className="text-[10px] mt-1" style={{ color: C.muted }}>{control.domain}</div>
                          <div className="text-[10px] mt-1" style={{ color: C.muted, fontStyle: reached ? "normal" : "italic" }}>{countText}</div>
                        </div>
                        <div className="flex items-center pl-3 pr-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                          <StandardChips frameworks={control.frameworks} lens={lens} />
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="px-4 py-6 text-xs" style={{ color: C.muted }}>No controls match.</div>
                  )}
                </div>
              </div>
            </div>

            {open && openView && (
              <ControlDetail
                control={open}
                view={openView}
                lensActive={lensActive}
                lensName={lensName}
                backLabel={activeDomain === "All" ? "Back to controls" : `Back to ${activeDomain}`}
                onBack={backToList}
                onClearLens={() => applyLens([])}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
