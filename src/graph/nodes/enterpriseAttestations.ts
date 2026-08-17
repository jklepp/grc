// The reports ACME stands on for the domains a central program runs on every
// system's behalf, rather than a vendor's.
//
// providerCertifications.ts scores INHERITED_DOMAINS (nodes/systems.ts) — the
// domains a hosting provider covers under its own certification. This is the
// same idea one level over: some domains aren't run by this system's team OR
// by a vendor, they're run once, centrally, by an ACME program — enterprise
// IAM, enterprise vulnerability management, enterprise incident response.
// Treating every system as independently responsible for those would be as
// false as treating a vendor-run domain as unowned; treating them as silently
// "not applicable" would be the applicability-as-scope-dodge this graph
// already rejected once for vendors (see controlImplementations.ts).
//
// Same shape and same rule as a provider certification: a domain claimed here
// needs a real attestation behind it or the build fails (graph/validate.ts),
// and the attestation's grade — same seven-value evidence scale — is what
// holds an enterprise-inherited control below one ACME verified for this
// system specifically.
import type { EvidenceType } from "./taxonomy";
import type { CertificationReportType } from "./providerCertifications";
import type { OrgId } from "../ids";

export interface EnterpriseAttestation {
  id: string;
  // The central program, not this system's team — "Enterprise IAM Program",
  // not "SYS-003 Identity Team".
  program: string;
  ownerOrgId: OrgId;
  // What kind of internal review actually happened. Reuses provider
  // certification's vocabulary because the question is the same one: was this
  // a period-long test or a point-in-time look.
  reportType: CertificationReportType;
  evidenceType: EvidenceType;
  assessedAt: string;
  validForDays: number;
  // The SCF domains this program covers ACME-wide.
  domains: string[];
  reference: string;
}

// Curated judgment, like INHERITED_DOMAINS: which domains ACME runs through a
// single central program rather than per-system. Derived from the attestation
// records themselves (assemble.ts) so this list and what backs it can never
// drift apart — there is no second place that names a domain.
export function enterpriseInheritedDomains(attestations: readonly EnterpriseAttestation[]): string[] {
  return [...new Set(attestations.flatMap((a) => a.domains))];
}
