import React from "react";
import SelectSystem from "./SelectSystem";
import type { SystemSelectOptions } from "./SelectSystem";
import SystemDetail from "./SystemDetail";
import { useLiveEngine } from "../engine/useLiveEngine";
import type { SystemId } from "../graph/ids";
import type { SystemWorkspaceTab } from "./SystemWorkspace/tabs";

// Systems is a thin router driven entirely by the route App parses from the
// URL hash: `systemId` null shows the picker, an id opens that system's
// workspace. Selection and tab changes report upward so the hash stays the
// single source of truth (deep links, refresh, and back/forward all work).
export default function Systems({
  systemId,
  systemTab,
  startAssessment = false,
  onOpenSystem,
  onShowPicker,
  onSystemTabChange,
  onNavigate,
}: {
  systemId: SystemId | null;
  systemTab?: SystemWorkspaceTab;
  startAssessment?: boolean;
  onOpenSystem: (id: SystemId, options?: SystemSelectOptions) => void;
  onShowPicker: () => void;
  onSystemTabChange?: (tab: SystemWorkspaceTab) => void;
  onNavigate?: (target: string) => void;
}) {
  const liveEngine = useLiveEngine();
  // A stale or mistyped deep-link (e.g. a deleted system) degrades to the
  // picker instead of crashing the workspace.
  const validSystemId = systemId && liveEngine.rollups.systemRollups.some((s) => s.id === systemId) ? systemId : null;

  if (!validSystemId) {
    return <SelectSystem onSelectSystem={onOpenSystem} />;
  }

  return (
    <SystemDetail
      systemId={validSystemId}
      initialSubTab={systemTab}
      startAssessment={startAssessment}
      onBack={onShowPicker}
      onSelectSystem={(id) => onOpenSystem(id)}
      onSubTabChange={onSystemTabChange}
      onNavigate={onNavigate}
    />
  );
}
