import React from "react";
import { Database } from "lucide-react";
import { C } from "../../theme";
import { SectionHeading } from "../../components/Headings";
import { DataTypeCard } from "../../components/SystemBadges";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";

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
      <div className="grid grid-cols-3 gap-4">
        {dataTypes.map((t) => <DataTypeCard key={t.id} dataType={t} />)}
        {dataTypes.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>No data types mapped to this system's assets.</div>
        )}
      </div>
    </div>
  );
}
