import React, { useState, useMemo } from "react";
import { Search, X, ChevronDown, ChevronRight, RefreshCw, LayoutGrid, UserX, HelpCircle } from "lucide-react";
import { C } from "../theme";
import scf from "../data/scfControls.json";
import { CCF_VISIBLE_CONTROLS as VISIBLE_CONTROLS, CCF_DOMAINS as VISIBLE_DOMAINS } from "../data/ccfControls";
import { CONSOLIDATED_CONTROLS } from "../data/consolidatedControls";
import { STANDARD_ABBR } from "../data/policies";

function overallColor(status) {
  if (status === "matched") return C.green;
  if (status === "unscored") return C.accent;
  return C.na;
}
function overallLabel(status) {
  if (status === "matched") return "Matched";
  if (status === "unscored") return "Needs Review";
  return "No Match";
}

function OwnerTag({ owner }) {
  if (!owner) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: C.redBg, color: C.red }}>
        <UserX size={10} /> UNOWNED
      </span>
    );
  }
  return <span className="text-xs" style={{ color: C.muted }}>{owner}</span>;
}

// One line per framework the control actually maps to in SCF's crosswalk.
// No confidence score, no 1:1/partial split — that requires real review, which hasn't
// happened yet. Match/review status is a control-level fact (the same for every
// framework a control maps to), so it's shown once in the row's Status column
// rather than repeated on every line here.
function FrameworkMappingLine({ f }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <span className="w-12 shrink-0 font-semibold" style={{ color: C.accent }}>{STANDARD_ABBR[f.standard]}</span>
      <span className="flex-1 min-w-0 truncate" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
        {f.clauses.join(", ")}
      </span>
    </div>
  );
}

function OverallBadge({ status }) {
  const color = overallColor(status);
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: `${color}26`, color }}>
      {overallLabel(status)}
    </span>
  );
}

const LIST_HEIGHT = 640;

