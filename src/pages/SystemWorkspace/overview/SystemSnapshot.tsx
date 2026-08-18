import React from "react";
import { Building2 } from "lucide-react";
import { C, CLASS_META, CLASS_ORDER } from "../../../theme";
import { SectionHeading } from "../../../components/Headings";
import { ClassificationTag, StandardChip } from "../../../components/SystemBadges";
import { Panel } from "../shared/Panel";
import { IdentificationField } from "../shared/IdentificationField";
import { ProviderBadge } from "../ProviderBadge";
import { hostingTypeLabel } from "../controlMeta";
import type { WorkspaceDataType, WorkspaceSystem, ExposurePosture } from "../types";

function bandColor(color?: string): string {
  if (color === "red") return C.red;
  if (color === "amber") return C.amber;
  if (color === "green") return C.green;
  return C.ink;
}

function ownerName(system: WorkspaceSystem): string {
  const owner = system.roles.find((r) => /owner/i.test(r.role));
  return owner ? `${owner.assignment} (${owner.role})` : "Unassigned";
}

// A small colored-accent card per data type, ranked by sensitivity — makes
// the system's most sensitive holdings pop instead of reading as a
// comma-joined label/value line like every other field here.
function MiniDataTypeCard({ dataType }: { dataType: WorkspaceDataType }) {
  const meta = CLASS_META[dataType.sensitivity];
  return (
    <div className="rounded-lg pl-3 pr-3 py-2 flex-1 min-w-[140px]" style={{ background: C.panel2, borderLeft: `3px solid ${meta.color}` }}>
      <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{dataType.name}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: meta.color }}>{dataType.sensitivity}</div>
    </div>
  );
}

export function SystemSnapshot({ system, exposure, dataTypes }: { system: WorkspaceSystem; exposure: ExposurePosture; dataTypes: WorkspaceDataType[] }) {
  const topDataTypes = [...dataTypes]
    .sort((a, b) => CLASS_ORDER.indexOf(b.sensitivity) - CLASS_ORDER.indexOf(a.sensitivity))
    .slice(0, 3);
  const inbound = exposure.posture?.inboundIntegrationCount ?? "—";
  const outbound = exposure.posture?.outboundIntegrationCount ?? "—";

  return (
    <Panel>
      <SectionHeading icon={Building2} className="mb-3 pb-2">System Snapshot</SectionHeading>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <IdentificationField label="Owner" value={ownerName(system)} />
        <IdentificationField label="Classification" value={system.classification ? <ClassificationTag level={system.classification} /> : "Unclassified"} />
        <IdentificationField label="Environment" value={system.env.split("—")[0].trim()} />
        <IdentificationField
          label="Hosting"
          value={
            <span className="inline-flex items-center gap-1.5">
              <ProviderBadge provider={system.provider} />
              {hostingTypeLabel(system.hostingType)}
            </span>
          }
        />
        <IdentificationField
          label="Criticality"
          value={<span style={{ color: bandColor(system.criticalityBand?.color) }}>{system.criticalityBand?.label ?? "—"}</span>}
        />
        <IdentificationField
          label="Internet-Facing"
          value={<span style={{ color: system.internetFacing ? C.amber : C.green }}>{system.internetFacing ? "Yes" : "No"}</span>}
        />
        <IdentificationField label="Assets" value={system.assetCount} />
        <IdentificationField label="Integrations" value={`${inbound} inbound · ${outbound} outbound`} />
        <IdentificationField label="Users" value={system.userCount?.toLocaleString?.() ?? system.userCount} />
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Major Data Types</div>
          {topDataTypes.length === 0 ? (
            <div className="text-sm" style={{ color: C.muted }}>None mapped</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topDataTypes.map((t) => <MiniDataTypeCard key={t.id} dataType={t} />)}
            </div>
          )}
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Framework Standards In Scope</div>
          <div className="flex flex-wrap gap-1.5">
            {system.standards.map((s) => <StandardChip key={s} standard={s} />)}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Purpose</div>
        <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{system.mission}</div>
      </div>
    </Panel>
  );
}
