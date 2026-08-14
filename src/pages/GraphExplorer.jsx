import React, { useState, useMemo } from "react";
import { Share2, ArrowRight, Activity, Layers, Boxes, Database, ShieldCheck, AlertTriangle, FileCheck2, ChevronRight, Stethoscope } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import {
  getAllSystems, getAllAssets, getAllKeyControls, getAllDataTypes, getAllRisks, getAllEvidence,
  getSystem, getAsset, getControl, getDataType, getRisk, getEvidence,
  getNeighbors, explain, modelHealth, getEnterprise, BASIS_META,
} from "../engine";

// The graph is navigable, so the page needs one place that knows how to render
// any node type generically — otherwise every relationship panel would need its
// own bespoke card and the whole point (that these are the same kind of thing,
// connected) would be lost in the markup.
const NODE_TYPES = {
  system: { label: "Systems", Icon: Layers, all: getAllSystems, get: getSystem },
  asset: { label: "Assets", Icon: Boxes, all: getAllAssets, get: getAsset },
  control: { label: "Key Controls", Icon: ShieldCheck, all: getAllKeyControls, get: getControl },
  dataType: { label: "Data Types", Icon: Database, all: getAllDataTypes, get: getDataType },
  risk: { label: "Risks", Icon: AlertTriangle, all: getAllRisks, get: getRisk },
  evidence: { label: "Evidence", Icon: FileCheck2, all: getAllEvidence, get: getEvidence },
};

function nodeLabel(type, node) {
  if (!node) return "—";
  if (type === "risk") return node.scenario;
  if (type === "control") return node.friendlyName ?? node.name;
  if (type === "evidence") return node.source;
  if (type === "framework") return node.name;
  if (type === "flow") return node.note ?? node.id;
  return node.name;
}

function nodeSubtitle(type, node) {
  if (!node) return null;
  switch (type) {
    case "system": return `${node.assetCount} assets · ${node.env}`;
    case "asset": return `${node.type} · ${node.system?.name}`;
    case "control": return `${node.id} · ${node.domain}`;
    case "dataType": return `${node.sensitivity} · ${node.kind}${node.role ? ` · ${node.role}` : ""}`;
    case "risk": return `${node.id} · ${node.domain} / ${node.subcategory}`;
    case "evidence": return `${node.evidenceType} · ${node.coveragePct}% coverage · ${e_result(node)}`;
    case "framework": return `${node.clauses?.length ?? 0} clauses`;
    case "flow": return node.dataTypeIds?.join(", ");
    default: return null;
  }
}

function e_result(node) {
  return node.result ? node.result.toUpperCase() : "";
}

// The headline number a node carries, if it carries one. Nodes with no score
// (a data type, an evidence record) deliberately show nothing rather than a
// zero — the distinction this whole model is built to preserve.
function nodeScore(type, node) {
  if (!node) return null;
  if (type === "system" || type === "asset") return node.overallAssurance;
  if (type === "risk") return node.assurance?.pct ?? null;
  if (type === "evidence") return node.confidence ?? null;
  return null;
}

function BasisTag({ basis }) {
  if (!basis) return null;
  const meta = BASIS_META[basis];
  const key = basis === "measured" ? "green" : basis === "inherited" ? "accent" : basis === "assessed" ? "amber" : "na";
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      title={meta?.detail}
      style={{ color: key === "na" ? C.muted : C[key], background: key === "na" ? "transparent" : C[`${key}Bg`], border: key === "na" ? `1px solid ${C.border}` : "none" }}
    >
      {meta?.label ?? basis}
    </span>
  );
}

function ScorePill({ value }) {
  if (value == null) return <span className="text-[11px]" style={{ color: C.muted }}>—</span>;
  const key = value >= 90 ? "green" : value >= 75 ? "amber" : "red";
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded tabular-nums" style={{ color: C[key], background: C[`${key}Bg`], fontFamily: "'IBM Plex Mono', monospace" }}>
      {value}
    </span>
  );
}

