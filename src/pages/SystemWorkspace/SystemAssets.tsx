import React from "react";
import AssetRegister from "../AssetRegister";
import type { SystemId } from "../../graph/ids";

export function SystemAssets({ systemId }: { systemId: SystemId }) {
  return <AssetRegister systemId={systemId} />;
}
