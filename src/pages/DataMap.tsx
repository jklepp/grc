import React, { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Network, AlertTriangle, X, KeyRound, User, Cpu, Database, DatabaseBackup, Workflow, LayoutList, Download, Loader2, UserCog, Rocket, Fingerprint, RotateCcw } from "lucide-react";
import { C, CLASS_META } from "../theme";
import { PageHeader } from "../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../components/SystemBadges";
import {
  getAsset, getAllDataTypes, dataForAsset,
  INSTANCE_STATUS_META, PRISMA_LEVELS, ASSURANCE_TARGET,
  ACTOR_KINDS, resilienceForSystem, IMPACT_LEVEL_LABELS, IMPACT_LEVEL_SHORT,
} from "../engine";
import { buildDataFlowDiagram, buildControlPlaneMatrix } from "../utils/flowDiagramLayout";
import FlowDiagramSVG, { FlowDiagramLegend } from "../components/FlowDiagramSVG";
import FlowMatrixSVG, { FlowMatrixLegend } from "../components/FlowMatrixSVG";
import { exportFlowDiagramPdf } from "../utils/exportFlowDiagramPdf";
import type { FlowLayout } from "../utils/flowDiagramLayout";
import type { AssetRollup, SystemRollup } from "../engine";
import type { AssetId, DataTypeId, SystemId } from "../graph/ids";
import { useLiveEngine } from "../engine/useLiveEngine";

type LayoutAsset = FlowLayout["stages"][number]["nodes"][number];
type LayoutStage = FlowLayout["stages"][number];
type LayoutActor = FlowLayout["ingressActors"][number]["actor"];
type ActorAccess = FlowLayout["ingressActors"][number];
type WorkforceIngress = FlowLayout["workforceIngress"];
type EgressEntries = FlowLayout["egress"];
type ResiliencePosture = ReturnType<typeof resilienceForSystem>;
type RolesFor = (assetId: AssetId) => string[] | null;
interface DisplayBand { label: string; color: string }

// Worst first — an asset's problems belong at the top of its own list.
const INSTANCE_ORDER = ["not-implemented", "partial", "undetermined", "implemented", "not-applicable"];

function colorFor(key: string): { color: string; bg: string } {
  if (key === "green") return { color: C.green, bg: C.greenBg };
  if (key === "amber") return { color: C.amber, bg: C.amberBg };
  if (key === "red") return { color: C.red, bg: C.redBg };
  if (key === "accent") return { color: C.accent, bg: C.accentBg };
  return { color: C.muted, bg: C.panel2 };
}

// The shared `na` token is a light-to-medium grey tuned for small dots and
// borders elsewhere in the app; on the flow diagram's Control Plane rail and
// MACHINE badge it's a solid fill behind white text, where that lighter grey
// reads low-contrast. Darkened here rather than in theme.js so the shared
// token (and its other, smaller uses) is untouched.
function naFill() {
  return `color-mix(in srgb, ${C.na} 60%, black)`;
}


function AssuranceChip({ label, value, band }: { label: string; value: ReactNode; band: DisplayBand }) {
  const { color, bg } = colorFor(band.color);
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{value}</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: bg }}>{band.label}</span>
      </div>
    </div>
  );
}

// AssuranceCategoryBar and PROFILE_STATUS_META are gone with the per-asset
// category rollups and per-asset profile evaluation they drew. Categories are
// still scored and still evaluated against the tier profile — once per system,
// on the Control Profile page.
function AssuranceRiskCard({ title, risk }: { title: string; risk: AssetRollup["inherentRisk"] }) {
  const { color, bg } = colorFor(risk.band.color);
  return (
    <div className="rounded-lg p-2.5 flex-1" style={{ background: C.panel2 }}>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.muted }}>{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{risk.score}<span className="text-[10px] font-normal" style={{ color: C.muted }}> /25</span></div>
      <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-1" style={{ color, background: bg }}>{risk.band.label}</span>
    </div>
  );
}

// Depth is derived by walking inbound data edges, so a stage has no stored
// name to print. Depth 0 is whatever nothing else in the boundary feeds
// (seeded from ingress-kind assets, so it's a role, not a coincidence of
// position). Everything else is labelled by how many hops from ingress it
// sits — Egress is deliberately NOT one of these labels: it's a separate,
// explicit role (BOUNDARY_EGRESS_KINDS) rendered in its own section below,
// because the deepest stage the walk reaches is just as often an internal
// worker or log feed as an actual boundary component.
function stageLabel(depth: number): string {
  if (depth === 0) return "Web Ingress";
  return `Stage ${depth}`;
}

// Fixed height + single-line truncation (with a title tooltip for the full
// text) keeps every card in a wrapped row the same height regardless of name
// length or whether it carries a footer line — so a row's height is set by
// the layout, not by whichever card happens to have the longest name.
//
// `compact` drops that fixed height instead of reserving footer space: Data
// Plane / Control Plane cards almost always carry a fed-by/protects footer,
// so pinning it to the bottom of a fixed-height card keeps that section
// aligned. Ingress/Stage/Egress cards only grow a footer when a data-type
// filter is active — reserving space for one they don't have most of the
// time just made every path-stage tile taller than it needed to be.
const NODE_CARD_WIDTH = 200;
const NODE_CARD_HEIGHT = 98;
// ActorCard keeps its own constant rather than sharing NODE_CARD_WIDTH, so it
// can be tuned independently of the stage cards.
const ACTOR_CARD_WIDTH = 176;
// Data Plane / Control Plane cards carry the same content as a stage card
// plus a near-always-present fed-by/protects footer, so they get their own,
// wider-and-shorter footprint instead of inheriting the stage card's — that
// footer line (often a long code list) needs the width, and the fixed height
// only needs to fit 2-3 short lines, not the taller box a stage card reserves.
const WIDE_NODE_CARD_WIDTH = 240;
const WIDE_NODE_CARD_HEIGHT = 72;

