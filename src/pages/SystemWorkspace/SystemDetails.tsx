import React from "react";
import { SystemSnapshot } from "./overview/SystemSnapshot";
import { AttentionRequired } from "./overview/AttentionRequired";
import type { CockpitSummary, ExposurePosture, WorkspaceDataType, WorkspaceSystem } from "./types";
import type { SystemWorkspaceTab } from "./tabs";

// The landing page of the Details group — reached by clicking the tab bar's
// "Details" button itself, the same way TopNav's grouped items open a landing
// page while their dropdown jumps straight to one area. It holds what used to
// sit below Overview's two assurance sections, so Overview stays exactly two
// readings of this system's posture and its readiness to be assessed.
interface SystemDetailsProps {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  exposure: ExposurePosture;
  dataTypes: WorkspaceDataType[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
}

export function SystemDetails({ system, cockpit, exposure, dataTypes, onNavigate }: SystemDetailsProps) {
  return (
    <div className="px-4 lg:px-8 pb-10 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SystemSnapshot system={system} exposure={exposure} dataTypes={dataTypes} />
        <AttentionRequired cockpit={cockpit} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
