import React from "react";
import SystemWorkspace from "./SystemWorkspace/SystemWorkspace";
import type { SystemId } from "../graph/ids";
import type { SystemWorkspaceTab } from "./SystemWorkspace/tabs";

// Full-page view for a single selected system. Fully controlled: the system
// and workspace tab come from the route, and switching either reports upward
// so the URL hash stays in sync.
interface SystemDetailProps {
  systemId: SystemId;
  initialSubTab?: SystemWorkspaceTab;
  startAssessment?: boolean;
  onBack: () => void;
  onSelectSystem?: (id: SystemId) => void;
  onSubTabChange?: (tab: SystemWorkspaceTab) => void;
  onNavigate?: (target: string) => void;
}

export default function SystemDetail({ systemId, initialSubTab, startAssessment = false, onBack, onSelectSystem, onSubTabChange, onNavigate }: SystemDetailProps) {
  return (
    <div className="w-full">
      <SystemWorkspace
        systemId={systemId}
        onSelectSystem={onSelectSystem}
        initialSubTab={startAssessment ? "controls" : initialSubTab}
        onSubTabChange={onSubTabChange}
        startAssessment={startAssessment}
        onNavigate={onNavigate}
        onBack={onBack}
      />
    </div>
  );
}
