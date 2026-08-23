// Turns the engine's flow layout into React Flow nodes and edges.
//
// Pure: no React, no imports from theme.ts. Colours arrive as arguments rather
// than being read here, which keeps this testable without a DOM and leaves the
// palette decision to the caller (SystemCanvas pins it to DARK).
//
// LAYOUT IS SPATIAL ONLY. There are no zone rectangles and no band labels —
// where a node sits is the entire statement. The request path runs left to
// right across the top with its actors on either end; everything that is not
// the request path (data plane, control plane, delivery, recovery, vendors)
// sits in rows beneath it, in that order. That ordering is the meaning, and it
// comes straight from the engine's own sections rather than being re-derived
// here.
import { MarkerType, Position } from "@xyflow/react";
import type { Edge, Node, NodeHandle } from "@xyflow/react";
import type { AssetId } from "../../graph/ids";
import type { FlowLayout } from "../../utils/flowDiagramLayout";
import type { AssetRollup } from "../../engine";
import type { VendorsApi } from "../../engine/vendors";

type ActorEntry = FlowLayout["ingressActors"][number];
// Structural, off the engine, the same way FlowLayout is — so a change to what
// vendorsForSystem returns is a type error here rather than a silent drift.
export type CanvasVendor = ReturnType<VendorsApi["vendorsForSystem"]>["vendors"][number];

export const NODE_W = 224;
export const ASSET_H = 80;
export const ACTOR_H = 72;
export const VENDOR_H = 80;

const COLUMN_PITCH = NODE_W + 56; // 280
const ROW_PITCH = ASSET_H + 44; // 124
const BAND_GAP = 72;

export interface EdgeKindFilter {
  data: boolean;
  actors: boolean;
  vendors: boolean;
  controlPlane: boolean;
  deploy: boolean;
  backupRestore: boolean;
}

export const DEFAULT_EDGE_KINDS: EdgeKindFilter = {
  data: true,
  actors: true,
  vendors: true,
  // Off by default. Control plane is 50 relationships on the AI platform with
  // a handful of protectors each fanning out across most of the boundary —
  // the same density that made the Diagram view render it as a matrix rather
  // than a diagram. Switching it on enables focus mode below.
  controlPlane: false,
  deploy: false,
  backupRestore: false,
};

export type CanvasEdgeKind =
  | "data" | "control-plane" | "deploys-to" | "backup" | "restore"
  | "actor-in" | "actor-out" | "actor-internal" | "depends-on";

export interface CanvasTokens {
  accent: string; muted: string; green: string; amber: string; red: string; na: string;
}

export interface CanvasInput {
  layout: FlowLayout;
  systemProvider: string;
  vendors: readonly CanvasVendor[];
  edgeKinds: EdgeKindFilter;
  selectedKey: AssetId | null;
  tokens: CanvasTokens;
}

export interface CanvasResult {
  nodes: Node[];
  edges: Edge[];
  counts: Record<keyof EdgeKindFilter, number>;
  substrateVendorId: string | null;
  visibleEdgeCount: number;
}

interface Placed { id: string; x: number; y: number; w: number; h: number }

// Every card is a known, fixed size, so its four connection points are known
// too — one source and one target at the midpoint of each side.
//
// Declaring them (rather than letting React Flow read them back out of the DOM)
// is what lets the graph draw correctly on its FIRST frame: React Flow derives
// handle bounds from `node.handles` when it is present, and adopts
// `node.measured` as given, so neither edges nor fitView have to wait for a
// measurement round-trip. It also makes the canvas immune to environments
// where that round-trip never happens — a background tab, a hidden panel, or
// printing all suspend the ResizeObserver that would otherwise supply this.
// The observer still runs and still corrects these values if a card ever
// renders at a size other than the one it was given.
function handlesFor(w: number, h: number): NodeHandle[] {
  const points = [
    { position: Position.Left, key: "l", x: 0, y: h / 2 },
    { position: Position.Right, key: "r", x: w, y: h / 2 },
    { position: Position.Top, key: "t", x: w / 2, y: 0 },
    { position: Position.Bottom, key: "b", x: w / 2, y: h },
  ] as const;
  return points.flatMap(({ position, key, x, y }) => [
    { id: `${key}-s`, type: "source" as const, position, x, y, width: 1, height: 1 },
    { id: `${key}-t`, type: "target" as const, position, x, y, width: 1, height: 1 },
  ]);
}

