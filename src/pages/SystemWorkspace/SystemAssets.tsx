import React from "react";
import AssetRegister from "../AssetRegister";
import type { SystemId } from "../../graph/ids";
import { SectionHeader } from "./shared/SectionHeader";

export function SystemAssets({ systemId }: { systemId: SystemId }) {
  return (
    <div className="pb-10">
      <div className="px-8">
        <SectionHeader
          description="Resources inside this system's boundary, grouped by architecture lane with FIPS 199 impact level, verification, and inherent risk."
        />
      </div>
      <AssetRegister systemId={systemId} />
    </div>
  );
}
