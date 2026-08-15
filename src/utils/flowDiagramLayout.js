// Pure layout math for the "true" data flow diagrams: turns the same
// ingress -> stages -> egress -> actors layout the card view
// (pages/DataMap.jsx) already derives from the graph into pixel positions and
// drawable edges, instead of the stage-bucket rows the card view uses. No new
// facts are introduced here — every node and edge below traces back to a real
// DATA_FLOWS or ACTOR_ACCESS record; this module only decides where to draw
// them.
//
// Split into two diagrams along a boundary the graph already draws:
// DATA_FLOWS' own `kind` field (`data` vs `control-plane`). A single combined
// picture put the two on top of each other — in the AI Platform system,
// control-plane edges (26) outnumber data edges (17) because a handful of
// protectors (Telemetry, IAM) each fan out to most of the request path, and
// that fan-out was most of what made the combined diagram hard to read.
//
//   buildDataFlowDiagram    — ingress actors -> stages -> data plane ->
//                              egress -> egress actors. The request-path story.
//   buildControlPlaneMatrix — protectors (rows, grouped by what kind of
//                              protection they provide — encryption/secrets,
//                              identity, observability, derived from asset
//                              `kind`) against everything they protect
//                              (columns). Deliberately NOT a node-link
//                              diagram: this relationship is dense many-to-many
//                              (in the AI Platform system, IAM and Runtime
//                              Security protect the exact same 5 assets, and
//                              Telemetry protects that set plus 3 more), which
//                              no layout can draw crossing-free — a matrix has
//                              no lines to cross by construction, and it makes
//                              that overlap (two rows sharing an identical
//                              set of columns) directly visible instead of
//                              hiding it in a tangle of lines.

const NODE_W = 176;
const NODE_H = 60;
const ACTOR_W = 158;
const ACTOR_H = 52;
const COL_GAP = 72;
const ROW_GAP = 16;
const BAND_GAP = 64;
const MARGIN = 28;

function columnOf(items, kind) {
  return { kind, items };
}

// Anchor two boxes on whichever pair of sides best matches how far apart
// they are — horizontal sides for a mostly-sideways hop (the common case,
// stage to stage), vertical sides for a mostly-up/down hop.
function anchor(a, b) {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const dx = bcx - acx, dy = bcy - acy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return [
      { x: dx >= 0 ? a.x + a.w : a.x, y: acy },
      { x: dx >= 0 ? b.x : b.x + b.w, y: bcy },
    ];
  }
  return [
    { x: acx, y: dy >= 0 ? a.y + a.h : a.y },
    { x: bcx, y: dy >= 0 ? b.y : b.y + b.h },
  ];
}

function perp(p1, p2, offset) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * offset, y: (dx / len) * offset };
}

