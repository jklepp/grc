import React, { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { Search, X, ChevronDown, ChevronRight, RefreshCw, LayoutGrid } from "lucide-react";
import { C } from "../theme";
import { useLiveEngine } from "../engine/useLiveEngine";
import { PageHeader } from "../components/Headings";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { STANDARD_ABBR } from "../data/policies";
import { IN_SCOPE_CONTROLS, getAllSystems } from "../engine";
import { controlLensView, type LensRequirement } from "../engine/frameworkLens";
import type { Control, ControlFramework } from "../graph/nodes/controls";

// The catalog side of the control model: every common control ACME has in scope,
// its domain, and the framework clauses it satisfies — independent of any one
// system's assessment. How a given system scores against these lives on that
// system's own Security Profile; this page answers "what do we have," not
// "how is any one boundary doing against it."
//
// The Framework Lens narrows what the page shows to what chosen frameworks ask
// for. It is off by default: a common control is the aggregation of every
// framework, so every control opens with all of its requirements.
const LIST_HEIGHT = 640;

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

function FrameworkMappingLine({ f }: { f: ControlFramework }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <span className="w-12 shrink-0 font-semibold" style={{ color: C.accent }}>{STANDARD_ABBR[f.standard] ?? f.standard}</span>
      <span className="flex-1 min-w-0 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {f.clauses.join(", ")}
      </span>
    </div>
  );
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

function Tile({ value, label, hint, children }: { value: ReactNode; label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>{label}</div>
      {hint && <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{hint}</div>}
      {children}
    </div>
  );
}

function StandardCard({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg text-center" style={{ background: C.greenBg, color: C.green }}>
      {label}
    </span>
  );
}

function RequirementRow({ r }: { r: LensRequirement }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-xs font-semibold shrink-0 w-5 text-right" style={{ color: C.accent }}>{r.number}.</span>
      <div>
        <div className="text-xs font-semibold" style={{ color: C.ink }}>{r.title}</div>
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{r.detail}</div>
      </div>
    </div>
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
  const [selected, setSelected] = useState<Control | null>(null);
  const [openFramework, setOpenFramework] = useState<number | null>(null);
  const [lens, setLens] = useState<string[]>([]);
  const [systemId, setSystemId] = useState("");

  const domains = useMemo(() => {
    const counts: Record<string, number> = {};
    CONTROLS.forEach((c) => { counts[c.domain] = (counts[c.domain] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [CONTROLS]);

  const standards = useMemo(() => {
    const set = new Set(CONTROLS.flatMap((c) => c.frameworks.map((f) => f.standard)));
    return [...set].sort();
  }, [CONTROLS]);

  const filtered = useMemo(
    () =>
      CONTROLS.filter(
        (c) =>
          (domainFilter === "All" || c.domain === domainFilter) &&
          (c.name?.toLowerCase().includes(query.toLowerCase()) || c.id?.toLowerCase().includes(query.toLowerCase()))
      ),
    [query, domainFilter, CONTROLS]
  );

  const views = useMemo(() => new Map(CONTROLS.map((c) => [c.id, controlLensView(c, lens)])), [CONTROLS, lens]);
  const lensActive = lens.length > 0;
  const lensName = joinNames(lens);

  const applyLens = (next: string[], fromSystem = "") => {
    setLens(next);
    setSystemId(fromSystem);
    setOpenFramework(null);
  };
  const toggleStandard = (std: string) =>
    applyLens(lens.includes(std) ? lens.filter((s) => s !== std) : [...lens, std]);
  const pickSystem = (id: string) => {
    const system = SYSTEMS.find((s) => s.id === id);
    // A system's standards can name frameworks the crosswalk doesn't carry
    // (Workday's GDPR); the lens can only filter by ones it does.
    applyLens(system ? system.standards.filter((s) => standards.includes(s)) : [], system ? id : "");
  };

  const view = selected ? views.get(selected.id) : undefined;

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

      <div className="px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="shrink-0">
            <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{standards.length}</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>Standards mapped</div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {standards.map((s) => (
              <StandardCard key={s} label={STANDARD_ABBR[s] ?? s} />
            ))}
          </div>
        </div>
        <Tile value={domains.length} label="Control domains" hint="Every control domain with at least one control in ACME's scope." />
        <Tile value={CONTROLS.length} label="Common controls" hint="The full in-scope common-control set, before any system-specific assessment." />
      </div>

      <div className="px-4 lg:px-8 mb-4">
        <section
          aria-label="Framework lens"
          className="rounded-xl flex flex-wrap items-center gap-1.5 py-2 pl-3.5 pr-2.5"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
        >
          <span className="text-xs font-semibold mr-1.5" style={{ color: C.muted }}>Lens</span>
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
      </div>

      <div className="px-4 lg:px-8 flex flex-col lg:flex-row gap-4 lg:gap-5 pb-12">
        <div className="w-full lg:w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          <div className="p-3 flex items-center justify-between text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <span>CONTROL DOMAINS ({domains.length})</span><span>{CONTROLS.length}</span>
          </div>
          <button
            onClick={() => setDomainFilter("All")}
            className="w-full flex items-center justify-between px-3 py-2 text-sm"
            style={{ background: domainFilter === "All" ? C.panel2 : "transparent", color: domainFilter === "All" ? C.accent : C.ink }}
          >
            <span>Show All Domains</span>
            <span className="text-xs" style={{ color: C.muted }}>{CONTROLS.length}</span>
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
                <span className="shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{d.total}</span>
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
            <span className="text-xs px-3 py-2 rounded-full" style={{ background: C.panel2, color: C.muted }}>
              Showing {filtered.length.toLocaleString()} of {CONTROLS.length.toLocaleString()}
            </span>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 2fr 1.4fr", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <div>SCF #</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STANDARDS MAPPED</div>
            </div>
            <div style={{ maxHeight: LIST_HEIGHT, overflowY: "auto" }}>
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
                    onClick={() => { setSelected(control); setOpenFramework(null); }}
                    className="grid px-4 w-full text-left"
                    style={{ gridTemplateColumns: "90px 2fr 1.4fr", borderBottom: `1px solid ${C.border}` }}
                  >
                    <div className="pt-3 pb-3">
                      <div className="text-xs" style={{ color: reached ? C.accent : C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{control.id}</div>
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
            </div>
          </div>
        </div>
      </div>

      {selected && view && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-[640px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {selected.id} · {selected.domain}
                  </div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Close"><X size={18} color={C.muted} /></button>
              </div>
            </div>

            <div className="p-6">
              {lensActive ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}` }}>
                  <div className="text-sm">
                    <span className="font-semibold" style={{ color: C.ink }}>{lensName}</span>
                    <span style={{ color: C.muted }}>
                      {" · "}
                      {view.total > 0
                        ? `${view.shown.length} of ${view.total} requirements`
                        : view.reached ? "maps to this control" : "doesn't map to this control"}
                    </span>
                  </div>
                  <button type="button" onClick={() => applyLens([])} className="text-xs font-medium underline" style={{ color: C.accent }}>
                    {view.total > 0 ? `Show all ${view.total}` : "Show all"}
                  </button>
                </div>
              ) : view.total > 0 && (
                <div className="text-xs mb-4" style={{ color: C.muted }}>
                  {view.total} requirements, consolidated from {selected.frameworks.length} framework{selected.frameworks.length === 1 ? "" : "s"}
                </div>
              )}

              {/* ACME's own statement of the control — the rubric a per-system
                  assessment is judged against, shown here at the definition
                  level rather than tied to any one boundary. */}
              {CONSOLIDATED_CONTROLS[selected.id] && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                    ACME Consolidated Control
                  </div>
                  <div className="text-sm leading-relaxed mb-4" style={{ color: C.ink }}>{CONSOLIDATED_CONTROLS[selected.id].statement}</div>
                  {lensActive && view.reached && (
                    <div className="text-[11px] leading-relaxed mb-4" style={{ color: C.muted }}>
                      The statement describes the whole control. The requirements below are the ones {lensName} maps to, plus any no framework clause reaches.
                    </div>
                  )}
                  {view.shown.length > 0 ? (
                    <div className="space-y-2.5">
                      {view.shown.map((r) => <RequirementRow key={r.number} r={r} />)}
                    </div>
                  ) : (
                    <div className="rounded p-3 text-xs leading-relaxed" style={{ background: C.bg, color: C.muted }}>
                      <div className="font-semibold mb-1" style={{ color: C.ink }}>{lensName} doesn't require anything from this control</div>
                      Clear the lens to see all {view.total} requirements.
                    </div>
                  )}
                </div>
              )}

              {view.outside.length > 0 && (
                <div className="rounded-lg p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>Outside {lensName}</div>
                  <div className="text-[11px] mt-1 mb-3" style={{ color: C.muted }}>The rest of this control, grouped by the frameworks that would add it.</div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                    {view.outside.map((g) => (
                      <div key={g.standard ?? "none"}>
                        <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>{g.standard ?? "No framework clause"}</div>
                        {g.requirements.map((r) => (
                          <div key={r.number} className="flex gap-2.5 py-1 text-xs leading-snug" style={{ color: C.muted }}>
                            <span className="w-5 shrink-0 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.number}</span>
                            <span>{r.title}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg p-3 mb-6" style={{ background: C.panel2 }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                  {CONSOLIDATED_CONTROLS[selected.id] ? "Original catalog description" : "Control description"}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selected.description}</div>
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Framework Mappings</div>
              {view.mappings.length === 0 ? (
                <div className="text-xs mb-2" style={{ color: C.muted }}>No {lensName} clause maps to this control.</div>
              ) : (
                <div className="rounded-lg mb-2" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="px-3">
                    {view.mappings.map((f, i) => {
                      const isOpen = openFramework === i;
                      return (
                        <div key={f.standard} style={{ borderBottom: i < view.mappings.length - 1 ? `1px solid ${C.border}` : "none" }}>
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
              )}

              {view.mappings.length > 0 && (
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  <FrameworkMappingLine f={view.mappings[0]} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
