import React from "react";
import { Network } from "lucide-react";
import DataMap from "../DataMap";
import type { SystemId } from "../../graph/ids";
import { SectionHeader } from "./shared/SectionHeader";

// How does this system actually work? Actors, ingress/egress, trust
// boundaries, and data movement — already modeled by DataMap's
// flowLayoutForSystem-based rendering, reused unchanged here.
interface SystemArchitectureProps {
  systemId: SystemId;
  onSelectSystem: (id: SystemId) => void;
}

export function SystemArchitecture({ systemId, onSelectSystem }: SystemArchitectureProps) {
  return (
    <div className="pb-10">
      <div className="px-8">
        <SectionHeader
          icon={Network}
          title="System Architecture"
          description="Actors, trust boundaries, request paths, control-plane dependencies, deployment, and recovery infrastructure."
        />
      </div>
      <DataMap systemId={systemId} onSelectSystem={onSelectSystem} embedded />
    </div>
  );
}
