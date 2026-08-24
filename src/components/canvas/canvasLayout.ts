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

// 190, down from 224. Card WIDTH is what caps how large the canvas can be
// drawn: seven columns is the widest this boundary gets, and at the old pitch
// that was 1904px against a ~1360px pane, holding fit-to-view under 0.6
// however tall the pane became. The 34px comes off a name line that was
// already truncating either way.
export const NODE_W = 190;
export const ASSET_H = 80;
export const ACTOR_H = 72;
export const VENDOR_H = 80;

const COLUMN_PITCH = NODE_W + 44; // 234
const ROW_PITCH = ASSET_H + 28; // 108 — 28px of air between stacked cards
// Extra separation between bands, ON TOP of ROW_PITCH. Kept small: at 72 the
// bands sat well clear of the request path's own rhythm, which read as
// detached strips rather than one diagram. 24 leaves bands looser than a
// column (52px of air versus 28px) so they still group, without the gulf.
const BAND_GAP = 24;
// Lane header band above the request path. LANE_H has to clear the title's
// type size plus its rule, or the header crops.
const LANE_H = 32;
const LANE_GAP = 14;
// A band's own header strip. Same height as a lane header so the two read as
// one family of chrome, but full grid width and interactive: the strip IS the
// control that folds and unfolds its band.
const BAND_H = LANE_H;
// Air between a band's header and its first row of cards.
const BAND_TITLE_GAP = 12;

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

// The bands drawn beneath the request path, in the order the engine sections
// them. Declared once, here, so the ids the collapse state is keyed on are the
// same ones the layout draws, rather than a slug derived from a title in two
// places that can drift apart.
export const CANVAS_BANDS = [
  { id: "band-workforce-access", title: "Workforce Access" },
  { id: "band-data-plane", title: "Data Plane" },
  { id: "band-control-plane", title: "Control Plane" },
  { id: "band-software-deployment", title: "Software Deployment" },
  { id: "band-backup-recovery", title: "Backup & Recovery" },
] as const;

export type CanvasBandId = (typeof CANVAS_BANDS)[number]["id"];

const BAND_TITLE: Record<CanvasBandId, string> = Object.fromEntries(
  CANVAS_BANDS.map((b) => [b.id, b.title])
) as Record<CanvasBandId, string>;

// Collapsed by default. Expanded, the bands roughly double the diagram's
// height on a system the size of the AI platform — and the request path alone
// is already taller than the pane it sits in, which is what put fit-to-view at
// a third of full size and made every label unreadable. Each strip names what
// is behind it and counts it, so nothing is hidden silently.
export const DEFAULT_COLLAPSED_BANDS: ReadonlySet<CanvasBandId> = new Set(
  CANVAS_BANDS.map((b) => b.id)
);

export interface CanvasInput {
  layout: FlowLayout;
  systemProvider: string;
  vendors: readonly CanvasVendor[];
  edgeKinds: EdgeKindFilter;
  collapsedBands: ReadonlySet<CanvasBandId>;
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
  const { layout, systemProvider, vendors, edgeKinds, collapsedBands, selectedKey, tokens } = input;

  const nodes: Node[] = [];
  const placed = new Map<string, Placed>();
  // Assets folded away inside a collapsed band, and the strips that stand in
  // for them. An edge with an endpoint in here cannot be drawn; it is counted
  // against the band instead, so a folded band reports what it is withholding.
  const hiddenAssets = new Map<string, CanvasBandId>();
  const hiddenEdgeCounts = new Map<CanvasBandId, number>();
  const bandStrips = new Map<CanvasBandId, Node>();
  // assetId -> its stored `provider`, so vendor edges can be drawn from a fact
  // rather than by searching the node array for one.
  const assetProviders = new Map<string, string>();

  const push = (
    id: string,
    type: string,
    x: number,
    y: number,
    h: number,
    data: Record<string, unknown>,
    w: number = NODE_W
  ) => {
    nodes.push({
      id, type,
      position: { x, y },
      // Geometry supplied rather than measured — see handlesFor above for why.
      // Deliberately NOT `width`/`height`: those mean "the caller owns this
      // size", which makes React Flow skip its measurement pass entirely and
      // leaves `measured` empty forever.
      initialWidth: w,
      initialHeight: h,
      measured: { width: w, height: h },
      handles: handlesFor(w, h),
      data,
      selectable: true,
      draggable: false,
    });
    // Our own geometry, kept independent of whatever React Flow measures: it
    // is only used to decide which side of a box each line leaves from.
    placed.set(id, { id, x, y, w, h });
  };