// Left rail carries identity (code) and status (score) as two color-coded
// bands rather than inline text, so both read at a glance without adding a
// line to the card. The bottom border repeats the score color a second time
// — redundant with the rail, but it's what lets a whole row of cards read as
// a strip of status color even when you're not close enough to read digits.
interface NodeCardProps {
  asset: LayoutAsset;
  footer?: string | null;
  selected: boolean;
  onSelect: (assetId: AssetId) => void;
  isBranch?: boolean;
  compact?: boolean;
  width?: number;
  height?: number;
}

function NodeCard({ asset, footer, selected, onSelect, isBranch = false, compact = false, width = NODE_CARD_WIDTH, height }: NodeCardProps) {
  // FIPS 199 impact level, not assurance. An asset has no assurance score —
  // the controls that apply to it are scored once against its system — so the
  // band a card can honestly carry is how much its compromise would cost.
  const { color } = colorFor(asset.impactLevelBand.color);
  const cardHeight = height !== undefined ? height : (compact ? undefined : NODE_CARD_HEIGHT);
  return (
    <button
      onClick={() => onSelect(asset.id)}
      className="rounded-xl overflow-hidden shrink-0 text-left transition-colors flex flex-col"
      style={{ background: C.panel, border: `1px solid ${selected ? C.accent : C.border}`, width, height: cardHeight }}
    >
      <div className="flex flex-1 min-w-0">
        <div className="flex flex-col shrink-0" style={{ width: 40 }}>
          <div className="flex-1 flex items-center justify-center" style={{ background: isBranch ? naFill() : C.accent }}>
            <span className="text-[10px] font-bold" style={{ color: "#fff" }}>{asset.code}</span>
          </div>
          <div className="flex-1 flex items-center justify-center" style={{ background: color }}>
            <span className="text-[10px] font-bold" style={{ color: "#fff" }}>{IMPACT_LEVEL_SHORT[asset.impactLevel]}</span>
          </div>
        </div>
        <div className="p-2 flex-1 flex flex-col min-w-0 justify-center">
          <div className="text-xs font-semibold leading-tight truncate" style={{ color: C.ink }} title={asset.name}>{asset.name}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }} title={asset.type}>{asset.type}</div>
          {footer && (
            <div className="text-[10px] mt-0.5 truncate" style={{ color: C.accent }} title={footer}>{footer}</div>
          )}
        </div>
      </div>
      <div className="shrink-0" style={{ height: 3, background: color }} />
    </button>
  );
}

function ActorCard({ actor }: { actor: LayoutActor }) {
  const isHuman = actor.kind === ACTOR_KINDS.HUMAN;
  const Icon = isHuman ? User : Cpu;
  return (
    <div
      className="rounded-xl overflow-hidden shrink-0 text-left p-1.5 flex flex-col"
      style={{ background: C.panel, border: `1px solid ${C.border}`, width: ACTOR_CARD_WIDTH }}
    >
      <div className="flex items-center justify-between gap-1.5 mb-0.5">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: isHuman ? C.accent : naFill(), color: "#fff" }}>
          {isHuman ? "HUMAN" : "MACHINE"}
        </span>
        <Icon size={13} color={C.muted} className="shrink-0" />
      </div>
      <div className="text-xs font-semibold leading-tight truncate" style={{ color: C.ink }} title={actor.name}>{actor.name}</div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }} title={actor.description}>{actor.description}</div>
    </div>
  );
}

function SectionLabel({ children, hint, icon: Icon }: { children: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      {Icon && <Icon size={12} color={C.accent} />}
      <span
        className="text-[10px] uppercase tracking-widest font-semibold leading-none"
        style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}
        title={hint}
      >
        {children}
      </span>
    </div>
  );
}

function ActorRow({ actorAccess, title, hint, icon, isFirst }: { actorAccess: readonly ActorAccess[]; title: string; hint?: string; icon?: LucideIcon; isFirst?: boolean }) {
  if (actorAccess.length === 0) return null;
  return (
    <div className="flex flex-col items-start w-full" style={isFirst ? undefined : { marginTop: 12, paddingTop: 10, borderTop: `1px dotted ${C.green}` }}>
      <SectionLabel hint={hint} icon={icon}>{title}</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full">
        {actorAccess.map(({ actor }) => (
          <ActorCard key={actor.id} actor={actor} />
        ))}
      </div>
    </div>
  );
}

