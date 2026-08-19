import React, { useState } from "react";
import SelectSystem from "./SelectSystem";
import SystemDetail from "./SystemDetail";
import { DEFAULT_SYSTEM_ID } from "./SystemWorkspace/SystemWorkspace";
import type { SystemId } from "../graph/ids";

type LegacySystemTab = "profile" | "map" | "assets";

// Systems is a thin router: the selected system's workspace, with "All Systems"
// as the way back to the picker. Post-login still opens Production AI Platform.
// Clicking Systems in the sidebar remounts with pickerEpoch > 0 and lands on
// the picker. `initialTab` still lets legacy deep-links land on a workspace tab.
export default function Systems({
  initialTab,
  onNavigate,
  pickerEpoch = 0,
}: {
  initialTab?: LegacySystemTab;
  onNavigate?: (target: string) => void;
  pickerEpoch?: number;
}) {
  const [selectedSystemId, setSelectedSystemId] = useState<SystemId | null>(
    initialTab || pickerEpoch === 0 ? DEFAULT_SYSTEM_ID : null
  );

  if (!selectedSystemId) {
    return <SelectSystem onSelectSystem={setSelectedSystemId} />;
  }

  return (
    <SystemDetail
      systemId={selectedSystemId}
      initialTab={initialTab}
      onBack={() => setSelectedSystemId(null)}
      onNavigate={onNavigate}
    />
  );
}