  // Lane headers sit above the request path and are pure chrome: not
  // selectable, not connectable, and no entry in `placed` so no edge can ever
  // anchor to one.
  const pushLane = (id: string, x: number, w: number, text: string) => {
    nodes.push({
      id, type: "lane",
      position: { x, y: 0 },
      initialWidth: w,
      initialHeight: LANE_H,
      measured: { width: w, height: LANE_H },
      data: { text, width: w },
      selectable: false,
      draggable: false,
      focusable: false,
    });
  };

  // A band's header strip. Chrome like a lane header, but it is the click
  // target that collapses its band, so it stays focusable and returns the node
  // — the withheld-line count is written back onto it once the edges are
  // known. Still absent from `placed`: no edge ever anchors to a label.
  const pushBand = (
    id: CanvasBandId, w: number, count: number, collapsed: boolean, y: number
  ): Node => {
    const node: Node = {
      id, type: "band",
      position: { x: 0, y },
      initialWidth: w,
      initialHeight: BAND_H,
      measured: { width: w, height: BAND_H },
      data: { bandId: id, title: BAND_TITLE[id], count, collapsed, width: w, hiddenEdges: 0 },
      selectable: false,
      draggable: false,
    };
    nodes.push(node);
    return node;
  };

  // ---- Row 0: the request path, actors at either end ---------------------------
  // Actors are deduped: one actor can reach several assets, and drawing it once
  // per access record would stack four identical cards on top of each other.
  const dedupeActors = (entries: readonly ActorEntry[]) => {
    const seen = new Map<string, ActorEntry>();
    entries.forEach((e) => { if (!seen.has(e.actor.id)) seen.set(e.actor.id, e); });
    return [...seen.values()];
  };

  // Staff reaching in through a workforce path share the column with customers
  // and partners reaching in through the public one: both are someone outside
  // the boundary calling into it, and splitting them cost a whole extra band.
  // Deduped across BOTH lists, or an actor with an inbound and an internal
  // access record would be drawn twice in the same column.
  const ingressActors = dedupeActors([...layout.ingressActors, ...layout.internalActors]);
  const egressActors = dedupeActors(layout.egressActors);

  type ActorDirection = "in" | "out" | "internal";
  type Item =
    | { kind: "asset"; asset: AssetRollup }
    | { kind: "actor"; entry: ActorEntry; direction: ActorDirection }
    | { kind: "vendor"; entry: CanvasVendor };

  const assetItems = (entries: readonly { asset: AssetRollup }[]): Item[] =>
    entries.map((e) => ({ kind: "asset", asset: e.asset }));
  const actorItems = (entries: ActorEntry[], direction: ActorDirection): Item[] =>
    entries.map((entry) => ({ kind: "actor", entry, direction }));

  // Each column is tagged with the role it plays in the request path, so a lane
  // header can span "the processing columns" without re-deriving which those
  // are from position. Depth 0 is the boundary itself (WAF, gateway, the web
  // app); depths above it are where the request is actually worked on.
  type ColumnRole = "ingress-actors" | "boundary" | "processing" | "egress" | "egress-actors";
  const columns: Item[][] = [];
  const columnRoles: ColumnRole[] = [];
  const addColumn = (items: Item[], role: ColumnRole) => {
    columns.push(items);
    columnRoles.push(role);
  };

  // A secure web gateway is a way IN to the boundary, so on the canvas it sits
  // with the rest of the ingress rather than in a lane of its own. That trades
  // a distinction away — the engine still separates customer/partner traffic
  // (BOUNDARY_INGRESS_KINDS) from workforce traffic (WORKFORCE_INGRESS_KINDS),
  // and the Diagram view still draws them apart — for one fewer band to read.
  // A PRESENTATION choice, made here and not in the graph: the kinds keep their
  // meaning, applicability is untouched, and nothing about scoring moves.
  const INGRESS_COLUMN_KINDS = new Set(["secure-web-gateway", "identity-provider"]);
  const workforceIntoIngress = layout.workforceIngress.filter((e) => INGRESS_COLUMN_KINDS.has(e.asset.kind));
  const workforceBandEntries = layout.workforceIngress.filter((e) => !INGRESS_COLUMN_KINDS.has(e.asset.kind));

