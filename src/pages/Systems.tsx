import React, { useState } from "react";
import SelectSystem from "./SelectSystem";
import SystemDetail from "./SystemDetail";
import { DEFAULT_SYSTEM_ID } from "./SystemWorkspace/SystemWorkspace";
import type { SystemId } from "../graph/ids";

type LegacySystemTab = "profile" | "map" | "assets";

// Systems is a thin router: the selected system's workspace, with "All Systems"
// as the way back to the picker. Fresh landings — including the post-login
// default — open Production AI Platform. `initialTab` still lets legacy
// deep-links land on a specific workspace tab (App.tsx's legacy-route map).
export default function Systems({ initialTab, onNavigate }: { initialTab?: LegacySystemTab; onNavigate?: (target: string) => void }) {
  const [selectedSystemId, setSelectedSystemId] = useState<SystemId | null>(DEFAULT_SYSTEM_ID);

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
