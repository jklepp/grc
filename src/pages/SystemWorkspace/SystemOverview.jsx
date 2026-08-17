import React from "react";
import { AssuranceCockpit } from "./overview/AssuranceCockpit";
import { AttentionRequired } from "./overview/AttentionRequired";
import { SystemSnapshot } from "./overview/SystemSnapshot";
import { DataSnapshot } from "./overview/DataSnapshot";
import { RecentSystemActivity } from "./overview/RecentSystemActivity";

export function SystemOverview({ system, cockpit, identity, exposure, resilience, secTests, ir, vendors, dataTypes, onNavigate }) {
  return (
    <div className="px-8 pb-10 space-y-8">
      <AssuranceCockpit system={system} cockpit={cockpit} />

      <div className="grid grid-cols-2 gap-5">
        <SystemSnapshot system={system} exposure={exposure} dataTypes={dataTypes} />
        <AttentionRequired cockpit={cockpit} onNavigate={onNavigate} />
      </div>

      <DataSnapshot dataTypes={dataTypes} onNavigate={onNavigate} />

      <RecentSystemActivity identity={identity} resilience={resilience} secTests={secTests} ir={ir} vendors={vendors} />
    </div>
  );
}
