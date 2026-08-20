import React, { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Share2, ArrowRight, Activity, Layers, Boxes, Database, ShieldCheck, AlertTriangle, FileCheck2, ChevronRight, Stethoscope } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import { BasisTag } from "../components/BasisTag";
import {
  getAllSystems, getAllAssets, getAllKeyControls, getAllDataTypes, getAllRisks, getAllEvidence,
  getNeighbors, explain, modelHealth, getEnterprise,
} from "../engine";

type ExplorerNode =
  | ReturnType<typeof getAllSystems>[number]
  | ReturnType<typeof getAllAssets>[number]
  | ReturnType<typeof getAllKeyControls>[number]
  | ReturnType<typeof getAllDataTypes>[number]
  | ReturnType<typeof getAllRisks>[number]
  | ReturnType<typeof getAllEvidence>[number];
type NodeType = "system" | "asset" | "control" | "dataType" | "risk" | "evidence";
interface NodeTypeConfig { label: string; Icon: LucideIcon; all: () => readonly ExplorerNode[] }
interface NodeSelection { type: NodeType; id: string }
interface TraceTarget { type: string; id: string; metric?: string }
interface DisplayNode {
  id: string;
  name?: string;
  scenario?: string;
  friendlyName?: string;
  source?: string;
  note?: string;
  assetCount?: number;
  env?: string;
  type?: string;
  system?: { name?: string } | null;
  domain?: string;
  subcategory?: string;
  sensitivity?: string;
  kind?: string;
  role?: string;
  evidenceType?: string;
  coveragePct?: number;
  result?: string;
  clauses?: unknown[];
  dataTypeIds?: string[];
  overallAssurance?: number | null;
  assurance?: { pct?: number | null };
  confidence?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeType(value: string): value is NodeType {
  return value === "system" || value === "asset" || value === "control" || value === "dataType" || value === "risk" || value === "evidence";
}

function nodeId(node: unknown): string | null {
  return isRecord(node) && typeof node.id === "string" ? node.id : null;
}

function isDisplayNode(node: unknown): node is DisplayNode {
  return nodeId(node) !== null;
}

// The graph is navigable, so the page needs one place that knows how to render
// any node type generically — otherwise every relationship panel would need its
// own bespoke card and the whole point (that these are the same kind of thing,
// connected) would be lost in the markup.
const NODE_TYPES: Record<NodeType, NodeTypeConfig> = {
  system: { label: "Systems", Icon: Layers, all: getAllSystems },
  asset: { label: "Assets", Icon: Boxes, all: getAllAssets },
  control: { label: "Key Controls", Icon: ShieldCheck, all: getAllKeyControls },
  dataType: { label: "Data Types", Icon: Database, all: getAllDataTypes },
  risk: { label: "Risks", Icon: AlertTriangle, all: getAllRisks },
  evidence: { label: "Evidence", Icon: FileCheck2, all: getAllEvidence },
};
const NODE_TYPE_ORDER: NodeType[] = ["system", "asset", "control", "dataType", "risk", "evidence"];

function nodeLabel(type: string, node: DisplayNode | null): string {
  if (!node) return "—";
  if (type === "risk") return node.scenario ?? node.id;
  if (type === "control") return node.friendlyName ?? node.name ?? node.id;
  if (type === "evidence") return node.source ?? node.id;
  if (type === "framework") return node.name ?? node.id;
  if (type === "flow") return node.note ?? node.id;
  return node.name ?? node.id;
}

function nodeSubtitle(type: string, node: DisplayNode | null): string | null {
  if (!node) return null;
  switch (type) {
    case "system": return `${node.assetCount} assets · ${node.env}`;
    case "asset": return `${node.type} · ${node.system?.name}`;
    case "control": return `${node.id} · ${node.domain}`;
    case "dataType": return `${node.sensitivity} · ${node.kind}${node.role ? ` · ${node.role}` : ""}`;
    case "risk": return `${node.id} · ${node.domain} / ${node.subcategory}`;
    case "evidence": return `${node.evidenceType} · ${node.coveragePct}% coverage · ${e_result(node)}`;
    case "framework": return `${node.clauses?.length ?? 0} clauses`;
    case "flow": return node.dataTypeIds?.join(", ") ?? null;
    default: return null;
  }
}

function e_result(node: DisplayNode): string {
  return node.result ? node.result.toUpperCase() : "";
}

// The headline number a node carries, if it carries one. Nodes with no score
// (a data type, an evidence record) deliberately show nothing rather than a
// zero — the distinction this whole model is built to preserve.
function nodeScore(type: string, node: DisplayNode | null): number | null {
  if (!node) return null;
  // An asset deliberately returns nothing. It is a diagnostic now — it carries
  // a list of control instances and a FIPS 199 impact level, and inventing a
  // headline number for it here would put back the score the model just removed.
  if (type === "system") return node.overallAssurance ?? null;
  if (type === "risk") return node.assurance?.pct ?? null;
  if (type === "evidence") return node.confidence ?? null;
  return null;
}


function ScorePill({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px]" style={{ color: C.muted }}>—</span>;
  const key = value >= 90 ? "green" : value >= 75 ? "amber" : "red";
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded tabular-nums" style={{ color: C[key], background: C[`${key}Bg`], fontFamily: "'IBM Plex Mono', monospace" }}>
      {value}
    </span>
  );
}