function NodeRow({ type, node, active, onSelect, showScore = true }) {
  if (!node) return null;
  const { Icon } = NODE_TYPES[type] ?? {};
  return (
    <button
      onClick={() => onSelect(type, node.id)}
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
function Facts({ rows }) {
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

function factsFor(type, node) {
  switch (type) {
    case "system":
      return [
        { label: "Classification", value: node.classification },
        { label: "Hosting", value: node.hostingType },
        { label: "Assurance", value: `${node.overallAssurance} (${node.assuranceBand.label})` },
        { label: "Control-backed", value: `${node.controlBackedPct}%` },
        { label: "Assets", value: node.assetCount },
        { label: "Weakest asset", value: node.weakestAsset?.name },
        { label: "Standards", value: node.standards.join(", ") },
        { label: "Controls evidenced", value: `${node.evidencedControlCount} of ${node.requiredControlCount}` },
      ];
    case "asset":
      return [
        { label: "Classification", value: node.classification },
        { label: "Criticality", value: `${node.criticality} (${node.criticalityBand.label})` },
        { label: "Assurance", value: `${node.overallAssurance} (${node.assuranceBand.label})` },
        { label: "Control-backed", value: `${node.controlBackedPct}%` },
        { label: "Evidence confidence", value: node.evidenceConfidence },
        { label: "Residual risk", value: `${node.residualRisk.score} (${node.residualRisk.band.label})` },
        { label: "Controls required", value: node.requiredControlCount },
        { label: "Deficient controls", value: node.deficientControls.length },
      ];
    case "control":
      return [
        { label: "SCF id", value: node.id },
        { label: "Domain", value: node.domain },
        { label: "Category", value: node.category },
        { label: "Scope", value: node.scope === "program" ? "Program-wide" : "Per asset" },
        { label: "Implementation type", value: node.implementationType },
        { label: "Tooling", value: node.toolHint },
        { label: "Frameworks", value: node.frameworks.map((f) => f.standard).join(", ") },
      ];
    case "dataType":
      return [
        { label: "Sensitivity", value: node.sensitivity },
        { label: "Kind", value: node.kind },
        { label: "Regulated by", value: node.regulatedBy.length ? node.regulatedBy.join(", ") : "Contractual only" },
      ];
    case "risk":
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
    case "evidence":
      return [
        { label: "Type", value: node.evidenceType },
        { label: "Result", value: node.result.toUpperCase() },
        { label: "Coverage", value: `${node.coveragePct}%` },
        { label: "Collected", value: `${node.collectedAt} (${node.ageDays}d ago)` },
        { label: "Valid for", value: `${node.validForDays} days` },
        { label: "Freshness factor", value: node.freshness },
        { label: "Independence", value: node.independence },
        { label: "Confidence", value: node.confidence },
      ];
    default:
      return [];
  }
}

function Inspector({ type, id, onSelect }) {
  const node = NODE_TYPES[type]?.get(id);
  if (!node) return null;
  const neighbors = getNeighbors(type, id);
  const { Icon } = NODE_TYPES[type];

  const description =
    type === "dataType" ? node.description :
    type === "risk" ? node.description :
    type === "control" ? node.description :
    type === "system" ? node.mission :
    type === "evidence" ? node.note :
    null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-start gap-3 mb-3">
          <Icon size={18} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{nodeLabel(type, node)}</div>
            <div className="text-xs" style={{ color: C.muted }}>{nodeSubtitle(type, node)}</div>
          </div>
          {node.classification && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0" style={{ background: CLASS_META[node.classification]?.bg, color: CLASS_META[node.classification]?.color }}>
              {node.classification}
            </span>
          )}
        </div>
        {description && <p className="text-xs mb-3 leading-relaxed" style={{ color: C.muted }}>{description}</p>}
        <Facts rows={factsFor(type, node)} />
        {type === "asset" && node.classificationDetail?.drivenBy?.length > 0 && (
          <div className="mt-3 pt-3 text-[11px] leading-relaxed" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
            Classified {node.classification} because it {node.classificationDetail.drivenBy[0].role} {node.classificationDetail.drivenBy.map((d) => d.dataType.name).join(", ")}.
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
            {group.nodes.filter(Boolean).map((n, i) => (
              <NodeRow
                key={`${n.id}-${i}`}
                type={group.type}
                node={n}
                onSelect={NODE_TYPES[group.type] ? onSelect : () => {}}
                showScore={Boolean(NODE_TYPES[group.type])}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Derivation trace -------------------------------------------------------------
function Trace({ target, onSelect }) {
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
              {typeof step.value === "number" ? <ScorePill value={step.value} /> : <span className="text-[11px] font-medium shrink-0" style={{ color: C.ink }}>{step.value}</span>}
              {step.next && (
                <button onClick={() => onSelect(step.next)} className="shrink-0 rounded p-0.5" title="Trace this input" style={{ color: C.accent }}>
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
function HealthStat({ label, value, hint }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.ink }}>{label}</div>
      {hint && <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{hint}</div>}
    </div>
  );
}

function FindingList({ title, items, render, empty }) {
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

function ModelHealth({ onSelect }) {
  const health = useMemo(() => modelHealth(), []);
  const enterprise = getEnterprise();

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading icon={Activity} hint="what the model is standing on">Coverage</SectionHeading>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <HealthStat label="Enterprise assurance" value={enterprise.assurance} hint="Criticality-weighted across both systems." />
          <HealthStat label="Control-backed" value={`${health.coverage.controlBackedPct}%`} hint="Share of tracked key controls with real evidence behind them. The rest rests on category-level assessment." />
          <HealthStat label="Compliance measured" value={`${health.coverage.measuredCompliancePct}%`} hint="Share of in-scope framework controls with a control-level implementation rather than an inherited or assessed status." />
          <HealthStat label="Implementations" value={health.counts.implementations} hint={`Across ${health.counts.assets} assets and ${health.counts.keyControls} key controls.`} />
          <HealthStat label="Evidence records" value={health.counts.evidenceRecords} />
          <HealthStat label="Data flows" value={health.counts.dataFlows} hint={`Carrying ${health.counts.dataTypes} data types.`} />
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
        {health.coverage.alwaysAssessedCategories.length > 0 && (
          <div className="rounded-xl p-4 mt-3 text-xs leading-relaxed" style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.muted }}>
            <span style={{ color: C.ink, fontWeight: 600 }}>{health.coverage.alwaysAssessedCategories.join(", ")}</span> is assessed at category level for every asset,
            because every key control in it is program-scoped — running a risk assessment or governing the AI lifecycle is something ACME does once, not something each
            bucket does separately. Surfaced here so it reads as a deliberate modelling choice rather than missing data.
          </div>
        )}
      </div>

      <div>
        <SectionHeading icon={Boxes} hint="lowest first">Control-level backing by asset</SectionHeading>
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="space-y-1.5">
            {health.controlBackedByAsset.map((a) => (
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
            title="Deficient implementations"
            items={health.findings.deficient}
            empty="No tracked control is currently failing its evidence."
            render={(i) => (
              <button key={`${i.assetId}-${i.controlId}`} onClick={() => onSelect("asset", i.assetId)} className="w-full text-left rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.control.friendlyName}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{i.assetId} · score {i.score}</div>
              </button>
            )}
          />
          <FindingList
            title="Required but not implemented"
            items={health.findings.notImplemented}
            empty="Every required control has an implementation."
            render={(i) => (
              <div key={`${i.assetId}-${i.controlId}`} className="rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.control.friendlyName} — {i.assetId}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{i.note}</div>
              </div>
            )}
          />
          <FindingList
            title="Unevidenced implementations"
            items={health.findings.unevidenced}
            empty="Every implementation has at least one evidence record."
            render={(i) => (
              <div key={`${i.assetId}-${i.controlId}`} className="rounded-lg px-3 py-1.5" style={{ background: C.panel2 }}>
                <div className="text-xs" style={{ color: C.ink }}>{i.control.friendlyName} — {i.assetId}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>Falls back to the {i.category} assessment.</div>
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
                <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>{x.exception.reason}</div>
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
  const [tab, setTab] = useState("explore");
  const [type, setType] = useState("asset");
  const [selected, setSelected] = useState({ type: "asset", id: "AST-003-03" });
  const [traceTarget, setTraceTarget] = useState({ type: "asset", id: "AST-003-03" });

  function select(nextType, id) {
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
        description="Every page in this app is a lens on the same graph of facts and relationships. This is the graph itself — pick any node to see what it connects to, and trace any derived number back through the chain that produced it, down to the evidence record and the day it was collected."
        right={
          <div className="flex items-center gap-2">
            {[["explore", "Explore"], ["health", "Model Health"]].map(([key, label]) => (
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
              {Object.entries(NODE_TYPES).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className="px-2 py-1 rounded text-[11px] font-medium"
                  style={{ background: type === key ? C.accentBg : "transparent", color: type === key ? C.accent : C.muted, border: `1px solid ${type === key ? C.accent : C.border}` }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {list.map((n) => (
                <NodeRow key={n.id} type={type} node={n} active={selected.type === type && selected.id === n.id} onSelect={select} />
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