function curve(p1, p2, offset) {
  const o = perp(p1, p2, offset);
  const c1 = { x: p1.x + (p2.x - p1.x) * 0.33 + o.x, y: p1.y + (p2.y - p1.y) * 0.33 + o.y };
  const c2 = { x: p1.x + (p2.x - p1.x) * 0.67 + o.x, y: p1.y + (p2.y - p1.y) * 0.67 + o.y };
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

// Parallel edges between the same two nodes (a real shape here: the RAG
// runtime calls the gateway back with its completion on the same pair it
// received the prompt from) get fanned apart instead of drawn on top of
// each other.
function fanOutEdges(rawEdges, positions) {
  const groups = {};
  rawEdges.forEach((e) => {
    const key = [e.from, e.to].sort().join("::");
    (groups[key] ||= []).push(e);
  });
  return rawEdges.map((e) => {
    const key = [e.from, e.to].sort().join("::");
    const group = groups[key];
    const idx = group.indexOf(e);
    const offset = group.length > 1 ? (idx - (group.length - 1) / 2) * 16 : 0;
    const [p1, p2] = anchor(positions[e.from], positions[e.to]);
    return { ...e, path: curve(p1, p2, offset), start: p1, end: p2 };
  });
}

export function buildDataFlowDiagram(layout) {
  const columns = [];
  if (layout.ingressActors?.length) {
    columns.push(columnOf(layout.ingressActors.map((a) => ({ id: a.actor.id, ref: a.actor, w: ACTOR_W, h: ACTOR_H })), "actor"));
  }
  (layout.stages || []).forEach((s) => {
    columns.push(columnOf(s.nodes.map((a) => ({ id: a.id, ref: a, w: NODE_W, h: NODE_H })), "asset"));
  });
  if (layout.egress?.length) {
    columns.push(columnOf(layout.egress.map((e) => ({ id: e.asset.id, ref: e.asset, w: NODE_W, h: NODE_H })), "asset"));
  }
  if (layout.egressActors?.length) {
    columns.push(columnOf(layout.egressActors.map((a) => ({ id: a.actor.id, ref: a.actor, w: ACTOR_W, h: ACTOR_H })), "actor"));
  }

  const positions = {};

  const colHeights = columns.map((col) => col.items.reduce((sum, it) => sum + it.h, 0) + Math.max(0, col.items.length - 1) * ROW_GAP);
  const mainHeight = Math.max(0, ...colHeights, NODE_H);
  const mainCenterY = MARGIN + mainHeight / 2;

  let x = MARGIN;
  columns.forEach((col) => {
    const colW = Math.max(...col.items.map((it) => it.w));
    const colHeight = col.items.reduce((sum, it) => sum + it.h, 0) + Math.max(0, col.items.length - 1) * ROW_GAP;
    let y = mainCenterY - colHeight / 2;
    col.items.forEach((it) => {
      positions[it.id] = { x, y, w: colW, h: it.h, kind: col.kind, ref: it.ref };
      y += it.h + ROW_GAP;
    });
    x += colW + COL_GAP;
  });
  const mainRight = columns.length ? x - COL_GAP : MARGIN;

  let bandY = MARGIN + mainHeight;
  let bandBottom = MARGIN + mainHeight;

  function layBand(items, getId, getRef) {
    if (!items || items.length === 0) return;
    bandY = bandBottom + BAND_GAP;
    const totalW = items.length * NODE_W + Math.max(0, items.length - 1) * ROW_GAP;
    let bx = Math.max(MARGIN, MARGIN + (mainRight - MARGIN - totalW) / 2);
    items.forEach((it) => {
      positions[getId(it)] = { x: bx, y: bandY, w: NODE_W, h: NODE_H, kind: "asset", ref: getRef(it) };
      bx += NODE_W + ROW_GAP;
    });
    bandBottom = bandY + NODE_H;
  }

  layBand(layout.dataPlane, (d) => d.asset.id, (d) => d.asset);

  const width = Math.max(mainRight, MARGIN) + MARGIN;
  const height = bandBottom + MARGIN;

  const rawEdges = [];
  (layout.edges || []).forEach((f) => {
    if (positions[f.from] && positions[f.to]) rawEdges.push({ id: f.id, from: f.from, to: f.to, kind: "data", dataTypeIds: f.dataTypeIds, note: f.note });
  });
  (layout.ingressActors || []).forEach((a) => {
    if (positions[a.actor.id] && positions[a.assetId]) {
      rawEdges.push({ id: `${a.actor.id}->${a.assetId}`, from: a.actor.id, to: a.assetId, kind: "actor-in", dataTypeIds: [], note: a.note });
    }
  });
  (layout.egressActors || []).forEach((a) => {
    if (positions[a.actor.id] && positions[a.assetId]) {
      rawEdges.push({ id: `${a.assetId}->${a.actor.id}`, from: a.assetId, to: a.actor.id, kind: "actor-out", dataTypeIds: [], note: a.note });
    }
  });

  const edges = fanOutEdges(rawEdges, positions);
  const nodes = Object.entries(positions).map(([id, pos]) => ({ id, ...pos }));

  return { width, height, nodes, edges };
}

// Derived from asset `kind` (a real, already-modelled fact — see
// graph/nodes/assets.ts), not a hand-maintained parallel list: any
// control-plane asset kind not named here still renders, just under a
// catch-all group, so a new kind can't silently vanish from the diagram.
const CONTROL_CATEGORY_BY_KIND = {
  "key-management": "Encryption & Secrets",
  "secrets-store": "Encryption & Secrets",
  iam: "Identity & Workload",
  "service-account": "Identity & Workload",
  telemetry: "Observability & Detection",
  siem: "Observability & Detection",
  "runtime-security": "Observability & Detection",
};
const CONTROL_CATEGORY_FALLBACK = "Other Controls";
const CONTROL_CATEGORY_ORDER = ["Encryption & Secrets", "Identity & Workload", "Observability & Detection", CONTROL_CATEGORY_FALLBACK];

export function controlPlaneCategory(kind) {
  return CONTROL_CATEGORY_BY_KIND[kind] || CONTROL_CATEGORY_FALLBACK;
}

const MATRIX_MARGIN = 24;
const MATRIX_ROW_LABEL_W = 210;
const MATRIX_COL_W = 42;
const MATRIX_ROW_H = 30;
const MATRIX_HEADER_H = 30;
const MATRIX_CATEGORY_ROW_H = 22;

// Returns null when a system has no control-plane-only assets, so the caller
// can skip the page entirely rather than render an empty one.
export function buildControlPlaneMatrix(layout, getAssetById) {
  const branches = layout.branches || [];
  if (branches.length === 0) return null;

  // Rows: protectors, grouped by category — same grouping the earlier
  // node-link version used, still meaningful here since it clusters rows
  // that tend to have similar column patterns next to each other.
  const groups = {};
  branches.forEach((b) => {
    (groups[controlPlaneCategory(b.asset.kind)] ||= []).push(b.asset);
  });
  const rows = [];
  const categoryBreaks = [];
  CONTROL_CATEGORY_ORDER.filter((cat) => groups[cat]?.length).forEach((cat) => {
    categoryBreaks.push({ label: cat, rowIndex: rows.length });
    groups[cat].forEach((asset) => rows.push({ id: asset.id, ref: asset }));
  });
  const rowIds = new Set(rows.map((r) => r.id));

  // Columns: every real asset a control-plane edge protects, ordered to
  // match the request-path reading order from the data-flow diagram (stages
  // -> egress -> data plane) so the two pages line up. Anything outside that
  // path — a protector protecting another protector, e.g. Telemetry feeding
  // SIEM — is appended at the end rather than dropped.
  const naturalOrder = [];
  (layout.stages || []).forEach((s) => s.nodes.forEach((n) => naturalOrder.push(n.id)));
  (layout.egress || []).forEach((e) => naturalOrder.push(e.asset.id));
  (layout.dataPlane || []).forEach((d) => naturalOrder.push(d.asset.id));

  const targetIds = new Set();
  (layout.controlPlaneEdges || []).forEach((f) => {
    if (rowIds.has(f.from)) targetIds.add(f.to);
  });

  const cols = [];
  const seenCol = new Set();
  naturalOrder.forEach((id) => {
    if (targetIds.has(id) && !seenCol.has(id)) {
      const ref = getAssetById(id);
      if (ref) { cols.push({ id, ref }); seenCol.add(id); }
    }
  });
  Array.from(targetIds).filter((id) => !seenCol.has(id)).sort().forEach((id) => {
    const ref = getAssetById(id);
    if (ref) { cols.push({ id, ref }); seenCol.add(id); }
  });

  const cellByKey = {};
  (layout.controlPlaneEdges || []).forEach((f) => {
    if (rowIds.has(f.from) && seenCol.has(f.to)) cellByKey[`${f.from}::${f.to}`] = f;
  });

  const width = MATRIX_MARGIN * 2 + MATRIX_ROW_LABEL_W + cols.length * MATRIX_COL_W;
  const height = MATRIX_MARGIN * 2 + MATRIX_HEADER_H + rows.length * MATRIX_ROW_H + categoryBreaks.length * MATRIX_CATEGORY_ROW_H;

  return {
    width, height, rows, cols, categoryBreaks, cellByKey,
    margin: MATRIX_MARGIN, rowLabelW: MATRIX_ROW_LABEL_W, colW: MATRIX_COL_W,
    rowH: MATRIX_ROW_H, headerH: MATRIX_HEADER_H, categoryRowH: MATRIX_CATEGORY_ROW_H,
  };
}