  if (ingressActors.length) addColumn(actorItems(ingressActors, "in"), "ingress-actors");

  const boundaryStage = layout.stages.find((s) => s.depth === 0);
  // If the walk found no depth-0 stage there is still an ingress column to draw
  // when a gateway was folded in, and it has to come before the processing
  // columns — hence building it up front rather than appending as we go.
  if (!boundaryStage && workforceIntoIngress.length) {
    addColumn(assetItems(workforceIntoIngress), "boundary");
  }
  layout.stages.forEach((stage) => {
    const items: Item[] = stage.nodes.map((asset: AssetRollup) => ({ kind: "asset", asset }));
    if (stage.depth === 0) items.push(...assetItems(workforceIntoIngress));
    addColumn(items, stage.depth === 0 ? "boundary" : "processing");
  });
  if (layout.egress.length) addColumn(assetItems(layout.egress), "egress");

  // ---- Vendors -----------------------------------------------------------------
  // The substrate provider is not drawn. On the AI platform it would be a
  // single node with ~30 lines converging on it, which buries every flow the
  // canvas exists to show; it is a badge on each asset it runs instead. Found
  // by matching the system's own `provider` string rather than by naming a
  // vendor here, so this holds for a Workday boundary as readily as an AWS one.
  const substrateVendorId = vendors.find((v) => v.vendor?.name === systemProvider)?.vendorId ?? null;
  const drawnVendors = vendors.filter((v) => v.vendorId !== substrateVendorId);

  // Vendors share the outbound column with the actors rather than sitting in a
  // band of their own: both answer "what is outside this boundary that it
  // reaches", and putting them together also shortens the dependency edges —
  // the model endpoint's line to its provider becomes a short hop across
  // instead of a long diagonal to the bottom of the diagram.
  const outboundItems: Item[] = [
    ...actorItems(egressActors, "out"),
    ...drawnVendors.map((entry): Item => ({ kind: "vendor", entry })),
  ];
  if (outboundItems.length) addColumn(outboundItems, "egress-actors");

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
  // Room reserved above the request path for lane headers. Nothing else moves:
  // the bands below are positioned relative to rowTop.
  const rowTop = LANE_H + LANE_GAP;

  columns.forEach((col, ci) => {
    const x = ci * COLUMN_PITCH;
    const yOff = ((tallest - col.length) * ROW_PITCH) / 2;
    col.forEach((item, i) => placeItem(item, x, rowTop + yOff + i * ROW_PITCH));
  });

  // ---- Lane headers ------------------------------------------------------------
  // A lane is a contiguous run of columns sharing a role, titled once above the
  // whole run. Derived from columnRoles rather than hardcoded indices, so a
  // boundary with more or fewer processing stages still gets one header of the
  // right width — and a system with none (SYS-042) gets no header at all.
  const laneSpan = (role: ColumnRole): { x: number; w: number } | null => {
    const first = columnRoles.indexOf(role);
    if (first === -1) return null;
    const last = columnRoles.lastIndexOf(role);
    return {
      x: first * COLUMN_PITCH,
      // Full pitch per column, less the trailing gutter, so the header ends
      // flush with the right edge of its last card.
      w: (last - first + 1) * COLUMN_PITCH - (COLUMN_PITCH - NODE_W),
    };
  };

  // Names kept identical to the ones the card view used and the Diagram view
  // still uses, so the same column is called the same thing wherever you meet
  // it. A role with no columns in this boundary contributes no header.
  const LANES: { role: ColumnRole; id: string; title: string }[] = [
    // Plain "Actors", not "Inbound Actors": this column now holds staff
    // arriving through a workforce path as well as customers and partners
    // arriving through the public one, and the engine records those as
    // different directions (internal vs inbound). One of them would be wrong
    // whichever direction the label named, so it names neither.
    //
    // "Outbound Actors" keeps its qualifier because it has not been merged with
    // anything — it is still only what the boundary calls out to.
    { role: "ingress-actors", id: "lane-actors-in", title: "Actors" },
    // Ingress/Egress rather than Web Ingress/Web Egress: workforce paths were
    // folded into the ingress column, so "Web" no longer describes everything
    // sitting under it, and the pair reads better matched.
    { role: "boundary", id: "lane-ingress", title: "Ingress" },
    { role: "processing", id: "lane-processing", title: "Data Processing" },
    { role: "egress", id: "lane-egress", title: "Egress" },
    { role: "egress-actors", id: "lane-actors-out", title: "Outbound Actors" },
  ];
  LANES.forEach(({ role, id, title }) => {
    const span = laneSpan(role);
    if (span) pushLane(id, span.x, span.w, title);
  });

