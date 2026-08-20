import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { getDataType } from "../engine";
import type { DataTypeId } from "../graph/ids";
import type { System } from "../graph/nodes/systems";
import type { ControlPlaneMatrix, DataFlowDiagram, FlowLayout } from "./flowDiagramLayout";

type AssetLabelGetter = (id: string) => string;

export interface FlowTableRow {
  id: string;
  kind: string;
  from: string;
  to: string;
  dataTypes: string;
  note: string;
}

interface ExportFlowDiagramOptions {
  dataSvgEl: SVGSVGElement;
  dataDiagram: DataFlowDiagram;
  controlSvgEl?: SVGSVGElement | null;
  controlDiagram?: ControlPlaneMatrix | null;
  system: System;
  dataTypeLabel?: string;
  layout: FlowLayout;
  getAssetLabel: AssetLabelGetter;
}

function dataTypeNames(ids: readonly DataTypeId[] | undefined): string {
  return (ids || []).map((id) => getDataType(id)?.name || id).join(", ");
}

// Builds the same table a human auditor would want next to each diagram: one
// row per real edge, so nothing the picture draws is unverifiable text and
// nothing verifiable is missing from the picture. Pulled straight from the
// same layout object the diagrams are built from — never re-derived or
// hand-typed, per this project's data-integrity rule. Split to match the
// data-flow / control-plane page split.
export function buildDataFlowRows(layout: FlowLayout, getAssetLabel: AssetLabelGetter): FlowTableRow[] {
  const rows: FlowTableRow[] = [];
  (layout.edges || []).forEach((f) =>
    rows.push({ id: f.id, kind: "Data", from: getAssetLabel(f.from), to: getAssetLabel(f.to), dataTypes: dataTypeNames(f.dataTypeIds), note: f.note || "" })
  );
  (layout.ingressActors || []).forEach((a) =>
    rows.push({ id: `${a.actor.id}->${a.assetId}`, kind: "Actor (inbound)", from: a.actor.name, to: getAssetLabel(a.assetId), dataTypes: "", note: a.note || "" })
  );
  (layout.egressActors || []).forEach((a) =>
    rows.push({ id: `${a.assetId}->${a.actor.id}`, kind: "Actor (outbound)", from: getAssetLabel(a.assetId), to: a.actor.name, dataTypes: "", note: a.note || "" })
  );
  (layout.backupRecovery || []).forEach((b) => {
    b.backedUpFrom.forEach((source) =>
      rows.push({ id: `backup:${source.id}->${b.asset.id}`, kind: "Backup", from: getAssetLabel(source.id), to: getAssetLabel(b.asset.id), dataTypes: "", note: `${source.code} backs up to ${b.asset.code}` })
    );
    b.restoresTo.forEach((target) =>
      rows.push({ id: `restore:${b.asset.id}->${target.id}`, kind: "Restore", from: getAssetLabel(b.asset.id), to: getAssetLabel(target.id), dataTypes: "", note: `${b.asset.code} restores to ${target.code}` })
    );
  });
  return rows;
}

export function buildControlPlaneRows(layout: FlowLayout, getAssetLabel: AssetLabelGetter): FlowTableRow[] {
  return (layout.controlPlaneEdges || []).map((f) => ({
    id: f.id, kind: "Control plane", from: getAssetLabel(f.from), to: getAssetLabel(f.to), dataTypes: dataTypeNames(f.dataTypeIds), note: f.note || "",
  }));
}

const TABLE_PAGE: [number, number] = [842, 595]; // A4 landscape, pt
const TABLE_MARGIN = 36;
const COLS: Array<{ key: keyof FlowTableRow; label: string; w: number }> = [
  { key: "kind", label: "Kind", w: 90 },
  { key: "from", label: "From", w: 190 },
  { key: "to", label: "To", w: 190 },
  { key: "dataTypes", label: "Data types", w: 160 },
  { key: "note", label: "Note", w: 140 },
];

