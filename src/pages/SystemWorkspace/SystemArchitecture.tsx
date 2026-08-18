import React from "react";
import { C } from "../../theme";
import DataMap from "../DataMap";
import type { SystemId } from "../../graph/ids";
import type { WorkspaceSystem } from "./types";

// How does this system actually work? Actors, ingress/egress, trust
// boundaries, and data movement — already modeled by DataMap's
// flowLayoutForSystem-based rendering, reused unchanged here.
interface SystemArchitectureProps {
  systemId: SystemId;
  system: WorkspaceSystem;
  onSelectSystem: (id: SystemId) => void;
}

export function SystemArchitecture({ systemId, system, onSelectSystem }: SystemArchitectureProps) {
  return (
    <div>
      {system.boundary && (
        <div className="px-8 pb-2 text-sm leading-relaxed" style={{ color: C.muted }}>
          {system.boundary}
        </div>
      )}
      <DataMap systemId={systemId} onSelectSystem={onSelectSystem} embedded />
    </div>
  );
}
