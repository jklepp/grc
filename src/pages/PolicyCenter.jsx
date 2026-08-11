import React, { useMemo, useState } from "react";
import { BookOpen, Search, Layers, ListChecks, ClipboardList, Users2, Link2 } from "lucide-react";
import { C } from "../theme";
import { POLICIES, POLICY_CATEGORIES, getFrameworkClauses } from "../data/policies";

const STANDARD_ABBR = { "SOC 2": "SOC2", "ISO 27001": "27001", "ISO 27017": "27017", "ISO 27018": "27018", "ISO 27701": "27701", "PCI DSS": "PCI", HIPAA: "HIPAA" };
const MAPPED_STANDARDS = ["ISO 27001", "SOC 2", "PCI DSS", "HIPAA"];

const TOTAL_DOMAINS = new Set(POLICIES.flatMap((p) => p.domains)).size;
const TOTAL_CONTROLS = new Set(POLICIES.flatMap((p) => p.controlIds)).size;

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

export default function PolicyCenter() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(POLICIES[0].id);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return POLICIES.filter((p) => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.domains.some((d) => d.toLowerCase().includes(q)));
  }, [query]);

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
              <BookOpen size={13} /> Policy Center
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>ACME Policy Library</h1>
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          Plain-language policies for every ACME employee, backed by ISO 27001 and the same SCF control crosswalk that powers the Common Control Framework. Control mapping below each policy is pulled live from that crosswalk — never hand-typed.
        </p>
      </div>

      <div className="px-8 grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{POLICIES.length}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Published policies</div>
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
            {grouped.map((g) => (
              <div key={g.category}>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{g.category}</div>
                {g.policies.map((p) => {
                  const isActive = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="w-full flex flex-col items-start px-3 py-2 text-left"
                      style={{ background: isActive ? C.panel2 : "transparent" }}
                    >
                      <span className="text-[10px]" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{p.code}</span>
                      <span className="text-xs leading-snug" style={{ color: isActive ? C.ink : C.muted }}>{p.title}</span>
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
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
            {selected.code} · {selected.category}
          </div>
          <h2 className="text-2xl mb-3" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.title}</h2>

          <p className="text-sm leading-relaxed mb-2" style={{ color: C.ink }}>{selected.purpose}</p>
          <p className="text-xs mb-6" style={{ color: C.muted }}><span className="font-semibold">Scope: </span>{selected.scope}</p>

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
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
                  >
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
