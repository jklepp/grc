import React, { forwardRef } from "react";
import { LIGHT } from "../theme";
import type { AssetId } from "../graph/ids";
import type { ControlPlaneMatrix } from "../utils/flowDiagramLayout";

// The control-plane relationship (a handful of protectors, each covering a
// large, overlapping set of assets) is dense many-to-many — see
// utils/flowDiagramLayout.js for why that makes a node-link diagram
// impossible to draw without crossings. A matrix has no lines at all: a dot
// in row R, column C means "R protects C," full stop. Zero crossings by
// construction, and two rows with the same dot pattern (e.g. IAM and Runtime
// Security protecting an identical asset set) are visible at a glance
// instead of buried in a tangle.

interface FlowMatrixProps {
  matrix: ControlPlaneMatrix;
  selectedKey?: string | null;
  onSelectNode?: (id: AssetId) => void;
}

const FlowMatrixSVG = forwardRef<SVGSVGElement, FlowMatrixProps>(function FlowMatrixSVG({ matrix, selectedKey, onSelectNode }, ref) {
  const { rows, cols, categoryBreaks, cellByKey, margin, rowLabelW, colW, rowH, headerH, categoryRowH } = matrix;

  const gridLeft = margin + rowLabelW;
  const gridTop = margin + headerH;
  const gridRight = gridLeft + cols.length * colW;

  const rowY: number[] = [];
  let y = gridTop;
  let breakIdx = 0;
  rows.forEach((row, i) => {
    if (breakIdx < categoryBreaks.length && categoryBreaks[breakIdx].rowIndex === i) {
      y += categoryRowH;
      breakIdx += 1;
    }
    rowY.push(y);
    y += rowH;
  });
  const gridBottom = y;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${matrix.width} ${matrix.height}`}
      width={matrix.width}
      height={matrix.height}
      style={{ background: LIGHT.bg, borderRadius: 12, maxWidth: "100%", height: "auto" }}
      fontFamily="Helvetica, Arial, sans-serif"
    >
      <rect x={0} y={0} width={matrix.width} height={matrix.height} fill={LIGHT.bg} />

      {cols.map((c, i) => {
        const cx = gridLeft + i * colW + colW / 2;
        const isSelected = c.id === selectedKey;
        return (
          <text
            key={c.id}
            x={cx}
            y={gridTop - 10}
            fontSize={8.5}
            fontWeight="bold"
            fill={isSelected ? LIGHT.ink : LIGHT.accent}
            fontFamily="Courier New, monospace"
            textAnchor="middle"
            onClick={() => onSelectNode?.(c.id)}
            style={{ cursor: "pointer" }}
          >
            {c.ref.code}
          </text>
        );
      })}

      {categoryBreaks.map((cb) => {
        const bandTop = rowY[cb.rowIndex] - categoryRowH;
        return (
          <g key={cb.label}>
            <rect x={margin} y={bandTop} width={gridRight - margin} height={categoryRowH} fill={LIGHT.panel2} />
            <text x={margin + 6} y={bandTop + categoryRowH - 7} fontSize={8.5} fontWeight="bold" fill={LIGHT.accent} fontFamily="Courier New, monospace" letterSpacing="0.5">
              {cb.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {rows.map((row, i) => {
        const asset = row.ref;
        const ry = rowY[i];
        const isSelected = row.id === selectedKey;
        return (
          <g key={row.id}>
            {i % 2 === 1 && <rect x={margin} y={ry} width={gridRight - margin} height={rowH} fill={LIGHT.panel2} opacity={0.5} />}
            {isSelected && <rect x={margin} y={ry} width={gridRight - margin} height={rowH} fill="none" stroke={LIGHT.accent} strokeWidth={1.5} />}
            <g onClick={() => onSelectNode?.(row.id)} style={{ cursor: "pointer" }}>
              <text x={margin + 6} y={ry + rowH / 2 - 3} fontSize={8.5} fontWeight="bold" fill={LIGHT.accent} fontFamily="Courier New, monospace">{asset.code}</text>
              <text x={margin + 6} y={ry + rowH / 2 + 9} fontSize={8} fill={LIGHT.muted}>
                {asset.name.length > 28 ? asset.name.slice(0, 27) + "…" : asset.name}
              </text>
            </g>
            {cols.map((c, j) => {
              const edge = cellByKey[`${row.id}::${c.id}`];
              if (!edge) return null;
              const cx = gridLeft + j * colW + colW / 2;
              const cy = ry + rowH / 2;
              return (
                <circle key={c.id} cx={cx} cy={cy} r={4.5} fill={LIGHT.accent}>
                  <title>{edge.note || `${asset.code} protects ${c.ref.code}`}</title>
                </circle>
              );
            })}
          </g>
        );
      })}

      <rect x={gridLeft} y={gridTop} width={gridRight - gridLeft} height={gridBottom - gridTop} fill="none" stroke={LIGHT.border} strokeWidth={1} />
      {cols.map((c, i) => (
        <line key={c.id} x1={gridLeft + i * colW} y1={gridTop} x2={gridLeft + i * colW} y2={gridBottom} stroke={LIGHT.border} strokeWidth={0.5} />
      ))}
      {rowY.map((ry, i) => (
        <line key={i} x1={gridLeft} y1={ry} x2={gridRight} y2={ry} stroke={LIGHT.border} strokeWidth={0.5} />
      ))}
    </svg>
  );
});

export default FlowMatrixSVG;

export function FlowMatrixLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: LIGHT.muted }}>
      <svg width="10" height="10"><circle cx="5" cy="5" r="4.5" fill={LIGHT.accent} /></svg>
      Row protects column — hover a dot for detail
    </div>
  );
}
