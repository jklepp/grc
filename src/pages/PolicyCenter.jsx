import React, { useMemo, useState } from "react";
import { FileText, Search, Layers, ListChecks, ClipboardList, Users2, Link2, ShieldAlert, Tags, ArrowUpRight } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../theme";
import { POLICIES, POLICY_CATEGORIES, POLICY_TIERS, getFrameworkClauses, MAPPED_STANDARDS, STANDARD_ABBR } from "../data/policies";

const TOTAL_DOMAINS = new Set(POLICIES.flatMap((p) => p.domains)).size;
const TOTAL_CONTROLS = new Set(POLICIES.flatMap((p) => p.controlIds)).size;
const CORE_POLICIES = POLICIES.filter((p) => p.tier === POLICY_TIERS.CORE);

function CoreBadge({ compact }) {
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 font-semibold rounded"
      style={
        compact
          ? { color: C.amber }
          : { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, padding: "2px 6px", background: C.amberBg, color: C.amber }
      }
    >
      <ShieldAlert size={compact ? 11 : 10} /> {!compact && "Required for all employees"}
    </span>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
      <Icon size={12} /> {children}
    </div>
  );
}

function ControlMapping({ policy }) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>Control Mapping</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {policy.domains.map((d) => (
          <span key={d} className="text-[11px] px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{d}</span>
        ))}
      </div>
      <div className="text-[11px] mb-3" style={{ color: C.muted }}>
        Maps to <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{policy.controlIds.length}</span> SCF control{policy.controlIds.length !== 1 ? "s" : ""}:{" "}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{policy.controlIds.join(", ")}</span>
      </div>
      <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        {MAPPED_STANDARDS.map((std) => {
          const clauses = getFrameworkClauses(policy.controlIds, std);
          if (clauses.length === 0) return null;
          return (
            <div key={std} className="flex items-start gap-2 text-[11px]">
              <span className="w-12 shrink-0 font-semibold pt-0.5" style={{ color: C.accent }}>{STANDARD_ABBR[std]}</span>
              <span className="flex-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{clauses.join(", ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rendered only for policies that define it (currently just Data Classification &
// Handling) — deliberately heavier than every other section so the four labels
// read as the thing to actually remember, not one more bullet list. Colors come
// from CLASS_META in theme.js, the same tokens the Data Classification Register
// uses for its classification tags, so a level looks identical in both places.
function ClassificationLevels({ levels, onViewRegister }) {
  const ordered = CLASS_ORDER.map((lvl) => levels.find((l) => l.level === lvl)).filter(Boolean);
  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3">
        {ordered.map((lvl) => {
          const meta = CLASS_META[lvl.level];
          return (
            <div key={lvl.level} className="rounded-xl p-4" style={{ background: meta.bg, border: `1px solid ${meta.color}4D` }}>
              <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: meta.color }}>{lvl.level}</div>
              <div className="text-xs leading-relaxed mb-3" style={{ color: C.ink }}>{lvl.definition}</div>
              <div className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: meta.color }}>Examples</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {lvl.examples.map((ex) => (
                  <span key={ex} className="text-[11px] px-2 py-1 rounded" style={{ background: C.panel, color: C.ink }}>{ex}</span>
                ))}
              </div>
              <div className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: meta.color }}>Security requirements for systems hosting this data</div>
              <ul className="space-y-1">
                {lvl.systemRequirements.map((req, i) => (
                  <li key={i} className="text-[11px] leading-relaxed flex gap-1.5" style={{ color: C.ink }}>
                    <span style={{ color: meta.color }}>·</span>{req}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {onViewRegister && (
        <button
          onClick={onViewRegister}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
          style={{ background: C.panel2, color: C.accent, border: `1px solid ${C.border}` }}
        >
          View live systems in the Data Classification Register <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

export default function PolicyCenter({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(POLICIES[0].id);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return POLICIES.filter((p) => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.domains.some((d) => d.toLowerCase().includes(q)));
  }, [query]);

  const coreFiltered = useMemo(() => filtered.filter((p) => p.tier === POLICY_TIERS.CORE), [filtered]);

  const grouped = useMemo(() => {
    return POLICY_CATEGORIES.map((cat) => ({ category: cat, policies: filtered.filter((p) => p.category === cat) })).filter((g) => g.policies.length > 0);
  }, [filtered]);

  const selected = POLICIES.find((p) => p.id === selectedId) || POLICIES[0];
  const relatedPolicies = (selected.relatedPolicyIds || []).map((id) => POLICIES.find((p) => p.id === id)).filter(Boolean);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              <FileText size={13} /> Policy Center
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>ACME Policy Library</h1>
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          Plain-language policies for every ACME employee, backed by ISO 27001 and the same SCF control crosswalk that powers the Common Control Framework. Control mapping below each policy is pulled live from that crosswalk — never hand-typed. The {CORE_POLICIES.length} <span style={{ color: C.amber, fontWeight: 600 }}>Core</span> policies below drive the most day-to-day risk and are required reading for every employee; the rest are scoped to a role or function.
        </p>
      </div>

      <div className="px-8 grid grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{POLICIES.length}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Published policies</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.amberBg, border: `1px solid ${C.amber}4D` }}>
          <div className="text-2xl font-semibold" style={{ color: C.amber, fontFamily: "'Source Serif 4', serif" }}>{CORE_POLICIES.length}</div>
          <div className="text-xs mt-1" style={{ color: C.ink }}>Core — required for all employees</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{TOTAL_DOMAINS} of 33</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>SCF control domains covered</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.accent, fontFamily: "'Source Serif 4', serif" }}>{TOTAL_CONTROLS}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Individual SCF controls mapped to a policy</div>
        </div>
      </div>

      <div className="px-8 flex gap-5 pb-12">
        <div className="w-72 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          <div className="p-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: C.panel2 }}>
              <Search size={13} color={C.muted} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search policies or domains"
                className="bg-transparent text-sm outline-none w-full"
                style={{ color: C.ink }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 680, overflowY: "auto" }}>
            {coreFiltered.length > 0 && (
              <div style={{ background: C.amberBg, borderBottom: `1px solid ${C.border}` }}>
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.amber }}>
                  <ShieldAlert size={11} /> Core · Required Reading
                </div>
                {coreFiltered.map((p) => {
                  const isActive = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="w-full flex flex-col items-start px-3 py-2 text-left"
                      style={{ background: isActive ? C.panel2 : "transparent" }}
                    >
                      <span className="text-[10px]" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{p.code}</span>
                      <span className="text-xs leading-snug font-medium" style={{ color: isActive ? C.ink : C.muted }}>{p.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {grouped.map((g) => (
              <div key={g.category}>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{g.category}</div>
                {g.policies.map((p) => {
                  const isActive = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                      style={{ background: isActive ? C.panel2 : "transparent" }}
                    >
                      <span className="flex flex-col items-start min-w-0">
                        <span className="text-[10px]" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{p.code}</span>
                        <span className="text-xs leading-snug" style={{ color: isActive ? C.ink : C.muted }}>{p.title}</span>
                      </span>
                      {p.tier === POLICY_TIERS.CORE && <CoreBadge compact />}
                    </button>
                  );
                })}
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="p-4 text-xs" style={{ color: C.muted }}>No policies match "{query}".</div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 rounded-xl p-6" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <div className="text-xs uppercase tracking-wide" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              {selected.code} · {selected.category}
            </div>
            {selected.tier === POLICY_TIERS.CORE && <CoreBadge />}
          </div>
          <h2 className="text-2xl mb-3" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.title}</h2>

          <p className="text-sm leading-relaxed mb-2" style={{ color: C.ink }}>{selected.purpose}</p>
          <p className="text-xs mb-6" style={{ color: C.muted }}><span className="font-semibold">Scope: </span>{selected.scope}</p>

          {selected.classificationLevels && (
            <>
              <SectionLabel icon={Tags}>The four classification levels</SectionLabel>
              <ClassificationLevels levels={selected.classificationLevels} onViewRegister={() => onNavigate && onNavigate("gap-matrix")} />
            </>
          )}

          <SectionLabel icon={ListChecks}>What you need to know</SectionLabel>
          <div className="space-y-3 mb-6">
            {selected.statements.map((s, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-xs font-semibold shrink-0 w-5" style={{ color: C.accent }}>{i + 1}.</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{s.title}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{s.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <SectionLabel icon={ClipboardList}>Standards &amp; procedures</SectionLabel>
          <div className="space-y-2.5 mb-6">
            {selected.standards.map((s, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: C.panel2 }}>
                <div className="text-xs font-semibold" style={{ color: C.ink }}>{s.title}</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{s.detail}</div>
              </div>
            ))}
          </div>

          <SectionLabel icon={Users2}>Roles &amp; responsibilities</SectionLabel>
          <div className="rounded-lg overflow-hidden mb-6" style={{ border: `1px solid ${C.border}` }}>
            {selected.roles.map((r, i) => (
              <div
                key={i}
                className="grid px-3 py-2"
                style={{ gridTemplateColumns: "160px 1fr", borderTop: i > 0 ? `1px solid ${C.border}` : "none", background: i % 2 ? "transparent" : C.panel2 }}
              >
                <div className="text-xs font-semibold" style={{ color: C.ink }}>{r.role}</div>
                <div className="text-xs" style={{ color: C.muted }}>{r.responsibility}</div>
              </div>
            ))}
          </div>

          <SectionLabel icon={Layers}>Control mapping</SectionLabel>
          <div className="mb-6"><ControlMapping policy={selected} /></div>

          {relatedPolicies.length > 0 && (
            <>
              <SectionLabel icon={Link2}>Related policies</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {relatedPolicies.map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => setSelectedId(rp.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
                  >
                    {rp.tier === POLICY_TIERS.CORE && <ShieldAlert size={11} color={C.amber} />}
                    {rp.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
