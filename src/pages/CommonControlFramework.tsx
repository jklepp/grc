import React, { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { Search, X, ChevronDown, ChevronRight, RefreshCw, LayoutGrid } from "lucide-react";
import { C } from "../theme";
import { useLiveEngine } from "../engine/useLiveEngine";
import { PageHeader } from "../components/Headings";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { STANDARD_ABBR } from "../data/policies";
import { IN_SCOPE_CONTROLS } from "../engine";
import type { Control, ControlFramework } from "../graph/nodes/controls";

// The catalog side of the control model: every common control ACME has in scope,
// its domain, and the framework clauses it satisfies — independent of any one
// system's assessment. How a given system scores against these lives on that
// system's own Security Profile; this page answers "what do we have," not
// "how is any one boundary doing against it."
const LIST_HEIGHT = 640;

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

function StandardChips({ frameworks }: { frameworks: ControlFramework[] }) {
  if (frameworks.length === 0) return <span className="text-xs" style={{ color: C.muted }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {frameworks.map((f) => (
        <span key={f.standard} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
          {STANDARD_ABBR[f.standard] ?? f.standard}
        </span>
      ))}
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

export default function CommonControlFramework() {
  // IN_SCOPE_CONTROLS is an `export let` the engine reassigns on publish().
  // Captured at module scope it froze against the first engine; read here it
  // follows every commit, which is also why it belongs in the deps below.
  const liveEngine = useLiveEngine();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const CONTROLS = useMemo(() => IN_SCOPE_CONTROLS, [liveEngine]);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [selected, setSelected] = useState<Control | null>(null);
  const [openFramework, setOpenFramework] = useState<number | null>(null);

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
              {filtered.map((control) => (
                <button
                  key={control.id}
                  onClick={() => { setSelected(control); setOpenFramework(null); }}
                  className="grid px-4 w-full text-left"
                  style={{ gridTemplateColumns: "90px 2fr 1.4fr", borderBottom: `1px solid ${C.border}` }}
                >
                  <div className="pt-3 pb-3">
                    <div className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{control.id}</div>
                  </div>
                  <div className="pt-3 pb-3 pl-3 pr-2 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <div className="text-sm leading-snug" style={{ color: C.ink }}>{control.name}</div>
                    <div className="text-[10px] mt-1" style={{ color: C.muted }}>{control.domain}</div>
                  </div>
                  <div className="flex items-center pl-3 pr-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <StandardChips frameworks={control.frameworks} />
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
                    {selected.id} · {selected.domain}
                  </div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)}><X size={18} color={C.muted} /></button>
              </div>
            </div>

            <div className="p-6">
              {/* ACME's own statement of the control — the rubric a per-system
                  assessment is judged against, shown here at the definition
                  level rather than tied to any one boundary. */}
              {CONSOLIDATED_CONTROLS[selected.id] && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>
                    ACME Consolidated Control
                  </div>
                  <div className="text-sm leading-relaxed mb-4" style={{ color: C.ink }}>{CONSOLIDATED_CONTROLS[selected.id].statement}</div>
                  <div className="space-y-2.5">
                    {CONSOLIDATED_CONTROLS[selected.id].requirements.map((r, i) => (
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
                  {CONSOLIDATED_CONTROLS[selected.id] ? "Original catalog description" : "Control description"}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selected.description}</div>
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Framework Mappings</div>
              <div className="rounded-lg mb-2" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3">
                  {selected.frameworks.map((f, i) => {
                    const isOpen = openFramework === i;
                    return (
                      <div key={i} style={{ borderBottom: i < selected.frameworks.length - 1 ? `1px solid ${C.border}` : "none" }}>
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

              {selected.frameworks.length > 0 && (
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  <FrameworkMappingLine f={selected.frameworks[0]} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
