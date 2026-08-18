import React from "react";
import { ClipboardCheck, Pencil } from "lucide-react";
import { C } from "../../theme";
import { PageHeader } from "../../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../../components/SystemBadges";

export function SystemHeader({ system, systems, systemId, onSelectSystem, onEdit }) {
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
      right={(
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2"
            style={{ color: C.ink, background: C.panel, border: `1px solid ${C.border}` }}
          >
            <Pencil size={13} /> Edit System
          </button>
          <SystemPicker systems={systems} systemId={systemId} onSelect={onSelectSystem} />
        </div>
      )}
    />
  );
}