export default function CommonControlFramework() {
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [healthFilter, setHealthFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [openFramework, setOpenFramework] = useState(null);

  const filtered = useMemo(() => {
    return VISIBLE_CONTROLS.filter(
      (c) =>
        (domainFilter === "All" || c.domain === domainFilter) &&
        (healthFilter === "All" || c.overall === healthFilter) &&
        (c.name?.toLowerCase().includes(query.toLowerCase()) || c.id?.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query, domainFilter, healthFilter]);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              <LayoutGrid size={13} /> Common Control Framework
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>Unified Compliance Matrix</h1>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            <RefreshCw size={12} /> Imported from Secure Controls Framework 2026.1
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          The real SCF control library, crosswalked against SOC 2, ISO 27001, ISO 27017, ISO 27018, ISO 27701, ISO 42001, PCI DSS, and HIPAA — filtered to the controls that actually map to one of those frameworks. Ownership isn't in the source data, so every control starts unowned; about a third are still flagged Needs Review.
        </p>
      </div>

      <div className="px-8 grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{scf.stats.totalControls.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Total SCF controls across {scf.stats.totalDomains} domains</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.na, fontFamily: "'Source Serif 4', serif" }}>{scf.stats.noMatchCount.toLocaleString()}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            No match across any of the 8 in-scope frameworks ({Math.round((scf.stats.noMatchCount / scf.stats.totalControls) * 100)}%)
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.accent, fontFamily: "'Source Serif 4', serif" }}>
            {(scf.stats.totalControls - scf.stats.noMatchCount).toLocaleString()}
          </div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Matched at least one framework in the crosswalk</div>
        </div>
      </div>

      <div className="px-8 flex gap-5 pb-12">
        <div className="w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          <div className="p-3 flex items-center justify-between text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
            <span>CONTROL DOMAINS ({VISIBLE_DOMAINS.length})</span><span>{VISIBLE_CONTROLS.length}</span>
          </div>
          <button
            onClick={() => setDomainFilter("All")}
            className="w-full flex items-center justify-between px-3 py-2 text-sm"
            style={{ background: domainFilter === "All" ? C.panel2 : "transparent", color: domainFilter === "All" ? C.accent : C.ink }}
          >
            <span>Show All Domains</span>
            <span className="text-xs" style={{ color: C.muted }}>{VISIBLE_CONTROLS.length}</span>
          </button>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {VISIBLE_DOMAINS.map((d) => (
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
            <div className="relative">
              <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}
                className="text-xs pl-3 pr-7 py-2 rounded-lg font-medium appearance-none" style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}>
                <option value="All">All controls</option>
                <option value="matched">Matched</option>
                <option value="unscored">Needs review</option>
              </select>
              <ChevronDown size={12} color={C.muted} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <span className="text-xs px-3 py-2 rounded-full" style={{ background: C.panel2, color: C.muted }}>
              Showing {filtered.length.toLocaleString()} of {VISIBLE_CONTROLS.length.toLocaleString()}
            </span>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: "90px 1.5fr 130px 2.6fr 110px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <div>SCF #</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>CONTROL</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>OWNER</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>FRAMEWORK MAPPINGS</div>
              <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>STATUS</div>
            </div>
            <div style={{ maxHeight: LIST_HEIGHT, overflowY: "auto" }}>
              {filtered.map((ctrl) => (
                <div
                  key={ctrl.id}
                  className="grid px-4"
                  style={{ gridTemplateColumns: "90px 1.5fr 130px 2.6fr 110px", borderBottom: `1px solid ${C.border}` }}
                >
                  <button onClick={() => { setSelected(ctrl); setOpenFramework(null); }} className="text-left pt-3 pb-3">
                    <div className="text-xs" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{ctrl.id}</div>
                  </button>
                  <button onClick={() => { setSelected(ctrl); setOpenFramework(null); }} className="text-left pt-3 pb-3 pl-3 pr-2 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    <div className="text-sm leading-snug" style={{ color: C.ink }}>{ctrl.name}</div>
                    <div className="text-[10px] mt-1" style={{ color: C.muted }}>{ctrl.domain}</div>
                  </button>
                  <div className="flex items-center pl-3" style={{ borderLeft: `1px solid ${C.border}` }}><OwnerTag owner={ctrl.owner} /></div>
                  <div className="py-2 pl-3 min-w-0" style={{ borderLeft: `1px solid ${C.border}` }}>
                    {ctrl.frameworks.map((f, fi) => <FrameworkMappingLine key={fi} f={f} />)}
                  </div>
                  <div className="flex items-center pl-3" style={{ borderLeft: `1px solid ${C.border}` }}><OverallBadge status={ctrl.overall} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-[600px] h-full overflow-y-auto shadow-2xl" style={{ background: C.panel }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{selected.id} · {selected.domain}</div>
                  <h2 className="text-xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)}><X size={18} color={C.muted} /></button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <OverallBadge status={selected.overall} />
              </div>
              <div className="mt-3"><OwnerTag owner={selected.owner} /></div>
            </div>

            <div className="p-6">
              {CONSOLIDATED_CONTROLS[selected.id] && (
                <div className="rounded-lg p-4 mb-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
                  <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>ACME Consolidated Control</div>
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
                  <div className="text-[10px] mt-4 pt-3" style={{ color: C.muted, borderTop: `1px solid ${C.accent}33` }}>
                    Rolled up from {CONSOLIDATED_CONTROLS[selected.id].sourceControls.length} SCF controls: {CONSOLIDATED_CONTROLS[selected.id].sourceControls.join(", ")}
                  </div>
                </div>
              )}

              <div className="rounded-lg p-3 mb-6" style={{ background: C.panel2 }}>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                  {CONSOLIDATED_CONTROLS[selected.id] ? "Original SCF Description" : "SCF Control Description"}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{selected.description}</div>
              </div>

              <div className="flex items-center gap-1.5 mb-3 text-[11px] p-2.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                <HelpCircle size={12} className="shrink-0" />
                Implementation, evidence standard, and architecture guardrail aren't defined yet for this control — that's real workflow to fill in, not something SCF provides.
              </div>

              <div className="text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Framework Mappings</div>
              <div className="rounded-lg mb-2" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="px-3">
                  {selected.frameworks.map((f, i) => {
                    const isOpen = openFramework === i;
                    const isMatched = selected.overall === "matched";
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
                                <span className="text-[10px]" style={{ color: C.muted }}>{isMatched ? "Assessed" : "Not yet assessed"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
