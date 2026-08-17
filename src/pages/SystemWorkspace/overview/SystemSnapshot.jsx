import React from "react";
import { Building2 } from "lucide-react";
import { C } from "../../../theme";
import { SectionHeading } from "../../../components/Headings";
import { ClassificationTag } from "../../../components/SystemBadges";
import { Panel } from "../shared/Panel";
import { IdentificationField } from "../shared/IdentificationField";

function bandColor(color) {
  if (color === "red") return C.red;
  if (color === "amber") return C.amber;
  if (color === "green") return C.green;
  return C.ink;
}

function ownerName(system) {
  const owner = system.roles.find((r) => /owner/i.test(r.role));
  return owner ? `${owner.assignment} (${owner.role})` : "Unassigned";
}

export function SystemSnapshot({ system, exposure, dataTypes }) {
  const topDataTypes = dataTypes.slice(0, 3).map((t) => t.name).join(", ") || "None mapped";
  const inbound = exposure.posture?.inboundIntegrationCount ?? "—";
  const outbound = exposure.posture?.outboundIntegrationCount ?? "—";

  return (
    <Panel>
      <SectionHeading icon={Building2} className="mb-3 pb-2">System Snapshot</SectionHeading>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <IdentificationField label="Owner" value={ownerName(system)} />
        <IdentificationField label="Classification" value={<ClassificationTag level={system.classification} />} />
        <IdentificationField label="Hosting" value={`${system.hostingType} · ${system.provider}`} />
        <IdentificationField
          label="Criticality"
          value={<span style={{ color: bandColor(system.criticalityBand?.color) }}>{system.criticalityBand?.label ?? "—"}</span>}
        />
        <IdentificationField label="Assets" value={system.assetCount} />
        <IdentificationField label="Integrations" value={`${inbound} inbound · ${outbound} outbound`} />
        <IdentificationField label="Users" value={system.userCount?.toLocaleString?.() ?? system.userCount} />
        <IdentificationField label="Major Data Types" value={topDataTypes} />
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Purpose</div>
        <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{system.mission}</div>
      </div>
    </Panel>
  );
}