function NodeRow({ type, node, active = false, onSelect, showScore = true }: { type: string; node: DisplayNode | null; active?: boolean; onSelect?: (type: string, id: string) => void; showScore?: boolean }) {
  if (!node) return null;
  const Icon = isNodeType(type) ? NODE_TYPES[type].Icon : null;
  return (
    <button
      onClick={() => onSelect?.(type, node.id)}
      className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 transition-colors"
      style={{ background: active ? C.accentBg : C.panel2, border: `1px solid ${active ? C.accent : "transparent"}` }}
    >
      {Icon && <Icon size={13} className="shrink-0" style={{ color: active ? C.accent : C.muted }} />}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium truncate" style={{ color: C.ink }}>{nodeLabel(type, node)}</span>
        <span className="block text-[11px] truncate" style={{ color: C.muted }}>{nodeSubtitle(type, node)}</span>
      </span>
      {showScore && <ScorePill value={nodeScore(type, node)} />}
    </button>
  );
}

// ---- Inspector ------------------------------------------------------------------
interface FactRow { label: string; value: ReactNode }

function Facts({ rows }: { rows: FactRow[] }) {
  return (
    <div className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {rows.filter((r) => r.value != null && r.value !== "").map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="shrink-0" style={{ color: C.muted }}>{r.label}</span>
          <span className="text-right font-medium" style={{ color: C.ink }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function factsFor(type: NodeType, id: string): FactRow[] {
  switch (type) {
    case "system": {
      const node = getAllSystems().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "Classification", value: node.classification },
        { label: "Hosting", value: node.hostingType },
        { label: "Assurance", value: `${node.overallAssurance} (${node.assuranceBand.label})` },
        { label: "Assessment coverage", value: `${node.coverage.assessed} of ${node.coverage.applicable} controls (${node.coverage.assessedPct}%)` },
        { label: "Inherited", value: `${node.coverage.inherited} from ${node.provider}` },
        { label: "Assets", value: node.assetCount },
        { label: "Security category", value: `${node.overallImpactBand.label} (FIPS 199)` },
        { label: "Weakest control", value: node.weakestControl ? `${node.weakestControl.controlId} at ${node.weakestControl.score}` : null },
        { label: "Standards", value: node.standards.join(", ") },
      ];
    }
    case "asset": {
      const node = getAllAssets().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "Classification", value: node.classification },
        { label: "Impact level", value: `${node.impactLevelBand.label} (FIPS 199)` },
        // No assurance row. An asset is the sampling population for the
        // controls assessed on its system, not a scoring subject of its own.
        { label: "Controls applicable", value: node.applicableControlCount },
        { label: "Verified here", value: `${node.implementedCount} of ${node.applicableControlCount}` },
        { label: "Partial / not implemented", value: `${node.partialCount} / ${node.notImplementedCount}` },
        { label: "No evidence collected", value: node.undeterminedCount },
        { label: "Evidence coverage", value: `${node.evidenceCoveragePct}%` },
        { label: "Inherent risk", value: `${node.inherentRisk.score} (${node.inherentRisk.band.label})` },
      ];
    }
    case "control": {
      const node = getAllKeyControls().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "SCF id", value: node.id },
        { label: "Domain", value: node.domain },
        { label: "Category", value: node.category },
        { label: "Scope", value: node.scope === "program" ? "Program-wide" : "Per asset" },
        { label: "Implementation type", value: node.implementationType },
        { label: "Tooling", value: node.toolHint },
        { label: "Frameworks", value: node.frameworks.map((f) => f.standard).join(", ") },
      ];
    }
    case "dataType": {
      const node = getAllDataTypes().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "Sensitivity", value: node.sensitivity },
        { label: "Kind", value: node.kind },
        { label: "Regulated by", value: node.regulatedBy.length ? node.regulatedBy.join(", ") : "Contractual only" },
      ];
    }
    case "risk": {
      const node = getAllRisks().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "Owner", value: node.owner },
        { label: "Residual", value: `${node.residual.severity} / ${node.residual.likelihood} (${node.residualScore})` },
        { label: "Appetite", value: `${node.appetite} — ${node.appetiteRatio}x` },
        { label: "Treatment", value: node.treatment },
        { label: "Trend", value: node.trend.label },
        { label: "Exposure", value: node.exposure ? `$${(node.exposure / 1000000).toFixed(2)}M` : "Within appetite" },
        { label: "Control assurance", value: node.assurance.pct ?? "Unassessed" },
        { label: "Weakest control", value: node.assurance.weakestControl?.control.friendlyName },
      ];
    }
    case "evidence": {
      const node = getAllEvidence().find((item) => item.id === id);
      if (!node) return [];
      return [
        { label: "Type", value: node.evidenceType },
        { label: "Result", value: node.result.toUpperCase() },
        { label: "Exceptions", value: node.exceptionRate == null ? null : `${node.exceptions} of ${node.population} ${node.populationUnit}` },
        { label: "Exception rate", value: node.exceptionRate == null ? null : `${(node.exceptionRate * 100).toFixed(2)}%` },
        { label: "Coverage", value: `${node.coveragePct}%` },
        { label: "Quality", value: node.quality },
        { label: "Collected", value: `${node.collectedAt} (${node.ageDays}d ago)` },
        { label: "Valid for", value: `${node.validForDays} days` },
        { label: "Freshness factor", value: node.freshness },
        { label: "Independence", value: node.independence },
        { label: "Confidence", value: node.confidence },
      ];
    }
    default:
      return [];
  }
}

