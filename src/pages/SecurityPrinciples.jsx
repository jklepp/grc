import React, { useMemo, useState } from "react";
import {
  Shield, Fingerprint, Network, GitBranch, Lock, Layers, Link2, Bot, Activity, Save,
  ChevronRight, X, ArrowRight,
} from "lucide-react";
import { C } from "../theme";
import { FOUNDATIONAL_PRINCIPLES, PRINCIPLE_DOMAINS } from "../data/securityPrinciples";

const DOMAIN_ICONS = {
  "identity-authorization": Fingerprint,
  network: Network,
  devsecops: GitBranch,
  "data-encryption": Lock,
  "multi-tenancy": Layers,
  "third-party-integration": Link2,
  "ai-agent": Bot,
  "logging-monitoring": Activity,
  "backup-recovery": Save,
};

const FOUNDATIONAL_BY_ID = Object.fromEntries(FOUNDATIONAL_PRINCIPLES.map((f) => [f.id, f]));

function FoundationalStrip({ activeTag, onToggle }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
      {FOUNDATIONAL_PRINCIPLES.map((f) => {
        const isActive = activeTag === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onToggle(isActive ? null : f.id)}
            className="text-left rounded-lg p-3 transition-colors"
            style={{
              background: isActive ? C.accentBg : C.panel,
              border: `1px solid ${isActive ? C.accent : C.border}`,
            }}
          >
            <div className="text-xs font-semibold" style={{ color: isActive ? C.accent : C.ink }}>{f.title}</div>
            <div className="text-[11px] mt-0.5 leading-snug" style={{ color: C.muted }}>{f.detail}</div>
          </button>
        );
      })}
    </div>
  );
}

function TagChip({ id, active, onClick }) {
  const f = FOUNDATIONAL_BY_ID[id];
  if (!f) return null;
  return (
    <button
      onClick={onClick}
      className="text-[10px] px-2 py-1 rounded-full font-medium"
      style={{
        background: active ? C.accentBg : C.panel2,
        color: active ? C.accent : C.muted,
        border: `1px solid ${active ? C.accent : C.border}`,
      }}
      title={f.detail}
    >
      {f.title}
    </button>
  );
}

function PrincipleCard({ principle, domain, activeTag, onToggleTag, onNavigate, showDomainLabel }) {
  return (
    <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {showDomainLabel && (
        <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: C.accent }}>{domain.title}</div>
      )}
      <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{principle.statement}</div>
      <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>{principle.rationale}</div>

      {principle.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {principle.tags.map((t) => (
            <TagChip key={t} id={t} active={activeTag === t} onClick={() => onToggleTag(activeTag === t ? null : t)} />
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Implemented in</div>
        {principle.implementedIn.map((ref, i) => (
          <button
            key={i}
            onClick={() => onNavigate && onNavigate("procedure-library")}
            className="w-full flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg text-left"
            style={{ background: C.panel2, color: C.ink }}
          >
            <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }} className="shrink-0">{ref.procedureCode}</span>
            <span className="truncate flex-1">{ref.step}</span>
            <ArrowRight size={11} color={C.muted} className="shrink-0" />
          </button>
        ))}
        {principle.controlIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {principle.controlIds.map((id) => (
              <span
                key={id}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: C.panel2, color: C.muted, fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${C.border}` }}
              >
                {id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SecurityPrinciples({ onNavigate }) {
  const [selectedDomainId, setSelectedDomainId] = useState(PRINCIPLE_DOMAINS[0].id);
  const [activeTag, setActiveTag] = useState(null);

  const filteredPrinciples = useMemo(() => {
    if (!activeTag) return null;
    return PRINCIPLE_DOMAINS.flatMap((d) => d.principles.filter((p) => p.tags.includes(activeTag)).map((p) => ({ p, d })));
  }, [activeTag]);

  const selectedDomain = PRINCIPLE_DOMAINS.find((d) => d.id === selectedDomainId) || PRINCIPLE_DOMAINS[0];
  const totalPrinciples = PRINCIPLE_DOMAINS.reduce((n, d) => n + d.principles.length, 0);

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
          <Shield size={13} /> Security Engineering Principles
        </div>
        <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>
          The Technical Controls Every Procedure Assumes
        </h1>
        <p className="text-sm mt-2 max-w-3xl" style={{ color: C.muted }}>
          A framework crosswalk can score every control "Implemented" and still miss an architectural premise —
          standing privilege where none is needed, an app-layer query as the only thing separating two tenants'
          data, a system prompt doing the job of an authorization check. This page is that layer: {totalPrinciples}{" "}
          concrete technical requirements, organized by engineering discipline rather than procedural ownership,
          each traced back to the exact SOP step that operationalizes it — nothing here is asserted without a real
          step and real control IDs behind it.
        </p>
      </div>

      <div className="px-8 pb-4">
        <div className="text-xs uppercase tracking-wide mb-3 flex items-center justify-between" style={{ color: C.muted }}>
          <span>Foundational principles{activeTag ? " — click again to clear" : " — click one to filter below"}</span>
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="flex items-center gap-1 font-medium" style={{ color: C.accent }}>
              <X size={12} /> Clear filter
            </button>
          )}
        </div>
        <FoundationalStrip activeTag={activeTag} onToggle={setActiveTag} />
      </div>

      <div className="px-8 flex gap-5 pb-12">
        {!filteredPrinciples && (
          <div className="w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
            {PRINCIPLE_DOMAINS.map((d) => {
              const isActive = d.id === selectedDomainId;
              const Icon = DOMAIN_ICONS[d.id] || Shield;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDomainId(d.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{ background: isActive ? C.panel2 : "transparent", borderBottom: `1px solid ${C.border}` }}
                >
                  <Icon size={15} color={isActive ? C.accent : C.muted} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium leading-snug" style={{ color: isActive ? C.ink : C.muted }}>{d.title}</div>
                    <div className="text-[10px]" style={{ color: C.muted }}>{d.principles.length} principle{d.principles.length !== 1 ? "s" : ""}</div>
                  </div>
                  {isActive && <ChevronRight size={13} color={C.accent} className="ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {filteredPrinciples ? (
            <>
              <div className="text-sm mb-4" style={{ color: C.muted }}>
                Showing <span style={{ color: C.ink, fontWeight: 600 }}>{filteredPrinciples.length}</span> principle
                {filteredPrinciples.length !== 1 ? "s" : ""} tagged{" "}
                <span style={{ color: C.accent, fontWeight: 600 }}>{FOUNDATIONAL_BY_ID[activeTag]?.title}</span> across every domain.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPrinciples.map(({ p, d }) => (
                  <PrincipleCard key={p.id} principle={p} domain={d} activeTag={activeTag} onToggleTag={setActiveTag} onNavigate={onNavigate} showDomainLabel />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-2xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selectedDomain.title}</h2>
                <p className="text-sm mt-1" style={{ color: C.muted }}>{selectedDomain.summary}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDomain.principles.map((p) => (
                  <PrincipleCard key={p.id} principle={p} domain={selectedDomain} activeTag={activeTag} onToggleTag={setActiveTag} onNavigate={onNavigate} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
