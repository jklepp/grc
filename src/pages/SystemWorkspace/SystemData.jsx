import React from "react";
import { Database } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { ClassificationTag } from "../../components/SystemBadges";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";

// One data type as a row, not a boxed tile — name/classification on the
// first line, description underneath, regulatory flags trailing as plain
// text instead of pill badges. A bottom border separates rows instead of
// each one carrying its own card border, so a list of many data types reads
// as one table rather than a wall of tiles.
function DataTypeRow({ dataType, last }) {
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
export function SystemData({ system, dataTypes }) {
  return (
    <div className="px-8 pb-10">
      <SectionHeading icon={Database}>Data</SectionHeading>
      <Panel className="grid grid-cols-4 gap-5 mb-5">
        <IdentificationField label="Data Subjects" value={system.dataProfile.subjects.join(", ")} />
        <IdentificationField label="Approx. Records" value={system.dataProfile.approxRecords.toLocaleString()} />
        <IdentificationField label="Residency" value={system.dataProfile.residency.join(", ")} />
        <IdentificationField label="Retention" value={system.dataProfile.retention} />
      </Panel>
      <Panel>
        {dataTypes.map((t, i) => <DataTypeRow key={t.id} dataType={t} last={i === dataTypes.length - 1} />)}
        {dataTypes.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>No data types mapped to this system's assets.</div>
        )}
      </Panel>
    </div>
  );
}
