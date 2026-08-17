import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C } from "../theme";
import SystemWorkspace from "./SystemWorkspace/SystemWorkspace";

// Legacy top-level tab ids ("profile"/"map"/"assets") map onto the System
// Workspace's own internal tabs, so deep-links set up before Architecture and
// Assets moved in there still land on the right one.
const INITIAL_SUBTAB_BY_LEGACY_TAB = { profile: "overview", map: "architecture", assets: "assets" };

// Full-page view for a single selected system. Its Architecture and Assets
// are tabs inside SystemWorkspace itself now, alongside its other tabs —
// this wrapper just adds the "All Systems" back-link above it.
export default function SystemDetail({ systemId: initialSystemId, initialTab, onBack }) {
  const [systemId, setSystemId] = useState(initialSystemId);

  return (
    <div className="w-full">
      <div className="px-8 pt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: C.muted }}
        >
          <ArrowLeft size={13} /> All Systems
        </button>
      </div>

      <SystemWorkspace
        systemId={systemId}
        onSelectSystem={setSystemId}
        initialSubTab={INITIAL_SUBTAB_BY_LEGACY_TAB[initialTab]}
      />
    </div>
  );
}