  const columnCount = Math.max(1, columns.length);
  let bandTop = rowTop + tallest * ROW_PITCH + BAND_GAP;

  // The grid's own width — the same span a lane header covering every column
  // would have, so a band strip lines up flush with the request path above it.
  const gridWidth = columnCount * COLUMN_PITCH - (COLUMN_PITCH - NODE_W);

  // ---- Bands beneath, in the engine's own order --------------------------------
  // A band with nothing in it contributes no height, no gap and no strip, so a
  // system with no AI pipeline (or no delivery tooling) collapses cleanly
  // instead of leaving a void where a label would have been.
  //
  // Every band that DOES have content gets a full-width header strip: its
  // title, how many assets are inside, and — collapsed — how many lines are
  // being withheld. The strip is the click target, so a band is opened by
  // clicking the thing that names it.
  //
  // This replaced a pill in the gutter at x = -COLUMN_PITCH. That pill sat
  // outside the content's left edge, so it widened the fit-to-view extent by a
  // whole column for chrome alone, and it scrolled out of sight the moment you
  // panned right — a band lost its name exactly while you were reading it.
  const band = (items: Item[], bandId: CanvasBandId) => {
    if (!items.length) return;
    const collapsed = collapsedBands.has(bandId);
    bandStrips.set(bandId, pushBand(bandId, gridWidth, items.length, collapsed, bandTop));

    if (collapsed) {
      // Registered, not placed. `add` below finds no geometry for these and
      // charges the missing line to the band instead of dropping it silently.
      items.forEach((item) => {
        if (item.kind === "asset") hiddenAssets.set(item.asset.id, bandId);
      });
      bandTop += BAND_H + BAND_GAP;
      return;
    }

    const top = bandTop + BAND_H + BAND_TITLE_GAP;
    items.forEach((item, i) => {
      const x = (i % columnCount) * COLUMN_PITCH;
      const y = top + Math.floor(i / columnCount) * ROW_PITCH;
      placeItem(item, x, y);
    });

    const rows = Math.ceil(items.length / columnCount);
    bandTop += BAND_H + BAND_TITLE_GAP + rows * ROW_PITCH + BAND_GAP;
  };

  // Whatever workforce ingress was NOT folded into the ingress column. With
  // both the gateway and the identity provider folded in this is empty on both
  // demo systems, and an empty band contributes no height and no gap — the row
  // disappears rather than leaving a labelled void.
  //
  // Titles are the engine's own section names, matching what the card view used
  // and what the Diagram view still shows.
  band(assetItems(workforceBandEntries), "band-workforce-access");
  band(assetItems(layout.dataPlane), "band-data-plane");
  band(assetItems(layout.branches), "band-control-plane");
  band(assetItems(layout.softwareDeployment), "band-software-deployment");
  band(assetItems(layout.backupRecovery), "band-backup-recovery");

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
    if (!a || !b) {
      // An endpoint sits inside a collapsed band. Counted once per band the
      // line touches, so the strip can say what folding it cost. Only edges of
      // an ENABLED kind reach here, which is what makes the number mean "lines
      // you would otherwise be seeing".
      const bands = new Set<CanvasBandId>();
      const from = hiddenAssets.get(source);
      const to = hiddenAssets.get(target);
      if (from) bands.add(from);
      if (to) bands.add(to);
      bands.forEach((id) => hiddenEdgeCounts.set(id, (hiddenEdgeCounts.get(id) ?? 0) + 1));
      return;
    }
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

  // Strips are pushed while the bands are laid out, before a single edge
  // exists, so the withheld-line count is written back now that they do.
  hiddenEdgeCounts.forEach((hiddenEdges, id) => {
    const strip = bandStrips.get(id);
    if (strip) strip.data = { ...strip.data, hiddenEdges };
  });

  return { nodes, edges, counts, substrateVendorId, visibleEdgeCount };
}
