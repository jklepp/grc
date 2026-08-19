import React from "react";
import { ClipboardCheck, Pencil } from "lucide-react";
import { C } from "../../theme";
import { PageHeader } from "../../components/Headings";
import { ClassificationTag, AssuranceBadge, SystemPicker } from "../../components/SystemBadges";
import type { SystemId } from "../../graph/ids";
import type { WorkspaceSystem } from "./types";

interface SystemHeaderProps {
  system: WorkspaceSystem;
  systems: readonly WorkspaceSystem[];
  systemId: SystemId;
  onSelectSystem: (id: SystemId) => void;
  onEdit: () => void;
}

export function SystemHeader({ system, systems, systemId, onSelectSystem, onEdit }: SystemHeaderProps) {
  return (
    <PageHeader
      icon={ClipboardCheck}
      title={
        <span className="inline-flex items-center gap-3 flex-wrap">
          {system.name}
          {system.classification && <ClassificationTag level={system.classification} />}
          <AssuranceBadge pct={system.overallAssurance} />
        </span>
      }
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
