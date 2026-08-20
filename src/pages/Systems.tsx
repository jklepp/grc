import React, { useState } from "react";
import SelectSystem from "./SelectSystem";
import type { SystemSelectOptions } from "./SelectSystem";
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
  const [startAssessment, setStartAssessment] = useState(false);

  function selectSystem(id: SystemId, options?: SystemSelectOptions) {
    setStartAssessment(Boolean(options?.startAssessment));
    setSelectedSystemId(id);
  }

  if (!selectedSystemId) {
    return <SelectSystem onSelectSystem={selectSystem} />;
  }

  return (
    <SystemDetail
      systemId={selectedSystemId}
      initialTab={initialTab}
      startAssessment={startAssessment}
      onBack={() => {
        setStartAssessment(false);
        setSelectedSystemId(null);
      }}
      onNavigate={onNavigate}
    />
  );
}
