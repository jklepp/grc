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
import type { IdentityType } from "./identity";

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
  cloud: ["Physical & Maintenance"],
  saas: [
    "Physical & Maintenance",
    "Capacity & Performance",
    "Endpoint Security",
    "Configuration Management",
    "Vulnerability Management",
    "Secure Development",
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

// How much downtime this boundary can tolerate before it's a business
// failure, not just an incident — the axis the Resilience section's RPO/RTO
// targets get judged against.
export const AVAILABILITY_TIERS = ["tier-1-critical", "tier-2-high", "tier-3-standard", "tier-4-low"] as const;
export type AvailabilityTier = (typeof AVAILABILITY_TIERS)[number];

export const DATA_SUBJECT_TYPES = ["customers", "end-users", "employees", "contractors"] as const;
export type DataSubjectType = (typeof DATA_SUBJECT_TYPES)[number];

// Curated region list for the Add System wizard — AWS and Azure regions ACME
// actually operates in, rather than free text that could drift from what a
// system's provider even offers.
export const CLOUD_REGIONS = [
  "us-east-1",
  "us-west-2",
  "eastus",
  "westus2",
] as const;

// Curated retention periods for the Add System wizard. Kept short and
// selectable rather than free text so a hand-typed rationale can't silently
// stand in for a real policy-backed period.
export const RETENTION_OPTIONS = [
  "1 year",
  "3 years",
  "5 years",
  "7 years post-contract termination",
  "7 years post-employment",
  "Indefinite (active use)",
] as const;

// Data residency options for the Add System wizard. Starts with the one
// jurisdiction ACME's demo systems actually use — add to this list only as
// real systems need it, not speculatively.
export const RESIDENCY_OPTIONS = ["United States"] as const;

// The system-level shape of "what does this boundary hold" — who it's about,
// roughly how many records, and where. Distinct from DataType.sensitivity
// (what kind of data), this is about scale and jurisdiction.
export interface SystemDataProfile {
  subjects: DataSubjectType[];
  approxRecords: number;
  retention: string;
  residency: string[];
}

// Regulatory or business-context obligations that don't reduce to a data
// classification — SOX applies to a system in the financial-reporting
// process regardless of what tier its data lands at, export-controlled and
// ai-regulated are about the use case rather than the payload. Distinct from
// dataTypes.ts's REGULATORY_FLAGS (PII/PHI/PCI/...), which tags individual
// data types and already reaches the applicability engine via dataKinds —
// this only adds what that path can't express.
export const SYSTEM_REGULATORY_CONTEXTS = ["sox", "cui-government", "export-controlled", "ai-regulated"] as const;
export type SystemRegulatoryContext = (typeof SYSTEM_REGULATORY_CONTEXTS)[number];

// Deliberately narrow: RAG/vector-db/agent-tooling presence is already
// derivable from assetKinds (see AAT-01's existing rule). This only adds
// what asset kind can't express: AI usage via a vendor dependency with no
// owned AI asset, and whether the system can act autonomously without a
// human in the loop.
export interface SystemAiUsage {
  usesAI: boolean;
  autonomousActions: boolean;
}

// Where a boundary's surface reaches, as axes rather than one internetFacing
// bool — a workforce-only system and a partner-connected one both read
// "internetFacing: false" but need different network controls.
export const NETWORK_EXPOSURES = [
  "public-inbound",
  "workforce-only",
  "private-internal",
  "partner-connected",
  "vpn-ztna",
  "outbound-internet",
  "inbound-apis",
] as const;
export type NetworkExposure = (typeof NETWORK_EXPOSURES)[number];

// What onboarding declares before any evidence sync has run — the coarse
// version of facts identity.ts / exposure.ts / vendors.ts / sdlc.ts (the
// System Register cockpit domains) later measure precisely per system.
// Applicability unions this with whatever measured posture already exists
// (engine/applicability.ts systemContext()) rather than one overriding the
// other, so a declaration never gets silently hidden by a stale or
// not-yet-synced measurement, and a real measurement is never second-guessed
// by what onboarding guessed. identityTypes reuses identity.ts's IdentityType
// rather than a second vocabulary for the same concept.
export interface OnboardingSecurityProfile {
  identityTypes: IdentityType[];
  networkExposure: NetworkExposure[];
  hasThirdPartyIntegration: boolean;
  // Custom software is developed for this boundary (as opposed to pure
  // COTS/SaaS/infrastructure) — the SDLC-control trigger. Mirrors
  // sdlc.ts SdlcPosture.applicable, which this is superseded by once that's
  // recorded.
  sdlcApplicable: boolean;
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
  internetFacing: boolean;
  availabilityTier: AvailabilityTier;
  userCount: number;
  regions: string[];
  dataProfile: SystemDataProfile;
  aiUsage: SystemAiUsage;
  regulatoryContext: SystemRegulatoryContext[];
  onboardingProfile: OnboardingSecurityProfile;
}
