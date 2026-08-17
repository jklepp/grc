// Vulnerability & configuration posture — an aggregate snapshot, not a CVE
// feed. The cockpit needs "0 critical, 2 high, 96% patch SLA," not a live
// vuln-scanner integration; one row per system, refreshed as a new
// observation rather than accumulated as a growing table.
import type { SystemId } from "../ids";

export interface VulnSnapshot {
  systemId: SystemId;
  asOf: string;
  criticalCount: number;
  highCount: number;
  pastSlaCount: number;
  configFindingCount: number;
  unsupportedComponentCount: number;
  internetFacingCriticalCount: number;
  patchSlaCompliancePct: number;
}
