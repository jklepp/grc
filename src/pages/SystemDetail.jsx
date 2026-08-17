import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C } from "../theme";
import SystemRegister from "./SystemRegister";

// Legacy top-level tab ids ("profile"/"map"/"assets") map onto the System
// Security Profile's own internal tabs, so deep-links set up before Map and
// Assets moved in there still land on the right one.
const INITIAL_SUBTAB_BY_LEGACY_TAB = { profile: "overview", map: "map", assets: "assets" };

// Full-page view for a single selected system. Its Security Map and Assets
// are tabs inside SystemRegister itself now, alongside its other document
// sections — this wrapper just adds the "All Systems" back-link above it.
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

      <SystemRegister
        systemId={systemId}
        onSelectSystem={setSystemId}
        initialSubTab={INITIAL_SUBTAB_BY_LEGACY_TAB[initialTab]}
      />
    </div>
  );
}
