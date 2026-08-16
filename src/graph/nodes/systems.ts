// System — a security boundary ACME operates. Facts only.
//
// This is systemRegister.js's SYSTEMS with every derived or duplicated field
// removed. What left, and where it went:
//
//   classification    -> DERIVED. A system's tier is now the high-water mark of
//                        its assets, which is in turn the high-water mark of the
//                        data each asset holds (engine/rollups.ts). validate.js
//                        asserts the derived value still equals the curated one
//                        recorded in EXPECTED_CLASSIFICATION below, so the
//                        rollup has to reproduce the human answer or fail.
//   dataElements      -> edges/assetDataTypes.ts, at asset granularity.
//   controls[]        -> edges/controlImplementations.ts. The six hand-tracked
//                        controls are now real per-asset implementation records
//                        against real SCF ids instead of an unnamed array whose
//                        index silently had to line up with CONTROLS.
//   standardMappings  -> DERIVED by engine/compliance.ts from those same
//                        implementations, so a "SOC 2 CC6.1 is 92% confident"
//                        claim is computed from the controls that actually
//                        satisfy CC6.1 rather than typed next to it.
//   remediation[]     -> graph/nodes/findings.ts. A remediation ticket is now
//                        a Finding, a real node with its own owner/status/due
//                        instead of an array embedded on the system it
//                        happens to affect. engine/findings.ts derives which
//                        findings belong to a system from the finding's asset.
//   roles[].assignment -> roles[].ownerId, a reference into nodes/orgs.ts
//                        instead of a free-text team name. engine/rollups.ts
//                        resolves it back to a display name so nothing
//                        downstream had to change.
//
// hostingType is kept as a stored fact rather than re-parsed from the `env`
// string on every call the way systemRegister.js's hostingType() did — the
// substring match on "SaaS"/"on-prem" was doing inference where a field will do.
import type { SystemId, OrgId } from "../ids";

export const HOSTING_TYPES = ["cloud", "saas", "on-prem"] as const;
export type HostingType = (typeof HOSTING_TYPES)[number];

// Which control DOMAINS a hosting arrangement's provider already covers under
// its own certification, rather than needing separate ACME evidence.
//
// This replaces INHERITED_RATE, a single fraction per hosting type (cloud 0.2,
// saas 0.35) that was multiplied against a system's required-control count to
// produce an inherited total. That produced a plausible number and named no
// controls: it could say 113 of Workday's controls are inherited but not which
// ones, so "is physical security ACME's problem here?" had no answer.
//
// A shared-responsibility split is genuinely domain-shaped. On IaaS, ACME
// configures the workload and the provider owns the building and the hardware.
// On SaaS the provider additionally owns the platform's own patching,
// hardening, capacity, and endpoints. On-prem inherits nothing, because there
// is no provider. Which domains fall where is a judgment about the contract —
// the same kind of call as the domain maps in taxonomy.ts — but it is at least
// a judgment about something nameable.
export const INHERITED_DOMAINS: Record<HostingType, string[]> = {
  cloud: ["Physical & Environmental Security", "Maintenance"],
  saas: [
    "Physical & Environmental Security",
    "Maintenance",
    "Capacity & Performance Planning",
    "Endpoint Security",
    "Configuration Management",
    "Vulnerability & Patch Management",
    "Secure Engineering & Architecture",
    "Technology Development & Acquisition",
  ],
  "on-prem": [],
};

export function inheritsDomain(hostingType: string, domain: string): boolean {
  return (INHERITED_DOMAINS[hostingType as HostingType] || []).includes(domain);
}

export interface SystemRole {
  role: string;
  ownerId: OrgId;
  note?: string;
}

export interface System {
  id: SystemId;
  name: string;
  env: string;
  hostingType: HostingType;
  provider: string;
  standards: string[];
  mission: string;
  boundary: string;
  connections: string[];
  roles: SystemRole[];
  syncSource: string;
  lastSynced: string;
  oktaEnforced: string;
  mfaEnforced: string;
}
