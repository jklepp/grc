import React from "react";
import { ClipboardCheck } from "lucide-react";
import { C } from "../../theme";
import { PageHeader } from "../../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../../components/SystemBadges";

// A small neutral chip for facts that aren't a classification/assurance
// judgment — just "where and how this runs" (environment, hosting, exposure).
function InfoChip({ children, tone }) {
  const color = tone === "amber" ? C.amber : C.muted;
  const bg = tone === "amber" ? C.amberBg : C.panel2;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

export function SystemHeader({ system, systems, systemId, onSelectSystem }) {
  return (
    <PageHeader
      icon={ClipboardCheck}
      title={
        <span className="inline-flex items-center gap-3 flex-wrap">
          {system.name}
          <ClassificationTag level={system.classification} />
          <AssuranceBadge pct={system.overallAssurance} />
        </span>
      }
      description="A live operational view of this system's security posture — what it contains, how it's exposed, how it's protected, and what the evidence proves."
      descriptionClassName="max-w-none whitespace-nowrap"
      right={<SystemPicker systems={systems} systemId={systemId} onSelect={onSelectSystem} />}
    >
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <InfoChip>{system.env}</InfoChip>
        <InfoChip>{system.hostingType} · {system.provider}</InfoChip>
        <InfoChip tone={system.internetFacing ? "amber" : undefined}>
          {system.internetFacing ? "Internet-facing" : "Not internet-facing"}
        </InfoChip>
      </div>
    </PageHeader>
  );
}
