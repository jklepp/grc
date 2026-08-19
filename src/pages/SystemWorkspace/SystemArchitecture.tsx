import React from "react";
import DataMap from "../DataMap";
import type { SystemId } from "../../graph/ids";

// How does this system actually work? Actors, ingress/egress, trust
// boundaries, and data movement — already modeled by DataMap's
// flowLayoutForSystem-based rendering, reused unchanged here.
interface SystemArchitectureProps {
  systemId: SystemId;
  onSelectSystem: (id: SystemId) => void;
}

export function SystemArchitecture({ systemId, onSelectSystem }: SystemArchitectureProps) {
  return <DataMap systemId={systemId} onSelectSystem={onSelectSystem} embedded />;
}