function edgeStyle(kind: CanvasEdgeKind, t: CanvasTokens): { stroke: string; dash?: string } {
  switch (kind) {
    case "data": return { stroke: t.accent };
    case "control-plane": return { stroke: t.na, dash: "5 4" };
    case "deploys-to": return { stroke: t.accent, dash: "6 3" };
    case "backup": return { stroke: t.green, dash: "4 3" };
    case "restore": return { stroke: t.amber, dash: "4 3" };
    case "actor-in": return { stroke: t.green };
    case "actor-out": return { stroke: t.amber };
    case "actor-internal": return { stroke: t.red, dash: "1 3" };
    case "depends-on": return { stroke: t.muted, dash: "1 4" };
  }
}

// Which side of each box the line leaves and enters. Picking from the known
// geometry rather than letting React Flow guess is what keeps a reciprocal
// pair (the gateway calls the orchestrator, the orchestrator answers back)
// from drawing one line on top of the other: opposite dx, opposite sides.
function sidesFor(a: Placed, b: Placed): { sourceHandle: string; targetHandle: string } {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0
      ? { sourceHandle: "r-s", targetHandle: "l-t" }
      : { sourceHandle: "l-s", targetHandle: "r-t" };
  }
  return dy > 0
    ? { sourceHandle: "b-s", targetHandle: "t-t" }
    : { sourceHandle: "t-s", targetHandle: "b-t" };
}

