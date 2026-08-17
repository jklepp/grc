// Vendor / dependency assurance — a broader register than
// providerCertifications.ts, layered beside it rather than replacing it.
//
// providerCertifications.ts stays exactly as it is: it backs the
// INHERITED_DOMAINS claim in nodes/systems.ts and is load-bearing scoring
// infrastructure (engine/assessment.ts's inherited-control ceiling,
// validateDerivations.ts's inheritance check). This file is the answer to a
// different, broader question a cockpit needs — "what does ACME depend on,
// and is its assurance current" — for every vendor a system relies on, not
// only the hosting provider whose certification feeds a scored domain.
// VendorAssurance.certificationId optionally cross-references a
// ProviderCertification row so the UI can show what backs a vendor's
// assurance without merging the two types.
import type { SystemId, DataTypeId } from "../ids";

export const VENDOR_CATEGORIES = ["cloud-infrastructure", "saas", "subprocessor", "professional-services"] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_CRITICALITY = ["critical", "high", "moderate", "low"] as const;
export type VendorCriticalityLevel = (typeof VENDOR_CRITICALITY)[number];

export interface Vendor {
  id: string;
  // Must equal a System.provider for at least one system, or ACME's own
  // provider registrations would silently disagree about who a vendor is.
  name: string;
  category: VendorCategory;
}

export interface VendorAssurance {
  id: string;
  vendorId: string;
  reassessedAt: string;
  cadenceDays: number;
  sharedResponsibilityReviewed: boolean;
  certificationId?: string;
}

export interface SystemVendor {
  systemId: SystemId;
  vendorId: string;
  dependency: string;
  dataAccessible: DataTypeId[];
  criticality: VendorCriticalityLevel;
}
