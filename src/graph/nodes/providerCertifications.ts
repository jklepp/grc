// The reports ACME stands on for the controls its providers run.
//
// INHERITED_DOMAINS (nodes/systems.ts) already says a SaaS system inherits
// eight SCF domains from its vendor and a cloud system two. Until now that
// claim moved nothing: it tinted the SSP control matrix and touched no score,
// so "AWS handles physical security" was an assertion with nothing behind it.
//
// Scoring an inherited control requires knowing what the inheritance actually
// rests on — which report, covering which domains, of what kind, and whether it
// is still current. That is what this is. A system whose hosting type claims to
// inherit a domain no certification covers fails the build, because inheritance
// without a report is exactly the plausible-number-naming-no-controls that
// nodes/systems.ts already rejected once.
import type { EvidenceType } from "./taxonomy";

// What the auditor actually did. A Type II report tests operating effectiveness
// across a period, which is the only form of vendor evidence that says anything
// at all about whether a control is being MEASURED; a Type I or point-in-time
// report observes a design at one moment and cannot support that claim however
// reputable the auditor.
export const CERTIFICATION_REPORT_TYPES = ["type-2", "type-1", "point-in-time"] as const;
export type CertificationReportType = (typeof CERTIFICATION_REPORT_TYPES)[number];

export interface ProviderCertification {
  id: string;
  // Must equal a System.provider. Validated, so renaming a provider breaks the
  // build rather than silently un-inheriting eight domains.
  provider: string;
  standard: string;
  reportType: CertificationReportType;
  // The grade of proof the report itself constitutes, on the same seven-value
  // scale every other piece of evidence uses. This is what holds an inherited
  // control below a self-verified one — not a separately-invented penalty, but
  // the same scale saying an auditor's examination proves less than a test ACME
  // can re-run itself.
  evidenceType: EvidenceType;
  issuedAt: string;
  validForDays: number;
  // The SCF domains this report's scope actually covers.
  domains: string[];
  reference: string;
}
