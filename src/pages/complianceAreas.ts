import { BookOpen, ClipboardCheck, Handshake, LayoutGrid } from "lucide-react";

// The control and audit side, split out of Governance: what ACME is held to,
// and the audits and outside obligations that test it.
export const COMPLIANCE_AREAS = [
  {
    id: "ccf",
    label: "Common Controls",
    shortLabel: "Common Controls",
    icon: LayoutGrid,
    description: "Browse the common control catalog, its domains, and the framework clauses each control satisfies.",
  },
  {
    id: "frameworks",
    label: "Compliance Frameworks",
    shortLabel: "Frameworks",
    icon: BookOpen,
    description: "Read each framework's requirements in its own words, and see which common controls map to each one.",
  },
  {
    id: "audits",
    label: "Audits",
    shortLabel: "Audits",
    icon: ClipboardCheck,
    description: "Run audits against the system of record — scope, auditor results, requests and populations — and publish what changed when each one closes.",
  },
  {
    id: "obligations",
    label: "External Obligations",
    shortLabel: "Obligations",
    icon: Handshake,
    description: "Track security and data terms owed to customers and other outside parties that are stricter than ACME's defaults, and whether evidence shows they're met.",
  },
] as const;

export type ComplianceAreaId = (typeof COMPLIANCE_AREAS)[number]["id"];

export function isComplianceArea(id: string | undefined): id is ComplianceAreaId {
  return COMPLIANCE_AREAS.some((area) => area.id === id);
}
