// The three card types the canvas draws, plus the invisible handle set they
// share. Ported from the OneShotSec prototype's node card and re-themed onto
// the app's tokens: fixed-size card, four-pixel posture strip along the top,
// icon, name, type sub-label, one badge.
//
// ONE badge, deliberately. The asset rollup carries impact, findings, evidence
// coverage and provider as well, and showing all of them turns a clean map into
// a wall of pills. They are in the `title` tooltip and, in full, in the detail
// rail — which is where there is room to read them.
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Cpu, User } from "lucide-react";
import { CLASS_META_DARK, DARK } from "../../theme";
import type { ClassificationLabel } from "../../theme";
import { ACTOR_KINDS, IMPACT_LEVEL_LABELS } from "../../engine";
import type { AssetRollup } from "../../engine";
import { ASSET_KIND_ICON, ASSET_KIND_LABEL, assetPosture, postureFill } from "./assetKindMeta";
import { ACTOR_H, ASSET_H, NODE_W, VENDOR_H } from "./canvasLayout";

// The shared `na` token is a light-to-medium grey tuned for small dots and
// borders; as a solid fill behind white text it reads low-contrast. Darkened
// here rather than in theme.ts so the shared token's other uses are untouched.
function naFill(): string {
  return `color-mix(in srgb, ${DARK.na} 60%, black)`;
}

// Source and target on all four sides, invisible (hidden by index.css). The
// layout picks which pair each edge uses from the two boxes' geometry, so a
// line always leaves the side it is actually heading towards.
function Handles() {
  const sides = [
    [Position.Left, "l"],
    [Position.Right, "r"],
    [Position.Top, "t"],
    [Position.Bottom, "b"],
  ] as const;
  return (
    <>
      {sides.map(([position, key]) => (
        <span key={key}>
          <Handle type="source" id={`${key}-s`} position={position} />
          <Handle type="target" id={`${key}-t`} position={position} />
        </span>
      ))}
    </>
  );
}

function Badge({ bg, color, children, title }: { bg: string; color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none shrink-0"
      style={{ background: bg, color }}
      title={title}
    >
      {children}
    </span>
  );
}

export type LaneNodeData = { text: string; width: number };

// A lane header: a pill running the full width of the columns the lane covers,
// with the title centred inside it. The pill's own width is what shows the
// lane's extent, which is why there is no separate rule underneath — the bar
// and the line are the same object.
//
// Chrome, not content — pointer-events off so panning and clicking pass
// straight through it, and no handles because nothing connects to a label.
export function CanvasLaneNode({ data }: NodeProps) {
  const { text, width } = data as LaneNodeData;
  return (
    <div
      className="flex items-center justify-center pointer-events-none"
      style={{ width, height: "100%" }}
    >
      <div
        className="w-full rounded-full border py-1 text-[13px] uppercase tracking-widest font-semibold leading-none text-center truncate"
        style={{
          color: DARK.muted,
          background: DARK.panel2,
          borderColor: DARK.border,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {text}
      </div>
    </div>
  );
}

export type AssetNodeData = {
  asset: AssetRollup;
  substrate: boolean;
  selected: boolean;
  roles?: string[] | null;
};

export function CanvasAssetNode({ data }: NodeProps) {
  const { asset, substrate, selected, roles } = data as AssetNodeData;
  const Icon = ASSET_KIND_ICON[asset.kind] ?? ASSET_KIND_ICON["compute-service"];
  const posture = assetPosture(asset);
  const cls = CLASS_META_DARK[asset.classification as ClassificationLabel];

  // Everything the badge row does not have room for. One tooltip beats five
  // pills for a map you read at a glance and drill into when you care.
  const tooltip = [
    `${asset.name} — ${asset.type}`,
    `${ASSET_KIND_LABEL[asset.kind]} · ${asset.provider}`,
    `Impact ${IMPACT_LEVEL_LABELS[asset.impactLevel]} · ${asset.classification}`,
    `${asset.applicableControlCount} applicable controls · ${asset.evidenceCoveragePct}% evidenced`,
    posture.title,
  ].join("\n");

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        width: NODE_W,
        height: ASSET_H,
        background: DARK.panel,
        border: `1px solid ${selected ? DARK.accent : DARK.border}`,
        boxShadow: selected ? `0 0 0 3px ${DARK.accentBg}` : "none",
      }}
      title={tooltip}
    >
      <Handles />
      <div className="shrink-0" style={{ height: 4, background: postureFill(posture) }} />
      <div className="flex items-start gap-2 px-2.5 pt-2 flex-1 min-w-0">
        <Icon size={15} color={DARK.muted} className="shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: DARK.ink }}>
            {asset.name}
          </div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: DARK.muted }}>
            {roles?.length ? roles.join(" · ") : asset.type}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 px-2.5 pb-2 pt-1 shrink-0">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded leading-none shrink-0"
          style={{ background: DARK.accent, color: "#fff" }}
        >
          {asset.code}
        </span>
        {cls && <Badge bg={cls.bg} color={cls.color}>{asset.classification}</Badge>}
        {substrate && (
          <Badge bg={DARK.panel2} color={DARK.muted} title={`Runs on ${asset.provider}`}>
            {asset.provider}
          </Badge>
        )}
      </div>
    </div>
  );
}

