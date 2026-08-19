import React, { useState } from "react";
import SelectSystem from "./SelectSystem";
import SystemDetail from "./SystemDetail";
import { DEFAULT_SYSTEM_ID } from "./SystemWorkspace/SystemWorkspace";
import type { SystemId } from "../graph/ids";

type LegacySystemTab = "profile" | "map" | "assets";

// Systems is a thin router: "Select a System" until one is picked, then the
// full-page System Security Profile (with its Map/Assets sibling tabs) via
// SystemDetail. `initialTab` lets legacy deep-links (e.g. Policy Center's
// "View Register" link) land straight on a tab without going through the
// picker — App.jsx's legacy-route map is the only caller that sets it.
export default function Systems({ initialTab, onNavigate }: { initialTab?: LegacySystemTab; onNavigate?: (target: string) => void }) {
  const [selectedSystemId, setSelectedSystemId] = useState<SystemId | null>(initialTab ? DEFAULT_SYSTEM_ID : null);

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
