import React, { useState } from "react";
import SystemWorkspace from "./SystemWorkspace/SystemWorkspace";
import type { SystemId } from "../graph/ids";
import type { SystemWorkspaceTab } from "./SystemWorkspace/tabs";

// Legacy top-level tab ids ("profile"/"map"/"assets") map onto the System
// Workspace's own internal tabs, so deep-links set up before Architecture and
// Assets moved in there still land on the right one.
type LegacySystemTab = "profile" | "map" | "assets";
const INITIAL_SUBTAB_BY_LEGACY_TAB: Record<LegacySystemTab, SystemWorkspaceTab> = { profile: "overview", map: "architecture", assets: "assets" };

// Full-page view for a single selected system. Its Architecture and Assets
// are tabs inside SystemWorkspace itself now, alongside its other tabs —
// this wrapper just threads the "All Systems" back-link into SystemHeader's
// own eyebrow slot so it doesn't cost a full extra row.
interface SystemDetailProps {
  systemId: SystemId;
  initialTab?: LegacySystemTab;
  startAssessment?: boolean;
  onBack: () => void;
  onNavigate?: (target: string) => void;
}

export default function SystemDetail({ systemId: initialSystemId, initialTab, startAssessment = false, onBack, onNavigate }: SystemDetailProps) {
  const [systemId, setSystemId] = useState<SystemId>(initialSystemId);

  return (
    <div className="w-full">
      <SystemWorkspace
        systemId={systemId}
        onSelectSystem={setSystemId}
        initialSubTab={startAssessment ? "controls" : (initialTab ? INITIAL_SUBTAB_BY_LEGACY_TAB[initialTab] : undefined)}
        startAssessment={startAssessment}
        onNavigate={onNavigate}
        onBack={onBack}
      />
    </div>
  );
}
