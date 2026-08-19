import React from "react";
import { AssuranceCockpit } from "./overview/AssuranceCockpit";
import { AttentionRequired } from "./overview/AttentionRequired";
import { SystemSnapshot } from "./overview/SystemSnapshot";
import { RecentSystemActivity } from "./overview/RecentSystemActivity";
import type {
  CockpitSummary, ExposurePosture, IdentityPosture, IncidentResponsePosture,
  ResiliencePosture, SecurityTestingPosture, VendorPosture, WorkspaceDataType, WorkspaceSystem,
} from "./types";
import type { SystemWorkspaceTab } from "./tabs";

interface SystemOverviewProps {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  identity: IdentityPosture;
  exposure: ExposurePosture;
  resilience: ResiliencePosture;
  secTests: SecurityTestingPosture;
  ir: IncidentResponsePosture;
  vendors: VendorPosture;
  dataTypes: WorkspaceDataType[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
}

export function SystemOverview(props: SystemOverviewProps) {
  const { system, cockpit, identity, exposure, resilience, secTests, ir, vendors, dataTypes, onNavigate } = props;
  return (
    <div className="px-8 pb-10 space-y-8">
      <AssuranceCockpit system={system} cockpit={cockpit} />

      <div className="grid grid-cols-2 gap-5">
        <SystemSnapshot system={system} exposure={exposure} dataTypes={dataTypes} />
        <AttentionRequired cockpit={cockpit} onNavigate={onNavigate} />
      </div>

      <RecentSystemActivity identity={identity} resilience={resilience} secTests={secTests} ir={ir} vendors={vendors} />
    </div>
  );
}