export type ActorNodeData = {
  actor: { id: string; name: string; description: string; kind: string };
  direction: "in" | "out" | "internal";
};

export function CanvasActorNode({ data }: NodeProps) {
  const { actor } = data as ActorNodeData;
  const isHuman = actor.kind === ACTOR_KINDS.HUMAN;
  const Icon = isHuman ? User : Cpu;
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col justify-center px-2.5 py-2"
      style={{ width: NODE_W, height: ACTOR_H, background: DARK.panel, border: `1px solid ${DARK.border}` }}
      title={`${actor.name}\n${actor.description}`}
    >
      <Handles />
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 leading-none"
          style={{ background: isHuman ? DARK.accent : naFill(), color: "#fff" }}
        >
          {isHuman ? "HUMAN" : "MACHINE"}
        </span>
        <Icon size={13} color={DARK.muted} className="shrink-0" aria-hidden />
      </div>
      <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: DARK.ink }}>
        {actor.name}
      </div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: DARK.muted }}>
        {actor.description}
      </div>
    </div>
  );
}

export type VendorNodeData = {
  entry: {
    vendorId: string;
    dependency: string;
    criticality: string;
    vendor?: { name: string; category: string };
    assurance?: {
      reassessedAt: string;
      cadence: { overdue: boolean };
      certification?: { id: string } | null;
    } | null;
  };
};

// Dashed border, matching the prototype's third-party treatment: a vendor is
// inside the picture but outside the boundary, and the border says so without
// needing a zone drawn around it.
export function CanvasVendorNode({ data }: NodeProps) {
  const { entry } = data as VendorNodeData;
  const { assurance } = entry;

  const assuranceBadge = !assurance
    ? { bg: DARK.redBg, color: DARK.red, text: "No assurance record" }
    : assurance.cadence.overdue
      ? { bg: DARK.amberBg, color: DARK.amber, text: `Overdue · ${assurance.reassessedAt}` }
      : { bg: DARK.greenBg, color: DARK.green, text: assurance.certification?.id ?? `Reassessed ${assurance.reassessedAt}` };

  const critical = entry.criticality === "critical" || entry.criticality === "high";

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col justify-center px-2.5 py-2"
      style={{ width: NODE_W, height: VENDOR_H, background: DARK.panel, border: `1px dashed ${DARK.border}` }}
      title={`${entry.vendor?.name ?? entry.vendorId}\n${entry.dependency}`}
    >
      <Handles />
      <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: DARK.ink }}>
        {entry.vendor?.name ?? entry.vendorId}
      </div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: DARK.muted }}>
        {entry.vendor?.category ?? "vendor"}
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        <Badge bg={critical ? DARK.amberBg : DARK.panel2} color={critical ? DARK.amber : DARK.muted}>
          {entry.criticality}
        </Badge>
        <Badge bg={assuranceBadge.bg} color={assuranceBadge.color}>{assuranceBadge.text}</Badge>
      </div>
    </div>
  );
}
