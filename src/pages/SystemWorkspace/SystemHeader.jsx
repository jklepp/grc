import React from "react";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "../../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../../components/SystemBadges";

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
    />
  );
}
