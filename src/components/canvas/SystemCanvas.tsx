// The system canvas: the architecture view's default rendering.
//
// React Flow supplies pan, zoom, fit-to-view and the zoom controls; everything
// about WHAT is drawn comes from canvasLayout.ts, which reads the same
// flowLayoutForSystem derivation the Diagram view uses. Nothing here is
// system-specific — a boundary with no request path draws its bands and
// nothing else.
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background, Controls, Panel, ReactFlow, ReactFlowProvider,
  useNodesInitialized, useNodesState, useOnViewportChange, useReactFlow, useStore,
} from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DARK } from "../../theme";
import type { AssetId } from "../../graph/ids";
import type { FlowLayout } from "../../utils/flowDiagramLayout";
import { buildCanvasGraph } from "./canvasLayout";
import type { CanvasVendor, EdgeKindFilter } from "./canvasLayout";
import { CanvasActorNode, CanvasAssetNode, CanvasLaneNode, CanvasVendorNode } from "./CanvasNodes";

// Module-level. Rebuilding this object each render remounts every node, logs
// React Flow warning #002, and would defeat the theme handling below.
const nodeTypes = {
  asset: CanvasAssetNode,
  actor: CanvasActorNode,
  vendor: CanvasVendorNode,
  lane: CanvasLaneNode,
};

export interface CanvasFocus { cx: number; cy: number; zoom: number }

export interface SystemCanvasProps {
  layout: FlowLayout;
  systemProvider: string;
  vendors: readonly CanvasVendor[];
  edgeKinds: EdgeKindFilter;
  selectedKey: AssetId | null;
  onSelectNode: (assetId: AssetId | null) => void;
  rolesFor: (assetId: AssetId) => string[] | null;
  mode: "embedded" | "expanded";
  initialFocus?: CanvasFocus | null;
  onFocusChange?: (focus: CanvasFocus) => void;
  onCounts?: (counts: Record<keyof EdgeKindFilter, number>, visible: number) => void;
}

// Carries the viewport across the embedded <-> expanded remount. React treats a
// change of portal container as a remount, so the React Flow instance cannot
// survive the transition and the viewport has to be handed over explicitly.
//
// It hands over the flow-space CENTRE plus zoom, not the raw {x,y,zoom}: the
// two panes are different sizes, and copying a translation verbatim leaves the
// content pinned to a corner instead of where the reader was looking.
function ViewportBridge({
  initialFocus,
  onFocusChange,
}: {
  initialFocus?: CanvasFocus | null;
  onFocusChange?: (focus: CanvasFocus) => void;
}) {
  const initialized = useNodesInitialized();
  const { setCenter, fitView } = useReactFlow();
  const restored = useRef(false);
  // The pane's own size, from this instance's store. Deliberately not a DOM
  // query: while the view is expanded BOTH canvases are mounted (the embedded
  // one still sits behind the scrim), so a document-wide lookup would hand the
  // expanded canvas the embedded pane's dimensions and offset the centre it
  // reports by the difference between them.
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);

  useEffect(() => {
    if (!initialized || restored.current) return;
    restored.current = true;
    if (initialFocus) setCenter(initialFocus.cx, initialFocus.cy, { zoom: initialFocus.zoom, duration: 0 });
    else void fitView({ padding: 0.12 });
  }, [initialized, initialFocus, setCenter, fitView]);

  useOnViewportChange({
    onEnd: (viewport) => {
      if (!onFocusChange || !paneWidth || !paneHeight) return;
      onFocusChange({
        cx: (-viewport.x + paneWidth / 2) / viewport.zoom,
        cy: (-viewport.y + paneHeight / 2) / viewport.zoom,
        zoom: viewport.zoom,
      });
    },
  });

  return null;
}