function drawTableHeader(doc: jsPDF, y: number): number {
  let x = TABLE_MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 100);
  COLS.forEach((c) => {
    doc.text(c.label, x, y);
    x += c.w;
  });
  doc.setDrawColor(210, 210, 216);
  doc.line(TABLE_MARGIN, y + 4, TABLE_PAGE[0] - TABLE_MARGIN, y + 4);
  return y + 16;
}

function drawRows(doc: jsPDF, rows: FlowTableRow[], title: string): void {
  doc.addPage(TABLE_PAGE, "l");
  let y = TABLE_MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 30);
  doc.text(title, TABLE_MARGIN, y);
  y += 22;
  y = drawTableHeader(doc, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  rows.forEach((row) => {
    const wrapped = COLS.map((c) => doc.splitTextToSize(String(row[c.key] ?? ""), c.w - 8));
    const lineCount = Math.max(1, ...wrapped.map((w) => w.length));
    const rowHeight = lineCount * 10 + 6;

    if (y + rowHeight > TABLE_PAGE[1] - TABLE_MARGIN) {
      doc.addPage(TABLE_PAGE, "l");
      y = TABLE_MARGIN;
      y = drawTableHeader(doc, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    let x = TABLE_MARGIN;
    doc.setTextColor(40, 40, 48);
    COLS.forEach((c, i) => {
      doc.text(wrapped[i], x, y + 8);
      x += c.w;
    });
    y += rowHeight;
  });
}

const DIAGRAM_HEADER_H = 44;

function drawDiagramHeader(doc: jsPDF, title: string, dataTypeLabel?: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 30);
  doc.text(title, 16, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 120);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}${dataTypeLabel ? ` · Filtered to ${dataTypeLabel}` : ""}`, 16, 30);
}

// Renders each diagram's own SVG element into a PDF page sized to fit it
// exactly (no page breaks through the middle of a picture), each immediately
// followed by a paginated table of every edge it drew. Two diagrams — data
// movement, then control plane — because a single combined picture put a
// request path with ~17 real edges underneath a control layer with ~26,
// which was most of what made it hard to read; splitting along DATA_FLOWS'
// own `kind` field isolates that fan-out onto its own page instead of
// inventing an arbitrary cut.
export async function exportFlowDiagramPdf({ dataSvgEl, dataDiagram, controlSvgEl, controlDiagram, system, dataTypeLabel, layout, getAssetLabel }: ExportFlowDiagramOptions): Promise<void> {
  const pageCount = controlDiagram ? 2 : 1;
  const width = Math.max(1, Math.ceil(dataDiagram.width));
  const height = Math.max(1, Math.ceil(dataDiagram.height));
  const pageHeight = height + DIAGRAM_HEADER_H;
  const doc = new jsPDF({ orientation: width >= pageHeight ? "l" : "p", unit: "pt", format: [width, pageHeight] });

  drawDiagramHeader(doc, `${system.name} (${system.id}) — Data Flow Diagram (1 of ${pageCount}): Data Movement`, dataTypeLabel);
  await doc.svg(dataSvgEl, { x: 0, y: DIAGRAM_HEADER_H, width, height });

  const dataRows = buildDataFlowRows(layout, getAssetLabel);
  if (dataRows.length) drawRows(doc, dataRows, "Data flow detail");

  if (controlDiagram && controlSvgEl) {
    const cw = Math.max(1, Math.ceil(controlDiagram.width));
    const ch = Math.max(1, Math.ceil(controlDiagram.height));
    const cPageHeight = ch + DIAGRAM_HEADER_H;
    doc.addPage([cw, cPageHeight], cw >= cPageHeight ? "l" : "p");
    drawDiagramHeader(doc, `${system.name} (${system.id}) — Data Flow Diagram (2 of 2): Control Plane`, dataTypeLabel);
    await doc.svg(controlSvgEl, { x: 0, y: DIAGRAM_HEADER_H, width: cw, height: ch });

    const controlRows = buildControlPlaneRows(layout, getAssetLabel);
    if (controlRows.length) drawRows(doc, controlRows, "Control plane detail");
  }

  doc.save(`${system.id}-data-flow-diagram.pdf`);
}