function StageRow({ stage, isFirst, flushTop, selectedKey, onSelectNode, rolesFor }: { stage: LayoutStage; isFirst?: boolean; flushTop?: boolean; selectedKey: AssetId | null; onSelectNode: (id: AssetId) => void; rolesFor: RolesFor }) {
  return (
    <>
      {!isFirst && (
        <div
          className="-mx-6"
          style={{
            marginTop: flushTop ? 0 : 12,
            marginBottom: 10,
            borderTop: flushTop ? `1px dotted ${C.green}` : `1px solid ${C.borderStrong}`,
          }}
        />
      )}
      <div className="flex flex-col items-start w-full">
        <SectionLabel icon={Cpu}>{stageLabel(stage.depth)}</SectionLabel>
        <div className="flex flex-wrap items-start justify-center gap-3 w-full">
          {stage.nodes.map((asset) => (
            <NodeCard key={asset.id} asset={asset} footer={rolesFor(asset.id)?.join(" · ")} selected={asset.id === selectedKey} onSelect={onSelectNode} compact />
          ))}
        </div>
      </div>
    </>
  );
}

function WorkforceIngressRow({ ingress, selectedKey, onSelectNode }: { ingress: WorkforceIngress; selectedKey: AssetId | null; onSelectNode: (id: AssetId) => void }) {
  if (ingress.length === 0) return null;
  return (
    <>
      <div className="-mx-6" style={{ marginTop: 12, marginBottom: 10, borderTop: `1px dotted ${C.green}` }} />
      <div className="flex flex-col items-start w-full">
        <SectionLabel icon={Fingerprint} hint="how workforce (employee/admin) traffic reaches a privileged asset — a separate path from the customer/partner request path above">
          Ingress - Workforce
        </SectionLabel>
        <div className="flex flex-wrap items-start justify-center gap-3 w-full">
          {ingress.map(({ asset, grantsAccessTo }) => (
            <NodeCard
              key={asset.id}
              asset={asset}
              footer={grantsAccessTo.length > 0 ? `grants access to ${grantsAccessTo.map((p) => p.code).join(" · ")}` : null}
              selected={asset.id === selectedKey}
              onSelect={onSelectNode}
              compact
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Column variants of ActorRow/StageRow/EgressRow: same label-over-cards
// shape, but sized to sit side-by-side in a two-column row instead of
// stacking full-width, and with no border-top/isFirst logic of their own —
// that separator belongs to the row wrapping them, not to each column.
function ActorColumn({ actorAccess, title, hint, icon }: { actorAccess: readonly ActorAccess[]; title: string; hint?: string; icon?: LucideIcon }) {
  if (!actorAccess || actorAccess.length === 0) return null;
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <SectionLabel hint={hint} icon={icon}>{title}</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full">
        {actorAccess.map(({ actor }) => (
          <ActorCard key={actor.id} actor={actor} />
        ))}
      </div>
    </div>
  );
}

function StageColumn({ stage, selectedKey, onSelectNode, rolesFor }: { stage?: LayoutStage; selectedKey: AssetId | null; onSelectNode: (id: AssetId) => void; rolesFor: RolesFor }) {
  if (!stage) return null;
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <SectionLabel>{stageLabel(stage.depth)}</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full pt-2">
        {stage.nodes.map((asset) => (
          <NodeCard key={asset.id} asset={asset} footer={rolesFor(asset.id)?.join(" · ")} selected={asset.id === selectedKey} onSelect={onSelectNode} compact />
        ))}
      </div>
    </div>
  );
}

function EgressColumn({ egress, selectedKey, onSelectNode, rolesFor }: { egress: EgressEntries; selectedKey: AssetId | null; onSelectNode: (id: AssetId) => void; rolesFor: RolesFor }) {
  if (!egress || egress.length === 0) return null;
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <SectionLabel>Web Egress</SectionLabel>
      <div className="flex flex-wrap items-start justify-center gap-3 w-full pt-2">
        {egress.map(({ asset }) => (
          <NodeCard key={asset.id} asset={asset} footer={rolesFor(asset.id)?.join(" · ")} selected={asset.id === selectedKey} onSelect={onSelectNode} compact />
        ))}
      </div>
    </div>
  );
}

// The vertical rule between columns — dotted blue, matching the Outside
// Trust Boundary box these rows always sit inside — only drawn when both
// columns actually have content, since a lone column has nothing to divide.
// The horizontal rule between stacked rows (e.g. Actors row above the Web
// Ingress/Egress row) uses the same dotted blue treatment rather than the
// plain gray divider used elsewhere, and is pulled out with -mx-6 to cancel
// the Outside Trust Boundary box's own px-6 padding so it spans edge to edge
// like the box border, instead of stopping at the row's own content width.
function TwoColumnRow({ isFirst, left, right }: { isFirst?: boolean; left?: ReactNode; right?: ReactNode }) {
  if (!left && !right) return null;
  return (
    <>
      {!isFirst && <div className="-mx-6" style={{ marginTop: 12, marginBottom: 10, borderTop: `1px dotted ${C.amber}` }} />}
      <div className="flex items-start gap-6 w-full">
        {left}
        {left && right && <div className="shrink-0 self-stretch" style={{ borderLeft: `1px dotted ${C.amber}` }} />}
        {right}
      </div>
    </>
  );
}

function FlowChart({ layout, resilience, selectedKey, onSelectNode, rolesFor }: {
  layout: FlowLayout;
  resilience: ResiliencePosture;
  selectedKey: AssetId | null;
  onSelectNode: (id: AssetId) => void;
  rolesFor: RolesFor;
}) {
  if (
    layout.stages.length === 0 && layout.dataPlane.length === 0 && layout.egress.length === 0
    && (!layout.softwareDeployment || layout.softwareDeployment.length === 0)
    && (!layout.backupRecovery || layout.backupRecovery.length === 0)
    && (!layout.workforceIngress || layout.workforceIngress.length === 0)
  ) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
        No asset in this boundary carries the selected data type.
      </div>
    );
  }
  const hasIngressActors = layout.ingressActors && layout.ingressActors.length > 0;
  const hasEgressActors = layout.egressActors && layout.egressActors.length > 0;
  const hasInternalActors = layout.internalActors && layout.internalActors.length > 0;
  const hasWorkforceIngress = layout.workforceIngress && layout.workforceIngress.length > 0;
  // Ingress - Web is specifically the depth-0 stage (see stageLabel), which
  // pairs with Egress as row two. Any deeper stage (Stage 1, Stage 2, ...) is
  // internal processing — ACME-operated, same as the data/control plane below
  // it — so it renders inside the trust boundary rather than above it.
  const ingressWebStage = layout.stages.find((s) => s.depth === 0);
  const remainingStages = layout.stages.filter((s) => s.depth !== 0);

  const hasBoundaryStages = remainingStages.length > 0;
  const hasActorsBlock = hasInternalActors || hasWorkforceIngress;
  const hasDataPlane = layout.dataPlane.length > 0;
  const hasControlPlane = layout.branches.length > 0;
  const hasSoftwareDeployment = layout.softwareDeployment && layout.softwareDeployment.length > 0;
  const hasBackupRecovery = layout.backupRecovery && layout.backupRecovery.length > 0;
  const hasTrustedSection = hasBoundaryStages || hasActorsBlock || hasDataPlane || hasControlPlane || hasSoftwareDeployment || hasBackupRecovery;
  // Which of the (fixed-order) boundary sections is first — that one skips
  // the top separator every other present section gets. Also tracked which
  // is last, so the actors block (the only one with its own fill background)
  // knows whether to bleed to the System Boundary box's bottom edge too.
  const presentBoundarySections = [
    hasActorsBlock && "actors",
    hasBoundaryStages && "stages",
    hasDataPlane && "dataPlane",
    hasControlPlane && "controlPlane",
    hasSoftwareDeployment && "softwareDeployment",
    hasBackupRecovery && "backupRecovery",
  ].filter(Boolean);
  const firstBoundarySection = presentBoundarySections[0];
  const lastBoundarySection = presentBoundarySections[presentBoundarySections.length - 1];

  const rowA = (hasIngressActors || hasEgressActors) && (
    <TwoColumnRow
      isFirst
      left={hasIngressActors && <ActorColumn actorAccess={layout.ingressActors} title="Actors - External" />}
      right={hasEgressActors && (
        <ActorColumn
          actorAccess={layout.egressActors}
          title="Actors - External"
          hint="external destinations reached from within the request path — not always from the Egress stage itself"
        />
      )}
    />
  );
  const rowB = (ingressWebStage || layout.egress.length > 0) && (
    <TwoColumnRow
      isFirst={!rowA}
      left={ingressWebStage && <StageColumn stage={ingressWebStage} selectedKey={selectedKey} onSelectNode={onSelectNode} rolesFor={rolesFor} />}
      right={layout.egress.length > 0 && <EgressColumn egress={layout.egress} selectedKey={selectedKey} onSelectNode={onSelectNode} rolesFor={rolesFor} />}
    />
  );

  const hasUntrustedSection = Boolean(rowA || rowB);

  return (
    <div className="rounded-2xl p-6" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      {/* Everything above the trust boundary crosses in from outside ACME's
          control — end users, partners, the open internet. It is inherently
          less trustworthy than anything inside, so it gets its own tint and
          label, mirroring the Trust Boundary box below rather than reading
          as just "the top of the panel." */}
      {hasUntrustedSection && (
        <div
          className="relative pt-6 px-6 pb-5 -mx-6 -mt-6 rounded-t-2xl"
          style={{
            background: `color-mix(in srgb, ${C.amber} 6%, ${C.panel2})`,
            border: `1px dashed ${C.amber}`,
            borderBottom: "none",
          }}
        >
          <span
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: C.panel2, color: C.amber, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Outer System Boundary
          </span>
          <div className="flex flex-col items-stretch">
            {rowA}
            {rowB}
          </div>
        </div>
      )}

      {/* Everything ACME operates and trusts directly, as opposed to the
          request path above (which crosses out to actual end users and
          partners). Boxed and labelled as one trust boundary rather than
          left as separate sections, since that's the actual security
          claim being made about this group. */}
      {hasTrustedSection && (
        <div className="relative pt-6 px-6 pb-6 -mx-6 -mb-6 rounded-b-2xl" style={{ border: `1px dashed ${C.green}` }}>
          <span
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: C.panel2, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            System Boundary
          </span>

          {hasActorsBlock && (
            <>
              {firstBoundarySection !== "actors" && <div className="-mx-6" style={{ marginTop: 16, marginBottom: 12, borderTop: `1px solid ${C.borderStrong}` }} />}
              <div
                className={`flex flex-col items-stretch -mx-6 px-6 ${lastBoundarySection === "actors" ? "rounded-b-2xl" : ""}`}
                style={{
                  background: `color-mix(in srgb, ${C.green} 6%, ${C.panel2})`,
                  marginTop: firstBoundarySection === "actors" ? -24 : 0,
                  paddingTop: firstBoundarySection === "actors" ? 24 : 12,
                  marginBottom: lastBoundarySection === "actors" ? -24 : 0,
                  paddingBottom: lastBoundarySection === "actors" ? 24 : 12,
                }}
              >
              {hasInternalActors && (
                <ActorRow
                  actorAccess={layout.internalActors}
                  title="Actors - Internal"
                  icon={UserCog}
                  hint="operates the platform directly — standing reach into the data plane and control plane rather than a request-path call"
                  isFirst
                />
              )}
              {hasWorkforceIngress && (
                <WorkforceIngressRow ingress={layout.workforceIngress} selectedKey={selectedKey} onSelectNode={onSelectNode} />
              )}
              </div>
            </>
          )}

          {hasBoundaryStages && (
            <div className="flex flex-col items-stretch">
              {remainingStages.map((s, i) => (
                <StageRow
                  key={s.depth}
                  stage={s}
                  isFirst={firstBoundarySection === "stages" && i === 0}
                  flushTop={i === 0 && firstBoundarySection === "actors"}
                  selectedKey={selectedKey}
                  onSelectNode={onSelectNode}
                  rolesFor={rolesFor}
                />
              ))}
            </div>
          )}

          {layout.dataPlane.length > 0 && (
            <>
              <div className="-mx-6" style={{ marginTop: 16, marginBottom: 12, borderTop: `1px solid ${C.borderStrong}` }} />
              <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Database size={12} color={C.accent} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Data plane
                </span>
                <span className="text-[11px]" style={{ color: C.muted }}>
                  — persistent and stateful stores used by the system
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {layout.dataPlane.map(({ asset, fedBy }) => (
                  <NodeCard
                    key={asset.id}
                    asset={asset}
                    footer={fedBy.length > 0 ? `fed by ${fedBy.map((p) => p.code).join(" · ")}` : null}
                    selected={asset.id === selectedKey}
                    onSelect={onSelectNode}
                    width={WIDE_NODE_CARD_WIDTH}
                    height={WIDE_NODE_CARD_HEIGHT}
                  />
                ))}
              </div>
              </div>
            </>
          )}

          {layout.branches.length > 0 && (
            <>
              <div className="-mx-6" style={{ marginTop: 16, marginBottom: 12, borderTop: `1px solid ${C.borderStrong}` }} />
              <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <KeyRound size={12} color={C.accent} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Control plane
                </span>
                <span className="text-[11px]" style={{ color: C.muted }}>
                  — not in the request path; these protect the assets above rather than carrying data through them
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {layout.branches.map(({ asset, protects }) => (
                  <NodeCard
                    key={asset.id}
                    asset={asset}
                    footer={protects.length > 0 ? `protects ${protects.map((p) => p.code).join(" · ")}` : null}
                    selected={asset.id === selectedKey}
                    onSelect={onSelectNode}
                    isBranch
                    width={WIDE_NODE_CARD_WIDTH}
                    height={WIDE_NODE_CARD_HEIGHT}
                  />
                ))}
              </div>
              </div>
            </>
          )}

          {layout.softwareDeployment && layout.softwareDeployment.length > 0 && (
            <>
              <div className="-mx-6" style={{ marginTop: 16, marginBottom: 12, borderTop: `1px solid ${C.borderStrong}` }} />
              <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Rocket size={12} color={C.accent} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Software Deployment
                </span>
                <span className="text-[11px]" style={{ color: C.muted }}>
                  — pushes ACME's own code and infrastructure changes into this boundary; not part of the live request path
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {layout.softwareDeployment.map(({ asset, deploysTo }) => (
                  <NodeCard
                    key={asset.id}
                    asset={asset}
                    footer={deploysTo.length > 0 ? `deploys to ${deploysTo.map((p) => p.code).join(" · ")}` : null}
                    selected={asset.id === selectedKey}
                    onSelect={onSelectNode}
                    isBranch
                    width={WIDE_NODE_CARD_WIDTH}
                    height={WIDE_NODE_CARD_HEIGHT}
                  />
                ))}
              </div>
              </div>
            </>
          )}

          {layout.backupRecovery && layout.backupRecovery.length > 0 && (
            <>
              <div className="-mx-6" style={{ marginTop: 16, marginBottom: 12, borderTop: `1px solid ${C.borderStrong}` }} />
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <DatabaseBackup size={12} color={C.accent} />
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Backup &amp; Recovery
                  </span>
                  <span className="text-[11px]" style={{ color: C.muted }}>
                    — asynchronous protection and controlled restore paths; not part of the live request path
                  </span>
                </div>
                {resilience.backup && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {resilience.backup.immutable && <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ color: C.accent, background: C.accentBg }}>Immutable</span>}
                    {resilience.backup.crossRegion && <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ color: C.accent, background: C.accentBg }}>Cross-region</span>}
                    <span className="text-[10px] px-2 py-1 rounded-full" style={{ color: C.muted, background: C.panel }}>
                      RPO {resilience.backup.rpoTargetMinutes}m · RTO {resilience.backup.rtoTargetMinutes}m
                    </span>
                    {resilience.lastDrTest && (
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ color: resilience.targetsMetLastTest ? C.green : C.amber, background: resilience.targetsMetLastTest ? C.greenBg : C.amberBg }}>
                        Restore tested {resilience.lastDrTest.conductedAt}{resilience.targetsMetLastTest ? " · targets met" : ""}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {layout.backupRecovery.map(({ asset, backedUpFrom, restoresTo }) => (
                    <NodeCard
                      key={asset.id}
                      asset={asset}
                      footer={backedUpFrom.length > 0
                        ? `protects ${backedUpFrom.map((source) => source.code).join(" · ")}${restoresTo.length > 0 ? " · restore path verified" : ""}`
                        : null}
                      selected={asset.id === selectedKey}
                      onSelect={onSelectNode}
                      isBranch
                      width={WIDE_NODE_CARD_WIDTH}
                      height={WIDE_NODE_CARD_HEIGHT}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// The weakest CONTROL in the boundary, not the weakest asset.
//
// This banner used to name whichever asset scored lowest. That was always a
// vaguer statement than it looked — an asset is a container, and "the vector
// database is weakest" does not tell anybody what to go and fix. Naming the
// requirement that is failing does, and the instances beneath it name the
// asset anyway.
function WeakestLinkBanner({ system }: { system: SystemRollup }) {
  const weak = system.weakestControl;
  if (!weak) return null;
  const strong = (weak.score ?? 0) >= ASSURANCE_TARGET;

  const failingHere = weak.instances.filter((i) => i.status === "not-implemented" || i.status === "partial");
  const worstLevel = PRISMA_LEVELS
    .map((level) => ({ level, rating: weak.levels[level].rating }))
    .reduce((w, l) => (l.rating < w.rating ? l : w));

  const reason = failingHere.length > 0
    ? `${joinAnd([...new Set(failingHere.map((f) => f.asset.name))])} ${failingHere.length > 1 ? "are" : "is"} not holding it.`
    : `Weakest at ${worstLevel.level}: ${weak.levels[worstLevel.level].rationale}`;

  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: strong ? C.panel2 : C.redBg, border: `1px solid ${strong ? C.border : C.red + "4D"}` }}>
      <AlertTriangle size={16} color={strong ? C.muted : C.red} className="shrink-0" />
      <div className="text-sm" style={{ color: C.ink }}>
        {strong ? (
          <>Every assessed control in this boundary scores <span style={{ fontWeight: 600 }}>{ASSURANCE_TARGET} or better</span> — no weak link to flag right now.</>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>Weakest control: {weak.controlId} — {weak.control.name}</span>{" "}
            <span style={{ color: C.muted }}>({weak.score})</span> · {reason}
          </>
        )}
      </div>
    </div>
  );
}

function SystemDetailPanel({ assetId, onClose }: { assetId: AssetId; onClose: () => void }) {
  const asset = getAsset(assetId);
  if (!asset) return null;
  const { color } = colorFor(asset.impactLevelBand.color);
  const held = dataForAsset(assetId);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, maxHeight: "100vh", overflowY: "auto" }}>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.accentBg, color: C.accent }}>{asset.code}</span>
          <div className="text-base font-semibold mt-2 leading-tight" style={{ color: C.ink }}>{asset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {asset.type}
            <br />{asset.system.name} · {asset.system.id} · {asset.classification}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
          <X size={16} />
        </button>
      </div>

      {/* FIPS 199 impact level is the headline an asset can honestly carry. It
          has no assurance score: the controls that apply to it are assessed once
          against its system, and this asset is one of the samples behind that. */}
      <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-3xl font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{IMPACT_LEVEL_SHORT[asset.impactLevel]}</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{IMPACT_LEVEL_LABELS[asset.impactLevel]} Impact</div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            {asset.implementedCount} of {asset.applicableControlCount} applicable controls verified here
          </div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Data handled</div>
        <div className="space-y-1.5">
          {held.map((h) => (
            <div key={h.dataTypeId} className="flex items-center gap-2 text-[11px]">
              <span className="px-1.5 py-0.5 rounded shrink-0" style={{ background: CLASS_META[h.dataType.sensitivity].bg, color: CLASS_META[h.dataType.sensitivity].color }}>
                {h.dataType.sensitivity}
              </span>
              <span className="flex-1 min-w-0 truncate" style={{ color: C.ink }}>{h.dataType.name}</span>
              <span className="shrink-0" style={{ color: C.muted }}>{h.role}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] mt-2 leading-relaxed" style={{ color: C.muted }}>
          This is what sets the asset's {asset.classification} tier — it isn't inherited from the system.
        </div>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: C.muted }}>Consequence and coverage</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <AssuranceChip label="Impact Level" value={IMPACT_LEVEL_LABELS[asset.impactLevel]} band={asset.impactLevelBand} />
          <AssuranceChip
            label="Controls Verified"
            value={`${asset.implementedCount}/${asset.applicableControlCount}`}
            band={asset.applicableControlCount > 0 && asset.implementedCount / asset.applicableControlCount >= 0.9
              ? { label: "Verified", color: "green" }
              : asset.applicableControlCount > 0 && asset.implementedCount / asset.applicableControlCount >= 0.6
                ? { label: "Mostly", color: "amber" }
                : { label: "Sparse", color: "red" }}
          />
          <AssuranceChip
            label="Evidence Coverage"
            value={`${asset.evidenceCoveragePct}%`}
            band={asset.evidenceCoveragePct >= 90 ? { label: "Strong", color: "green" } : asset.evidenceCoveragePct >= 60 ? { label: "Partial", color: "amber" } : { label: "Sparse", color: "red" }}
          />
          <AssuranceChip label="No evidence yet" value={asset.undeterminedCount} band={asset.undeterminedCount === 0 ? { label: "None", color: "green" } : { label: "Gap", color: "amber" }} />
        </div>
        <div className="flex gap-2">
          <AssuranceRiskCard title="Inherent Risk" risk={asset.inherentRisk} />
        </div>
        <div className="text-[11px] mt-3 leading-relaxed" style={{ color: C.muted }}>
          Impact is intrinsic to this asset. Residual risk is answered on the Risk Register from
          the controls mapped to each scenario, rather than from a score for this box.
        </div>
      </div>

      {/* The drill-down. Every control that applies here and what it showed —
          the same instances the system-level assessment sampled. */}
      <div className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Controls sampled here</div>
        <div className="space-y-1.5">
          {[...asset.controls]
            .sort((a, b) => INSTANCE_ORDER.indexOf(a.status) - INSTANCE_ORDER.indexOf(b.status))
            .map((i) => {
              const meta = INSTANCE_STATUS_META[i.status];
              const muted = meta.color === "muted";
              return (
                <div key={i.controlId} className="rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: C.ink }}>{i.controlId}</span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ color: muted ? C.muted : colorFor(meta.color).color, background: muted ? "transparent" : colorFor(meta.color).bg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{i.statement}</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

interface DataMapProps {
  systemId?: SystemId | null;
  onSelectSystem?: (systemId: SystemId) => void;
  embedded?: boolean;
}

export default function DataMap({ systemId: controlledSystemId, onSelectSystem, embedded = false }: DataMapProps) {
  const liveEngine = useLiveEngine();
  const SYSTEMS = liveEngine.rollups.systemRollups;
  const ALL_ASSETS = SYSTEMS.flatMap((system) => system.assets);
  const defaultSystem = SYSTEMS[0];
  if (!defaultSystem) throw new Error("Data Map requires at least one system.");
  const [localSystemId, setLocalSystemId] = useState<SystemId>(defaultSystem.id);
  const systemId = controlledSystemId ?? localSystemId;
  const [selectedKey, setSelectedKey] = useState<AssetId | null>(null);
  const [dataTypeId, setDataTypeId] = useState<"all" | DataTypeId>("all");
  const [viewMode, setViewMode] = useState<"cards" | "diagram">("cards");
  const [exporting, setExporting] = useState(false);
  const dataSvgRef = useRef<SVGSVGElement | null>(null);
  const controlSvgRef = useRef<SVGSVGElement | null>(null);

  const system = SYSTEMS.find((s) => s.id === systemId);
  const systemDataTypes = useMemo(() => liveEngine.classification.dataTypesForSystem(systemId), [liveEngine, systemId]);
  const fullLayout = useMemo(() => liveEngine.rollups.flowLayoutForSystem(systemId), [liveEngine, systemId]);
  const resilience = useMemo(() => liveEngine.resilience.resilienceForSystem(systemId), [liveEngine, systemId]);

  // Filtering to one data type is a real query over the edges, not a second
  // dataset: keep the assets that touch it and the flows that carry it. The
  // previous model had nothing to filter on, which is why its per-data-type
  // view collapsed into a single combined chart.
  const layout = useMemo(() => {
    if (dataTypeId === "all") return fullLayout;
    const carries = (id: AssetId) => dataForAsset(id).some((h) => h.dataTypeId === dataTypeId);
    return {
      ...fullLayout,
      stages: fullLayout.stages
        .map((s) => ({ ...s, nodes: s.nodes.filter((n) => carries(n.id)) }))
        .filter((s) => s.nodes.length > 0),
      branches: fullLayout.branches.filter((b) => carries(b.asset.id) || b.protects.some((p) => carries(p.id))),
      dataPlane: fullLayout.dataPlane.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      egress: fullLayout.egress.filter((d) => carries(d.asset.id) || d.fedBy.some((p) => carries(p.id))),
      backupRecovery: fullLayout.backupRecovery.filter(
        (entry) => carries(entry.asset.id) || entry.backedUpFrom.some((source) => carries(source.id)) || entry.restoresTo.some((target) => carries(target.id))
      ),
      edges: fullLayout.edges.filter((e) => e.dataTypeIds.includes(dataTypeId)),
    };
  }, [fullLayout, dataTypeId]);

  const rolesFor = useMemo<RolesFor>(() => (assetId) => {
    if (dataTypeId === "all") return null;
    return dataForAsset(assetId).filter((h) => h.dataTypeId === dataTypeId).map((h) => h.role);
  }, [dataTypeId]);

  // The true diagrams: real point-to-point edges instead of stage buckets,
  // split into a data-movement page and a control-plane page (see
  // utils/flowDiagramLayout.js) so the control layer's fan-out doesn't bury
  // the request path. Built from the same (possibly data-type-filtered)
  // layout the card view uses, so switching views never changes what's
  // actually being shown.
  const dataFlowDiagram = useMemo(() => buildDataFlowDiagram(layout), [layout]);
  const controlPlaneMatrix = useMemo(() => buildControlPlaneMatrix(layout, getAsset), [layout]);

  function selectSystem(id: SystemId) {
    if (onSelectSystem) onSelectSystem(id);
    else setLocalSystemId(id);
    setSelectedKey(null);
    setDataTypeId("all");
  }

  async function handleExportPdf() {
    if (!dataSvgRef.current || !system) return;
    setExporting(true);
    try {
      const dataTypeLabel = dataTypeId !== "all" ? getAllDataTypes().find((d) => d.id === dataTypeId)?.name : undefined;
      await exportFlowDiagramPdf({
        dataSvgEl: dataSvgRef.current,
        dataDiagram: dataFlowDiagram,
        controlSvgEl: controlPlaneMatrix ? controlSvgRef.current : null,
        controlDiagram: controlPlaneMatrix,
        system,
        dataTypeLabel,
        layout,
        getAssetLabel: (assetId) => {
          const a = ALL_ASSETS.find((candidate) => candidate.id === assetId);
          return a ? `${a.code} — ${a.name}` : assetId;
        },
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="w-full flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-1 min-w-0">
        {!embedded && (
          <PageHeader
            icon={Network}
            title={
              system ? (
                <span className="inline-flex items-center gap-3">
                  {system.name}
                  {system.classification && <ClassificationTag level={system.classification} />}
                  <AssuranceBadge pct={system.overallAssurance} />
                </span>
              ) : "Systems Data Flow"
            }
            description="How the system is built, connected, protected, and exposed across its assets and trust boundaries."
            right={<SystemPicker systems={SYSTEMS} systemId={systemId} onSelect={selectSystem} />}
          />
        )}

        <div className="px-8 pb-4">
          {system ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setViewMode("cards")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "cards" ? C.panel : "transparent", color: viewMode === "cards" ? C.ink : C.muted }}
                    >
                      <LayoutList size={12} /> Cards
                    </button>
                    <button
                      onClick={() => setViewMode("diagram")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                      style={{ background: viewMode === "diagram" ? C.panel : "transparent", color: viewMode === "diagram" ? C.ink : C.muted }}
                      title="Real point-to-point edges, laid out from the graph — not stage buckets."
                    >
                      <Workflow size={12} /> Diagram
                    </button>
                  </div>
                  {viewMode === "diagram" && (
                    <button
                      onClick={handleExportPdf}
                      disabled={exporting}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}`, opacity: exporting ? 0.6 : 1 }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {exporting ? "Exporting…" : "Export PDF"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={dataTypeId}
                    onChange={(e) => setDataTypeId(systemDataTypes.find((dataType) => dataType.id === e.target.value)?.id ?? "all")}
                    className="text-xs pl-3 pr-7 py-2 rounded-lg font-medium"
                    style={{ background: C.panel, color: C.ink, border: `1px solid ${C.border}` }}
                  >
                    <option value="all">All data</option>
                    {systemDataTypes.map((dt) => (
                      <option key={dt.id} value={dt.id}>{dt.name}</option>
                    ))}
                  </select>
                  {dataTypeId !== "all" && (
                    <button
                      onClick={() => setDataTypeId("all")}
                      className="flex items-center justify-center p-2 rounded-lg shrink-0"
                      style={{ background: C.panel, color: C.muted, border: `1px solid ${C.border}` }}
                      title="Reset to all data"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>

              {viewMode === "cards" ? (
                <FlowChart layout={layout} resilience={resilience} selectedKey={selectedKey} onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))} rolesFor={rolesFor} />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                    <SectionLabel hint="Ingress actors through the request path to egress — the request-path story only.">
                      Data Movement
                    </SectionLabel>
                    <div className="mb-3 mt-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                      <FlowDiagramSVG
                        ref={dataSvgRef}
                        diagram={dataFlowDiagram}
                        selectedKey={selectedKey}
                        onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
                      />
                    </div>
                    <FlowDiagramLegend kinds={layout.internalActors?.length ? ["data", "actor-in", "actor-out", "actor-internal"] : ["data", "actor-in", "actor-out"]} />
                  </div>

                  {controlPlaneMatrix && (
                    <div className="rounded-2xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <SectionLabel hint="Every protector against everything it protects. Shown as a matrix rather than a diagram: this relationship is dense many-to-many (several protectors cover nearly identical asset sets), which no line-based layout can draw without crossings.">
                        Control Plane
                      </SectionLabel>
                      <div className="mb-3 mt-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                        <FlowMatrixSVG
                          ref={controlSvgRef}
                          matrix={controlPlaneMatrix}
                          selectedKey={selectedKey}
                          onSelectNode={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
                        />
                      </div>
                      <FlowMatrixLegend />
                    </div>
                  )}
                </div>
              )}

              <div className="text-[11px] mt-3" style={{ color: C.muted }}>
                {layout.edges.length} data flow{layout.edges.length === 1 ? "" : "s"} shown
                {dataTypeId !== "all" && ` carrying ${getAllDataTypes().find((d) => d.id === dataTypeId)?.name}`}
                {layout.controlPlaneEdges.length > 0 && ` · ${layout.controlPlaneEdges.length} control-plane relationships`}
              </div>
            </>
          ) : (
            <div className="rounded-2xl p-10 text-center text-sm" style={{ background: C.panel2, border: `1px dashed ${C.border}`, color: C.muted }}>
              Search for a system above to see how data moves through it.
            </div>
          )}
        </div>

        {system && (
          <div className="px-8 pb-6">
            <WeakestLinkBanner system={system} />
          </div>
        )}
      </div>

      {selectedKey && <SystemDetailPanel assetId={selectedKey} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