export function buildCanvasGraph(input: CanvasInput): CanvasResult {
  const { layout, systemProvider, vendors, edgeKinds, selectedKey, tokens } = input;

  const nodes: Node[] = [];
  const placed = new Map<string, Placed>();
  // assetId -> its stored `provider`, so vendor edges can be drawn from a fact
  // rather than by searching the node array for one.
  const assetProviders = new Map<string, string>();

  const push = (
    id: string,
    type: string,
    x: number,
    y: number,
    h: number,
    data: Record<string, unknown>
  ) => {
    nodes.push({
      id, type,
      position: { x, y },
      // Geometry supplied rather than measured — see handlesFor above for why.
      // Deliberately NOT `width`/`height`: those mean "the caller owns this
      // size", which makes React Flow skip its measurement pass entirely and
      // leaves `measured` empty forever.
      initialWidth: NODE_W,
      initialHeight: h,
      measured: { width: NODE_W, height: h },
      handles: handlesFor(NODE_W, h),
      data,
      selectable: true,
      draggable: false,
    });
    // Our own geometry, kept independent of whatever React Flow measures: it
    // is only used to decide which side of a box each line leaves from.
    placed.set(id, { id, x, y, w: NODE_W, h });
  };

  // ---- Row 0: the request path, actors at either end ---------------------------
  // Actors are deduped: one actor can reach several assets, and drawing it once
  // per access record would stack four identical cards on top of each other.
  const dedupeActors = (entries: readonly ActorEntry[]) => {
    const seen = new Map<string, ActorEntry>();
    entries.forEach((e) => { if (!seen.has(e.actor.id)) seen.set(e.actor.id, e); });
    return [...seen.values()];
  };

  const ingressActors = dedupeActors(layout.ingressActors);
  const egressActors = dedupeActors(layout.egressActors);
  const internalActors = dedupeActors(layout.internalActors);

  type ActorDirection = "in" | "out" | "internal";
  type Item =
    | { kind: "asset"; asset: AssetRollup }
    | { kind: "actor"; entry: ActorEntry; direction: ActorDirection }
    | { kind: "vendor"; entry: CanvasVendor };

  const assetItems = (entries: readonly { asset: AssetRollup }[]): Item[] =>
    entries.map((e) => ({ kind: "asset", asset: e.asset }));
  const actorItems = (entries: ActorEntry[], direction: ActorDirection): Item[] =>
    entries.map((entry) => ({ kind: "actor", entry, direction }));

  const columns: Item[][] = [];
  if (ingressActors.length) columns.push(actorItems(ingressActors, "in"));
  layout.stages.forEach((stage) => {
    columns.push(stage.nodes.map((asset: AssetRollup) => ({ kind: "asset", asset })));
  });
  if (layout.egress.length) columns.push(assetItems(layout.egress));
  if (egressActors.length) columns.push(actorItems(egressActors, "out"));

  const placeItem = (item: Item, x: number, y: number) => {
    if (item.kind === "asset") {
      push(item.asset.id, "asset", x, y, ASSET_H, {
        asset: item.asset,
        substrate: item.asset.provider === systemProvider,
        selected: item.asset.id === selectedKey,
      });
      assetProviders.set(item.asset.id, item.asset.provider);
    } else if (item.kind === "actor") {
      push(`actor-${item.entry.actor.id}`, "actor", x, y, ACTOR_H, {
        actor: item.entry.actor,
        direction: item.direction,
      });
    } else {
      push(`vendor-${item.entry.vendorId}`, "vendor", x, y, VENDOR_H, { entry: item.entry });
    }
  };

  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const rowTop = 0;

  columns.forEach((col, ci) => {
    const x = ci * COLUMN_PITCH;
    const yOff = ((tallest - col.length) * ROW_PITCH) / 2;
    col.forEach((item, i) => placeItem(item, x, rowTop + yOff + i * ROW_PITCH));
  });

  const columnCount = Math.max(1, columns.length);
  let bandTop = rowTop + tallest * ROW_PITCH + BAND_GAP;

  // ---- Bands beneath, in the engine's own order --------------------------------
  // A band with nothing in it contributes no height and no gap, so a system
  // with no AI pipeline (or no delivery tooling) collapses cleanly instead of
  // leaving a void where a label would have been.
  const band = (items: Item[]) => {
    if (!items.length) return;
    items.forEach((item, i) => {
      const x = (i % columnCount) * COLUMN_PITCH;
      const y = bandTop + Math.floor(i / columnCount) * ROW_PITCH;
      placeItem(item, x, y);
    });
    bandTop += Math.ceil(items.length / columnCount) * ROW_PITCH + BAND_GAP;
  };

  // Workforce access sits first: it is still people reaching in, just not
  // through the customer-facing path.
  band([...actorItems(internalActors, "internal"), ...assetItems(layout.workforceIngress)]);
  band(assetItems(layout.dataPlane));
  band(assetItems(layout.branches));
  band(assetItems(layout.softwareDeployment));
  band(assetItems(layout.backupRecovery));

  // ---- Vendors -----------------------------------------------------------------
  // The substrate provider is not drawn. On the AI platform it would be a
  // single node with ~30 lines converging on it, which buries every flow the
  // canvas exists to show; it is a badge on each asset it runs instead. Found
  // by matching the system's own `provider` string rather than by naming a
  // vendor here, so this holds for a Workday boundary as readily as an AWS one.
  const substrateVendorId = vendors.find((v) => v.vendor?.name === systemProvider)?.vendorId ?? null;
  const drawnVendors = vendors.filter((v) => v.vendorId !== substrateVendorId);
  band(drawnVendors.map((entry) => ({ kind: "vendor", entry })));

  // ---- Edges -------------------------------------------------------------------
  const counts: Record<keyof EdgeKindFilter, number> = {
    data: 0, actors: 0, vendors: 0, controlPlane: 0, deploy: 0, backupRestore: 0,
  };
  const edges: Edge[] = [];
  // Lines actually drawn at full strength — what the "this is denser than it is
  // informative" note counts, since dimmed edges are not what makes a picture
  // unreadable.
  let visibleEdgeCount = 0;

  const add = (
    id: string,
    source: string,
    target: string,
    kind: CanvasEdgeKind,
    label?: string,
    dimmed = false
  ) => {
    const a = placed.get(source);
    const b = placed.get(target);
    if (!a || !b) return;
    const { stroke, dash } = edgeStyle(kind, tokens);
    const { sourceHandle, targetHandle } = sidesFor(a, b);
    if (!dimmed) visibleEdgeCount += 1;
    edges.push({
      id, source, target, sourceHandle, targetHandle,
      type: "smoothstep",
      pathOptions: { borderRadius: 8 },
      style: {
        stroke,
        strokeWidth: 1.5,
        strokeDasharray: dash,
        opacity: dimmed ? 0.12 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
      data: { kind, label },
    } as Edge);
  };

  // Selection dimming: with a node selected, anything not touching it recedes.
  // The single highest-value readability feature here — 60 lines is unreadable
  // until you can ask "which of these are about this box".
  const touches = (a: string, b: string) => !selectedKey || a === selectedKey || b === selectedKey;

  layout.edges.forEach((f) => {
    counts.data += 1;
    if (!edgeKinds.data) return;
    add(f.id, f.from, f.to, "data", f.note, !touches(f.from, f.to));
  });

  // Focus mode. With nothing selected, control-plane lines draw faintly so the
  // shape is visible without competing with the request path; with a node
  // selected, only that node's protection relationships draw at all. That is
  // the difference between "what protects this" and a hairball.
  layout.controlPlaneEdges.forEach((f) => {
    counts.controlPlane += 1;
    if (!edgeKinds.controlPlane) return;
    if (selectedKey && !touches(f.from, f.to)) return;
    add(f.id, f.from, f.to, "control-plane", f.note, !selectedKey);
  });

  layout.softwareDeployment.forEach((entry) => {
    entry.deploysTo.forEach((target: AssetRollup) => {
      counts.deploy += 1;
      if (!edgeKinds.deploy) return;
      add(`dep-${entry.asset.id}-${target.id}`, entry.asset.id, target.id, "deploys-to",
        "deploys to", !touches(entry.asset.id, target.id));
    });
  });

  layout.backupRecovery.forEach((entry) => {
    entry.backedUpFrom.forEach((source: AssetRollup) => {
      counts.backupRestore += 1;
      if (!edgeKinds.backupRestore) return;
      add(`bak-${source.id}-${entry.asset.id}`, source.id, entry.asset.id, "backup",
        "backup", !touches(source.id, entry.asset.id));
    });
    entry.restoresTo.forEach((target: AssetRollup) => {
      counts.backupRestore += 1;
      if (!edgeKinds.backupRestore) return;
      add(`rst-${entry.asset.id}-${target.id}`, entry.asset.id, target.id, "restore",
        "restore", !touches(entry.asset.id, target.id));
    });
  });

  const actorEdges: { entries: readonly ActorEntry[]; kind: CanvasEdgeKind; reverse: boolean }[] = [
    { entries: layout.ingressActors, kind: "actor-in", reverse: false },
    { entries: layout.egressActors, kind: "actor-out", reverse: true },
    { entries: layout.internalActors, kind: "actor-internal", reverse: false },
  ];
  actorEdges.forEach(({ entries, kind, reverse }) => {
    entries.forEach((e) => {
      counts.actors += 1;
      if (!edgeKinds.actors) return;
      const actorNode = `actor-${e.actor.id}`;
      const [from, to] = reverse ? [e.assetId, actorNode] : [actorNode, e.assetId];
      add(`act-${e.actor.id}-${e.assetId}-${kind}`, from, to, kind, e.note, !touches(from, to));
    });
  });

  // A vendor line is drawn only where an asset actually names that vendor as
  // its provider — a stored fact. A vendor nothing names floats in the band
  // with no line, which is the honest picture: it is a dependency of the
  // system, not of any one component.
  drawnVendors.forEach((v) => {
    const vendorName = v.vendor?.name;
    if (!vendorName) return;
    const dependents = [...assetProviders.entries()]
      .filter(([, provider]) => provider === vendorName)
      .map(([assetId]) => assetId);
    dependents.forEach((assetId) => {
      counts.vendors += 1;
      if (!edgeKinds.vendors) return;
      add(`ven-${assetId}-${v.vendorId}`, assetId, `vendor-${v.vendorId}`, "depends-on",
        v.dependency, !touches(assetId, `vendor-${v.vendorId}`));
    });
  });

  return { nodes, edges, counts, substrateVendorId, visibleEdgeCount };
}