function classificationFor(node: ExplorerNode): keyof typeof CLASS_META | null {
  if (!("classification" in node)) return null;
  const classification = node.classification;
  if (classification === "Public" || classification === "Internal" || classification === "Confidential" || classification === "Restricted") return classification;
  return null;
}

function descriptionFor(type: NodeType, id: string): string | null {
  if (type === "system") return getAllSystems().find((node) => node.id === id)?.mission ?? null;
  if (type === "dataType") return getAllDataTypes().find((node) => node.id === id)?.description ?? null;
  if (type === "risk") return getAllRisks().find((node) => node.id === id)?.description ?? null;
  if (type === "control") return getAllKeyControls().find((node) => node.id === id)?.description ?? null;
  if (type === "evidence") return getAllEvidence().find((node) => node.id === id)?.note ?? null;
  return null;
}

function Inspector({ type, id, onSelect }: { type: NodeType; id: string; onSelect: (type: NodeType, id: string) => void }) {
  const node = NODE_TYPES[type].all().find((item) => item.id === id) ?? null;
  if (!node) return null;
  const neighbors = getNeighbors(type, id);
  const { Icon } = NODE_TYPES[type];
  const description = descriptionFor(type, id);
  const classification = classificationFor(node);
  const selectedAsset = type === "asset" ? getAllAssets().find((asset) => asset.id === id) ?? null : null;
  const classificationDetail = selectedAsset?.classificationDetail ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-start gap-3 mb-3">
          <Icon size={18} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{nodeLabel(type, node)}</div>
            <div className="text-xs" style={{ color: C.muted }}>{nodeSubtitle(type, node)}</div>
          </div>
          {classification && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0" style={{ background: CLASS_META[classification].bg, color: CLASS_META[classification].color }}>
              {classification}
            </span>
          )}
        </div>
        {description && <p className="text-xs mb-3 leading-relaxed" style={{ color: C.muted }}>{description}</p>}
        <Facts rows={factsFor(type, id)} />
        {selectedAsset && classificationDetail && classificationDetail.drivenBy.length > 0 && (
          <div className="mt-3 pt-3 text-[11px] leading-relaxed" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
            Classified {selectedAsset.classification} because it {classificationDetail.drivenBy[0]?.role} {classificationDetail.drivenBy.map((d) => d.dataType.name).join(", ")}.
          </div>
        )}
      </div>

      {neighbors.map((group) => (
        <div key={group.relation} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight size={12} style={{ color: C.accent }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.accent }}>{group.relation}</span>
            <span className="text-[11px]" style={{ color: C.muted }}>{group.nodes.length}</span>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {group.nodes.map((candidate, i) => {
              if (!isDisplayNode(candidate)) return null;
              const navigable = isNodeType(group.type);
              return (
                <NodeRow
                  key={`${candidate.id}-${i}`}
                  type={group.type}
                  node={candidate}
                  onSelect={navigable ? (nextType, nextId) => { if (isNodeType(nextType)) onSelect(nextType, nextId); } : undefined}
                  showScore={navigable}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Derivation trace -------------------------------------------------------------
function Trace({ target, onSelect }: { target: TraceTarget; onSelect: (target: TraceTarget) => void }) {
  const trace = explain(target.type, target.id, target.metric);
  if (!trace) {
    return (
      <div className="rounded-xl p-4 text-xs" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
        This node carries facts rather than a derived score, so there is nothing to trace. Pick a system, asset, category, implementation, or risk.
      </div>
    );
  }

  const totalWeight = trace.steps.reduce((a, s) => a + (s.weight ?? 0), 0);

  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{trace.label}</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{trace.formula}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BasisTag basis={trace.basis} />
          <ScorePill value={typeof trace.value === "number" ? trace.value : null} />
        </div>
      </div>

      <div className="space-y-1.5 mt-3">
        {trace.steps.map((step, i) => (
          <div key={`${step.label}-${i}`} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium min-w-0 flex-1 truncate" style={{ color: C.ink }}>{step.label}</span>
              {step.weight != null && totalWeight > 0 && (
                <span className="text-[10px] tabular-nums shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {Math.round((step.weight / totalWeight) * 100)}%
                </span>
              )}
              <BasisTag basis={step.basis} />
              {typeof step.value === "number" ? <ScorePill value={step.value} /> : <span className="text-[11px] font-medium shrink-0" style={{ color: C.ink }}>{step.value == null ? "—" : String(step.value)}</span>}
              {step.next && (
                <button onClick={() => { const next = step.next; if (next) onSelect(next); }} className="shrink-0 rounded p-0.5" title="Trace this input" style={{ color: C.accent }}>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
            {step.detail && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{step.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Model health ------------------------------------------------------------------
function HealthStat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.ink }}>{label}</div>
      {hint && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{hint}</div>}
    </div>
  );
}

function FindingList<T>({ title, items, render, empty }: { title: ReactNode; items: readonly T[]; render: (item: T) => ReactNode; empty: ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: C.ink }}>{title}</span>
        <span className="text-[11px] tabular-nums" style={{ color: C.muted }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px]" style={{ color: C.muted }}>{empty}</div>
      ) : (
        <div className="space-y-1">{items.map(render)}</div>
      )}
    </div>
  );
}

function ModelHealth({ onSelect }: { onSelect: (type: NodeType, id: string) => void }) {
  const health = useMemo(() => modelHealth(), []);
  const enterprise = getEnterprise();

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading icon={Activity} hint="what the model is standing on">Coverage</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <HealthStat label="Enterprise assurance" value={enterprise.assurance} hint={`Criticality-weighted across both systems, from ${health.coverage.assessed} of ${health.coverage.applicable} applicable controls.`} />
          <HealthStat label="Assessment coverage" value={`${health.coverage.assessedPct}%`} hint={`${health.coverage.assessed} of ${health.coverage.applicable} applicable controls were assessed, ${health.coverage.inherited} of them inherited from a provider. The rest are reported as unassessed, never scored as zero.`} />
          <HealthStat label="Evidence-backed" value={`${health.coverage.evidenceBackedPct}%`} hint="Share of the controls required on assets that carry a real evidence record." />
          <HealthStat label="Assessments" value={`${health.counts.scoredAssessments} / ${health.counts.assessments}`} hint={`Scored of applicable, across ${health.counts.sampledInstances} sampled asset instances.`} />
          <HealthStat label="Evidence records" value={health.counts.evidenceRecords} />
          <HealthStat label="Data flows" value={health.counts.dataFlows} hint={`Carrying ${health.counts.dataTypes} data types.`} />
        </div>
      </div>

      <div>
        <SectionHeading icon={Activity} hint="which rung of the ladder the programme is missing">Maturity by level</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {health.levelWeakness.map((l) => (
            <HealthStat
              key={l.level}
              label={l.level}
              value={l.mean}
              hint={`Mean rating across scored controls. ${l.zeroCount} (${l.zeroPct}%) are Non-Compliant at this level.`}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading icon={Layers}>Basis distribution</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {health.basisDistribution.map((b) => (
            <div key={b.basis} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-1">
                <BasisTag basis={b.basis} />
                <span className="text-lg font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{b.count}</span>
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{b.detail}</div>
            </div>
          ))}
        </div>
        {/* This used to name the categories that were assessed-only for every
            asset. That state is gone with the category assessments behind it.
            What is worth saying in its place is what the basis split above
            actually means now. */}
        <div className="rounded-xl p-4 mt-3 text-xs leading-relaxed" style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.muted }}>
          <span style={{ color: C.ink, fontWeight: 600 }}>{health.coverage.assessed} of {health.coverage.applicable}</span> applicable controls carry a score,
          {" "}{health.coverage.inherited} of them from a provider&apos;s certification rather than ACME&apos;s own testing. The remaining
          {" "}{health.coverage.applicable - health.coverage.assessed} are outside the declared assessment scope and are reported as unassessed — never
          scored as zero, because nobody looking is a different fact from looking and finding nothing.
        </div>
      </div>

      <div>
        <SectionHeading icon={Boxes} hint="lowest first">Evidence coverage by asset</SectionHeading>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="space-y-1.5">
            {health.evidenceCoverageByAsset.map((a) => (
              <button key={a.id} onClick={() => onSelect("asset", a.id)} className="w-full flex items-center gap-3 rounded-lg px-3 py-1.5 text-left" style={{ background: C.panel2 }}>
                <span className="text-xs min-w-0 flex-1 truncate" style={{ color: C.ink }}>{a.name}</span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: C.muted }}>{a.evidenced}/{a.required}</span>
                <span className="h-1.5 rounded-full shrink-0" style={{ width: 120, background: C.border }}>
                  <span className="block h-1.5 rounded-full" style={{ width: `${a.pct}%`, background: a.pct >= 80 ? C.green : a.pct >= 50 ? C.amber : C.red }} />
                </span>
                <span className="text-[11px] tabular-nums shrink-0 w-9 text-right" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{a.pct}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <SectionHeading icon={Stethoscope} hint="named, not hidden">Findings</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          <FindingList
            title="Partially verified instances"
            items={health.findings.partial}
            empty="No sampled asset is evidenced-but-unverified."
            render={(i) => (
              <button key={`${i.assetId}-${i.controlId}`} onClick={() => onSelect("asset", i.assetId)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.controlId} on {i.asset.name}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{i.statement}</div>
              </button>
            )}
          />
          <FindingList
            title="Required but not implemented"
            items={health.findings.notImplemented}
            empty="Every required control holds on every asset it applies to."
            render={(i) => (
              <button key={`${i.assetId}-${i.controlId}`} onClick={() => onSelect("asset", i.assetId)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.controlId} on {i.asset.name}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{i.statement}</div>
              </button>
            )}
          />
          <FindingList
            title="Sampled but never collected"
            items={health.findings.undetermined}
            empty="Every applicable control has evidence on every asset it applies to."
            render={(i) => (
              <button key={`${i.assetId}-${i.controlId}`} onClick={() => onSelect("asset", i.assetId)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.controlId} on {i.asset.name}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>Required here, and nothing has been collected against it.</div>
              </button>
            )}
          />
          <FindingList
            title="Controls no policy names"
            items={health.coverage.controlsNoPolicyNames}
            empty="Every in-scope control is named by a policy."
            render={(c) => (
              <div key={c.id} className="rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{c.id} — {c.name}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>Covered by the policy governing {c.domain}, but not enumerated.</div>
              </div>
            )}
          />
          <FindingList
            title="Ladder inversions"
            items={health.findings.ladderInversions}
            empty="No control is rated above the rung beneath it."
            render={(a) => (
              <div key={a.id} className="rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{a.controlId} on {a.systemId}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{a.ladderInversions.join(", ")} rated above the level below.</div>
              </div>
            )}
          />
          <FindingList
            title="Stale evidence"
            items={health.findings.staleEvidence}
            empty="No collection is past its validity window."
            render={(e) => (
              <button key={e.id} onClick={() => onSelect("evidence", e.id)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{e.source}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{e.ageDays}d old, valid for {e.validForDays}d · confidence {e.confidence}</div>
              </button>
            )}
          />
          <FindingList
            title="Applicability exceptions"
            items={health.findings.exceptions}
            empty="No control has been excused from an asset."
            render={(x) => (
              <div key={`${x.assetId}-${x.controlId}`} className="rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{x.controlId} excused from {x.assetId}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{x.exception?.reason ?? "No reason recorded"}</div>
              </div>
            )}
          />
          <FindingList
            title="Risks with no asset edge"
            items={health.findings.risksWithoutAssets}
            empty="Every risk names the assets that carry it."
            render={(r) => (
              <button key={r.id} onClick={() => onSelect("risk", r.id)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{r.id} — {r.scenario}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{r.assurance.noAssetsReason}</div>
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Page ----------------------------------------------------------------------------
export default function GraphExplorer() {
  const [tab, setTab] = useState<"explore" | "health">("explore");
  const [type, setType] = useState<NodeType>("asset");
  const [selected, setSelected] = useState<NodeSelection>({ type: "asset", id: "AST-003-03" });
  const [traceTarget, setTraceTarget] = useState<TraceTarget>({ type: "asset", id: "AST-003-03" });

  function select(nextType: NodeType, id: string) {
    setSelected({ type: nextType, id });
    setType(nextType);
    setTraceTarget({ type: nextType, id });
  }

  const list = NODE_TYPES[type].all();

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={Share2}
        title="Graph Explorer"
        tagline="One model, seen directly"
        description="The graph itself — pick any node to trace a derived number back to the evidence that produced it."
        right={
          <div className="flex items-center gap-2">
            {([["explore", "Explore"], ["health", "Model Health"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: tab === key ? C.accentBg : "transparent", color: tab === key ? C.accent : C.muted, border: `1px solid ${tab === key ? C.accent : C.border}` }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {tab === "health" ? (
        <div className="px-8 py-4 pb-12">
          <ModelHealth onSelect={select} />
        </div>
      ) : (
        <div className="px-8 py-4 pb-12 grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(220px, 1fr) minmax(320px, 2fr) minmax(300px, 1.6fr)" }}>
          {/* Node picker */}
          <div className="rounded-xl p-3 sticky top-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex flex-wrap gap-1 mb-3">
              {NODE_TYPE_ORDER.map((key) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className="px-2 py-1 rounded text-[11px] font-medium"
                  style={{ background: type === key ? C.accentBg : "transparent", color: type === key ? C.accent : C.muted, border: `1px solid ${type === key ? C.accent : C.border}` }}
                >
                  {NODE_TYPES[key].label}
                </button>
              ))}
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {list.map((n) => (
                <NodeRow key={n.id} type={type} node={n} active={selected.type === type && selected.id === n.id} onSelect={(nextType, id) => { if (isNodeType(nextType)) select(nextType, id); }} />
              ))}
            </div>
          </div>

          {/* Inspector */}
          <div>
            <SectionHeading icon={NODE_TYPES[selected.type].Icon}>Node</SectionHeading>
            <Inspector type={selected.type} id={selected.id} onSelect={select} />
          </div>

          {/* Derivation trace */}
          <div className="sticky top-4">
            <SectionHeading icon={Activity} hint="click a row to go deeper">Derivation</SectionHeading>
            <Trace target={traceTarget} onSelect={(next) => setTraceTarget(next)} />
            <div className="text-[11px] mt-3 leading-relaxed px-1" style={{ color: C.muted }}>
              Every number above is computed at read time. Nothing here is stored, so changing one evidence record's result moves its implementation,
              that category, the asset, its system, and the enterprise score together — the chain carries full precision and rounds only for display.
              How far the movement is <em>visible</em> depends honestly on scale: flipping the RAG service's cross-tenant test moves that implementation
              by 16 points, its category by 2, and the enterprise score by 0.02, because one control out of hundreds should not visibly move an
              enterprise number. What it does move visibly is the things that are actually about it — the risk it contributes to, and the clause it
              satisfies.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
