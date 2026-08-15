import React, { useMemo, useState } from "react";
import {
  Shield, Fingerprint, Network, GitBranch, Lock, Layers, Link2, Bot, Activity, Save,
  ChevronRight, X, ArrowRight, SlidersHorizontal, Boxes, ShieldAlert, Bug, Compass, Plug,
} from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { FOUNDATIONAL_PRINCIPLES, PRINCIPLE_DOMAINS, STATUS_META, PRINCIPLE_STATUS_COUNTS } from "../data/securityPrinciples";

const DOMAIN_ICONS = {
  "identity-authorization": Fingerprint,
  network: Network,
  "secure-architecture": SlidersHorizontal,
  "workload-runtime": Boxes,
  "vulnerability-management": Bug,
  devsecops: GitBranch,
  "data-lifecycle": Lock,
  "multi-tenancy": Layers,
  "third-party-integration": Link2,
  "api-security": Plug,
  "ai-agent": Bot,
  "logging-monitoring": Activity,
  "backup-recovery": Save,
};

const STATUS_COLOR = {
  operationalized: () => C.green,
  partial: () => C.amber,
  "not-operationalized": () => C.red,
};

const FOUNDATIONAL_BY_ID = Object.fromEntries(FOUNDATIONAL_PRINCIPLES.map((f) => [f.id, f]));
const STATUS_ORDER = ["operationalized", "partial", "not-operationalized"];

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status]();
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide shrink-0" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {STATUS_META[status].label}
    </span>
  );
}

function StatSummary({ activeStatus, onToggle }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STATUS_ORDER.map((s) => {
        const isActive = activeStatus === s;
        const color = STATUS_COLOR[s]();
        return (
          <button
            key={s}
            onClick={() => onToggle(isActive ? null : s)}
            className="rounded-lg p-3 text-left transition-colors"
            style={{ background: isActive ? C.panel2 : C.panel, border: `1px solid ${isActive ? color : C.border}` }}
          >
            <div className="text-2xl font-semibold" style={{ color, fontFamily: "'Source Serif 4', serif" }}>{PRINCIPLE_STATUS_COUNTS[s]}</div>
            <div className="text-[11px] mt-0.5" style={{ color: isActive ? C.ink : C.muted }}>{STATUS_META[s].label}</div>
          </button>
        );
      })}
    </div>
  );
}

// Purely a reference strip now — the eleven cross-cutting ideas every
// principle below traces back to. Not clickable: it used to double as a
// filter, but replacing the entire domain list below on a stray click was
// a confusing way to browse eleven cards that are meant to be read together.
function FoundationalStrip() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {FOUNDATIONAL_PRINCIPLES.map((f) => (
        <div key={f.id} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs font-semibold" style={{ color: C.ink }}>{f.title}</div>
          <div className="text-[11px] mt-0.5 leading-snug" style={{ color: C.muted }}>{f.detail}</div>
        </div>
      ))}
    </div>
  );
}

function TagChip({ id }) {
  const f = FOUNDATIONAL_BY_ID[id];
  if (!f) return null;
  return (
    <span
      className="text-[10px] px-2 py-1 rounded-full font-medium"
      style={{ background: C.panel2, color: C.muted, border: `1px solid ${C.border}` }}
      title={f.detail}
    >
      {f.title}
    </span>
  );
}

function PrincipleCard({ principle, domain, onNavigate, showDomainLabel }) {
  const color = STATUS_COLOR[principle.status]();
  return (
    <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        {showDomainLabel ? (
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent }}>{domain.title}</div>
        ) : <span />}
        <StatusBadge status={principle.status} />
      </div>
      <div className="text-sm font-semibold leading-snug" style={{ color: C.ink }}>{principle.statement}</div>
      <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>{principle.rationale}</div>

      {principle.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {principle.tags.map((t) => (
            <TagChip key={t} id={t} />
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
        {principle.status === "not-operationalized" ? (
          <>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: C.red }}>Not yet built — what it would take</div>
            <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{principle.gapNote}</div>
          </>
        ) : (
          <>
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
            {principle.status === "partial" && (
              <div className="flex items-start gap-1.5 text-[11px] leading-relaxed mt-1.5" style={{ color: C.amber }}>
                <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                <span>{principle.partialNote}</span>
              </div>
            )}
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
          </>
        )}
      </div>
    </div>
  );
}

