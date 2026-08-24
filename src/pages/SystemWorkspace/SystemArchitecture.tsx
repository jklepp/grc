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

// The tab's sentence is passed down rather than rendered here: DataMap puts it
// in a SectionHeader whose aside carries the data-type filter, so the sentence
// and the one control that scopes the whole page share a row.
const DESCRIPTION =
  "Actors, trust boundaries, request paths, control-plane dependencies, deployment, and recovery infrastructure.";

export function SystemArchitecture({ systemId, onSelectSystem }: SystemArchitectureProps) {
  return (
    <div className="pb-10">
      <DataMap systemId={systemId} onSelectSystem={onSelectSystem} embedded description={DESCRIPTION} />
    </div>
  );
}
