import React from "react";
import { Database } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { ClassificationTag } from "../../components/SystemBadges";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import type { WorkspaceDataType, WorkspaceSystem } from "./types";

// One data type as a row, not a boxed tile — name/classification on the
// first line, description underneath, regulatory flags trailing as plain
// text instead of pill badges. A bottom border separates rows instead of
// each one carrying its own card border, so a list of many data types reads
// as one table rather than a wall of tiles.
function DataTypeRow({ dataType, last }: { dataType: WorkspaceDataType; last: boolean }) {
  return (
    <div className="py-3" style={{ borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{dataType.name}</span>
        <ClassificationTag level={dataType.sensitivity} />
      </div>
      {dataType.description && (
        <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{dataType.description}</div>
      )}
      <div className="text-[11px] mt-1" style={{ color: C.muted }}>
        {dataType.regulatoryFlags.length > 0 ? dataType.regulatoryFlags.join(" · ") : "No regulated-data category"}
      </div>
    </div>
  );
}

// What sensitive information does this system handle, and where does it go?
// Classification/volume/retention live here; movement/topology lives in
// Architecture — no overlap between the two tabs.
export function SystemData({ system, dataTypes }: { system: WorkspaceSystem; dataTypes: WorkspaceDataType[] }) {
  const midpoint = Math.ceil(dataTypes.length / 2);
  const dataTypeColumns = [dataTypes.slice(0, midpoint), dataTypes.slice(midpoint)];

  return (
    <div className="px-8 pb-10">
      <SectionHeading icon={Database}>Data</SectionHeading>
      <Panel className="mb-5">
        <div className="mb-3">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>Data Profile</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Population, geographic, and lifecycle characteristics for this system&apos;s data.</div>
        </div>
        <div className="grid grid-cols-4 gap-5">
          <IdentificationField label="Data Subjects" value={system.dataProfile.subjects.join(", ")} />
          <IdentificationField label="Approx. Records" value={system.dataProfile.approxRecords.toLocaleString()} />
          <IdentificationField label="Residency" value={system.dataProfile.residency.join(", ")} />
          <IdentificationField label="Retention" value={system.dataProfile.retention} />
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Data Types Processed</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>Information this system receives, stores, or transmits.</div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: C.accentBg, color: C.accent }}>
            {dataTypes.length} type{dataTypes.length === 1 ? "" : "s"}
          </span>
        </div>
        {dataTypes.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2">
            {dataTypeColumns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className={columnIndex === 0 ? "xl:pr-5 xl:border-r" : "xl:pl-5"}
                style={{ borderColor: C.border }}
              >
                {column.map((dataType, index) => (
                  <DataTypeRow key={dataType.id} dataType={dataType} last={columnIndex === dataTypeColumns.length - 1 && index === column.length - 1} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: C.muted }}>No data types mapped to this system's assets.</div>
        )}
      </Panel>
    </div>
  );
}