export default function SecurityPrinciples({ onNavigate }) {
  const [selectedDomainId, setSelectedDomainId] = useState(PRINCIPLE_DOMAINS[0].id);
  const [activeStatus, setActiveStatus] = useState(null);

  const filteredPrinciples = useMemo(() => {
    if (!activeStatus) return null;
    return PRINCIPLE_DOMAINS.flatMap((d) => d.principles.filter((p) => p.status === activeStatus).map((p) => ({ p, d })));
  }, [activeStatus]);

  const selectedDomain = PRINCIPLE_DOMAINS.find((d) => d.id === selectedDomainId) || PRINCIPLE_DOMAINS[0];

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={Shield}
        title="Security Principles"
        tagline="The Technical Controls Every Procedure Assumes"
        description="The concrete technical requirements every procedure assumes, organized by engineering discipline."
      />

      <div className="px-8 pb-6">
        <SectionHeading
          icon={ShieldAlert}
          hint="click a tile to filter the principles below"
          right={activeStatus && (
            <button onClick={() => setActiveStatus(null)} className="flex items-center gap-1 text-xs font-medium" style={{ color: C.accent }}>
              <X size={12} /> Clear filter
            </button>
          )}
        >
          Operationalization Status
        </SectionHeading>
        <StatSummary activeStatus={activeStatus} onToggle={setActiveStatus} />
      </div>

      <div className="px-8 pb-4">
        <SectionHeading icon={Compass}>Foundational Principles</SectionHeading>
        <FoundationalStrip />
      </div>

      {!activeStatus && (
        <div className="px-8 pb-4">
          <h2 className="text-2xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selectedDomain.title}</h2>
          <p className="text-sm mt-1" style={{ color: C.muted }}>{selectedDomain.summary}</p>
        </div>
      )}

      <div className="px-8 flex gap-5 pb-12">
        {!activeStatus && (
          <div className="w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
            {PRINCIPLE_DOMAINS.map((d) => {
              const isActive = d.id === selectedDomainId;
              const Icon = DOMAIN_ICONS[d.id] || Shield;
              const gaps = d.principles.filter((p) => p.status === "not-operationalized").length;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDomainId(d.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{ background: isActive ? C.panel2 : "transparent", borderBottom: `1px solid ${C.border}` }}
                >
                  <Icon size={15} color={isActive ? C.accent : C.muted} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium leading-snug" style={{ color: isActive ? C.ink : C.muted }}>{d.title}</div>
                    <div className="text-[10px]" style={{ color: C.muted }}>{d.principles.length} principle{d.principles.length !== 1 ? "s" : ""}</div>
                  </div>
                  {gaps > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: C.redBg, color: C.red }}>{gaps}</span>
                  )}
                  {isActive && <ChevronRight size={13} color={C.accent} className="ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {activeStatus ? (
            <>
              <div className="text-sm mb-4" style={{ color: C.muted }}>
                Showing <span style={{ color: C.ink, fontWeight: 600 }}>{filteredPrinciples.length}</span> principle
                {filteredPrinciples.length !== 1 ? "s" : ""} marked{" "}
                <span style={{ color: STATUS_COLOR[activeStatus](), fontWeight: 600 }}>{STATUS_META[activeStatus].label}</span>{" "}
                across every domain.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPrinciples.map(({ p, d }) => (
                  <PrincipleCard key={p.id} principle={p} domain={d} onNavigate={onNavigate} showDomainLabel />
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedDomain.principles.map((p) => (
                <PrincipleCard key={p.id} principle={p} domain={selectedDomain} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