function Inner({
  layout, systemProvider, vendors, edgeKinds, selectedKey, onSelectNode, rolesFor,
  mode, initialFocus, onFocusChange, onCounts,
}: SystemCanvasProps) {
  // Every colour below comes from DARK, not from the mutable C. The canvas is
  // a dark surface in both app themes — it reads as its own thing, the way the
  // prototype did, and a diagram is easier to follow against one constant
  // ground than one that flips underneath it. The page around it (toolbar,
  // chips, footer, detail rail) still follows the app theme.
  //
  // A pleasant side effect: because these colours never change, nothing has to
  // force React Flow to re-render its memoised nodes when applyTheme runs.
  const { nodes, edges, counts, visibleEdgeCount } = useMemo(
    () =>
      buildCanvasGraph({
        layout,
        systemProvider,
        vendors,
        edgeKinds,
        selectedKey,
        tokens: { accent: DARK.accent, muted: DARK.muted, green: DARK.green, amber: DARK.amber, red: DARK.red, na: DARK.na },
      }),
    [layout, systemProvider, vendors, edgeKinds, selectedKey]
  );

  // The data-type filter turns a card's type line into the roles it plays for
  // that data type. Applied here rather than in the layout so the pure module
  // stays free of presentational concerns.
  const withRoles = useMemo(
    () =>
      nodes.map((n) =>
        n.type === "asset"
          ? { ...n, data: { ...n.data, roles: rolesFor((n.id as AssetId)) } }
          : n
      ),
    [nodes, rolesFor]
  );

  // Nodes are DERIVED, but React Flow still has to own them.
  //
  // canvasLayout supplies each node's size and handles up front, so the graph
  // draws correctly on the first frame without waiting to be measured. React
  // Flow still measures afterwards and reports the result as a `dimensions`
  // change through onNodesChange — applied here so a card that ever renders at
  // a size other than the one it was given corrects itself rather than drawing
  // its edges to the wrong place. Each rebuild carries the previous `measured`
  // across instead of resetting it, which would restart that cycle on every
  // selection.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>(withRoles);
  useEffect(() => {
    setRfNodes((prev) => {
      const measured = new Map(prev.map((n) => [n.id, n.measured]));
      return withRoles.map((n) => {
        const m = measured.get(n.id);
        return m ? { ...n, measured: m } : n;
      });
    });
  }, [withRoles, setRfNodes]);

  useEffect(() => { onCounts?.(counts, visibleEdgeCount); }, [counts, visibleEdgeCount, onCounts]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "asset") return;
      onSelectNode(node.id === selectedKey ? null : (node.id as AssetId));
    },
    [onSelectNode, selectedKey]
  );

  // A node click bubbles up to the pane, so an unguarded handler would clear
  // the selection the click just made.
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).classList.contains("react-flow__pane")) onSelectNode(null);
    },
    [onSelectNode]
  );

  const expanded = mode === "expanded";

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      minZoom={0.15}
      maxZoom={1.75}
      // Embedded, the canvas must not swallow the wheel: the tab it sits in
      // scrolls, and a page that stops scrolling whenever the cursor crosses a
      // panel reads as broken. Zoom is on the controls, on pinch, and in the
      // expanded view, where there is nothing behind to scroll.
      zoomOnScroll={expanded}
      preventScrolling={expanded}
      proOptions={{ hideAttribution: false }}
    >
      <ViewportBridge initialFocus={initialFocus} onFocusChange={onFocusChange} />
      <Background color={DARK.border} gap={20} />
      <Controls showInteractive={false} position="bottom-right" />
      {/* Top-right, not bottom-left: the legend is anchored to the viewport
          while the band titles live in canvas space, and at fit-to-view the
          bottom-left corner is exactly where the last band's title lands. The
          zoom controls hold the bottom-right, and the diagram's tall bands run
          down the left, so this is the corner least likely to cover anything. */}
      <Panel position="top-right">
        <CanvasLegend edgeKinds={edgeKinds} />
      </Panel>
    </ReactFlow>
  );
}

const LEGEND: { key: keyof EdgeKindFilter; label: string; color: () => string; dash?: string }[] = [
  { key: "data", label: "Data", color: () => DARK.accent },
  { key: "actors", label: "Actor access", color: () => DARK.green },
  { key: "controlPlane", label: "Control plane", color: () => DARK.na, dash: "5 4" },
  { key: "deploy", label: "Deploys to", color: () => DARK.accent, dash: "6 3" },
  { key: "backupRestore", label: "Backup / restore", color: () => DARK.green, dash: "4 3" },
  { key: "vendors", label: "Vendor dependency", color: () => DARK.muted, dash: "1 4" },
];

function CanvasLegend({ edgeKinds }: { edgeKinds: EdgeKindFilter }) {
  const shown = LEGEND.filter((l) => edgeKinds[l.key]);
  if (!shown.length) return null;
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 flex flex-col gap-1 pointer-events-none"
      style={{ background: `color-mix(in srgb, ${DARK.panel} 88%, transparent)`, border: `1px solid ${DARK.border}` }}
    >
      {shown.map((l) => (
        <div key={l.key} className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" stroke={l.color()} strokeWidth="1.5" strokeDasharray={l.dash} />
          </svg>
          <span className="text-[9px]" style={{ color: DARK.muted }}>{l.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function SystemCanvas(props: SystemCanvasProps) {
  const height = props.mode === "expanded" ? "100%" : "clamp(440px, 62vh, 780px)";
  const empty = props.layout.stages.length === 0
    && props.layout.dataPlane.length === 0
    && props.layout.branches.length === 0;

  if (empty) {
    return (
      <div
        className="rounded-2xl p-10 text-center text-sm"
        style={{ background: DARK.panel2, border: `1px dashed ${DARK.border}`, color: DARK.muted }}
      >
        No asset in this boundary carries the selected data type.
      </div>
    );
  }

  return (
    <div
      className="rf-canvas rounded-2xl relative"
      style={
        {
          height,
          minHeight: 0,
          background: DARK.panel2,
          border: `1px solid ${DARK.border}`,
          overflow: "hidden",
          // Read by the React Flow overrides in index.css, so the library's own
          // light-theme stylesheet (zoom controls, attribution) is repainted to
          // match this surface rather than the page around it.
          "--rf-panel": DARK.panel,
          "--rf-panel2": DARK.panel2,
          "--rf-ink": DARK.ink,
          "--rf-border": DARK.border,
          "--rf-muted": DARK.muted,
        } as React.CSSProperties
      }
    >
      <ReactFlowProvider>
        <Inner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
