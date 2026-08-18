import { Cloud, Users, FileText, CreditCard, type LucideIcon } from "lucide-react";

export type DataSourceTier = "Critical" | "High" | "Medium" | "Low";

interface DataSourceBase {
  name: string;
  icon: LucideIcon;
  tier: DataSourceTier;
  role: string;
  dataDescription: string;
  entityLabel: string;
  entityCount: number | null;
  recordsLabel: string;
  records: number;
  countsTowardCustomerTotal: boolean;
}

export type DataSource = DataSourceBase & (
  | { hasVolumeData: true; liveDataTB: number; backupDataTB: number }
  | { hasVolumeData: false; liveDataTB?: undefined; backupDataTB?: undefined }
);

// Inferred data footprint for a mid-size B2B SaaS platform (ACME's own systems),
// modeled on the kind of cross-vendor exposure a company at this scale typically
// carries: recordings/IP in cloud storage, HR in an HRIS, finance internally, and
// payments through a processor. Not pulled from any live vendor API — these are
// estimates sized for this dashboard, not measured figures. Shared by the Data
// Footprint page and the Executive Dashboard so both report the same numbers.
export const DATA_SOURCES: DataSource[] = [
  {
    name: "AWS", icon: Cloud, tier: "Critical", role: "Core Platform",
    dataDescription: "Customer Records, Transcripts, Training Data & Proprietary Code",
    hasVolumeData: true,
    liveDataTB: 3500.0, backupDataTB: 1300.0,
    entityLabel: "Customers", entityCount: 4600,
    recordsLabel: "Records", records: 2900000000,
    countsTowardCustomerTotal: true,
  },
  {
    name: "Workday", icon: Users, tier: "High", role: "HR System",
    dataDescription: "HR & Employee Information",
    hasVolumeData: false,
    entityLabel: "Employees", entityCount: 1150,
    recordsLabel: "Records", records: 11000000,
    countsTowardCustomerTotal: true,
  },
  {
    name: "Azure", icon: FileText, tier: "Medium", role: "Corporate Systems",
    dataDescription: "Financial Documents, Contracts, HR PII Information",
    hasVolumeData: true,
    liveDataTB: 5.2, backupDataTB: 2.4,
    entityLabel: "Internal Use", entityCount: null,
    recordsLabel: "Records", records: 30000000,
    countsTowardCustomerTotal: false,
  },
  {
    name: "Stripe", icon: CreditCard, tier: "Low", role: "Payments",
    dataDescription: "Payment Processing",
    hasVolumeData: false,
    entityLabel: "Customers", entityCount: 4600,
    recordsLabel: "Transactions", records: 550000000,
    countsTowardCustomerTotal: false,
  },
];

// Card backgrounds for the vendor tiles — deliberately fixed (not theme-aware),
// same reasoning as a photo or brand color: these read the same regardless of
// light/dark mode since the tile owns its own background outright. `tier` is
// now just a color key for visual variety, not a risk label — deliberately no
// red/amber/orange/green anywhere on this page, since a stoplight palette reads
// to executives as "something is actively wrong" rather than a classification.
export function tierGradient(tier: DataSourceTier): string {
  if (tier === "Critical") return "linear-gradient(135deg, #2B3B7A 0%, #5B6FE0 100%)";
  if (tier === "High") return "linear-gradient(135deg, #1E4F73 0%, #3E8FC2 100%)";
  if (tier === "Medium") return "linear-gradient(135deg, #2E3A52 0%, #5C7A9C 100%)";
  return "linear-gradient(135deg, #3D2E7A 0%, #8B7FD4 100%)";
}

export function totalTB(s: DataSource): number { return (s.liveDataTB ?? 0) + (s.backupDataTB ?? 0); }
export function formatTB(tb: number): string {
  if (tb >= 1000) return `${(tb / 1000).toFixed(1)} PB`;
  return `${tb.toFixed(1)} TB`;
}
export function formatRecords(n: number): string {
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  return n.toLocaleString();
}

// Volume totals only cover sources we actually instrument (AWS, Azure) — Workday
// and Stripe are SaaS third parties we don't have accurate storage figures for.
const VOLUME_SOURCES = DATA_SOURCES.filter((s) => s.hasVolumeData);
export const TOTAL_LIVE_TB = VOLUME_SOURCES.reduce((a, s) => a + (s.liveDataTB ?? 0), 0);
export const TOTAL_BACKUP_TB = VOLUME_SOURCES.reduce((a, s) => a + (s.backupDataTB ?? 0), 0);
export const TOTAL_DATA_TB = TOTAL_LIVE_TB + TOTAL_BACKUP_TB;
export const TOTAL_RECORDS = DATA_SOURCES.reduce((a, s) => a + s.records, 0);
export const TOTAL_CUSTOMERS = DATA_SOURCES
  .filter((s) => s.countsTowardCustomerTotal)
  .reduce((a, s) => a + (s.entityCount || 0), 0);

// Workforce identity accounts across the company's core identity providers.
// These are NOT summed into one "total identities" figure — a person is
// commonly represented in more than one provider (e.g. an engineer has both
// an Okta and an AWS IAM identity), so adding them would double-count people.
// Privileged Identities is a subset cutting across all three, shown as a
// callout rather than a fourth bucket, for the same reason.
export const WORKFORCE_IDENTITIES = [
  { name: "Okta Identities", count: 1340 },
  { name: "Azure AD Identities", count: 1290 },
  { name: "AWS IAM Users", count: 86 },
];
export const PRIVILEGED_IDENTITIES = 58;

// Managed endpoints — additive, since each is a distinct device (no overlap
// like the identity providers above).
export const DEVICES = [
  { name: "Laptops", count: 1150 },
  { name: "Mobile Synced Devices", count: 640 },
];
export const TOTAL_DEVICES = DEVICES.reduce((a, d) => a + d.count, 0);

// Customer identities are end-user accounts within each customer org (e.g.
// individual seats/logins) — not 1:1 with the customer/company count, since a
// single customer account can represent dozens of individual logins.
export const CUSTOMER_ACCOUNT_COUNT = DATA_SOURCES.find((s) => s.name === "AWS")?.entityCount ?? 0;
export const AVG_IDENTITIES_PER_CUSTOMER = 40;
export const TOTAL_CUSTOMER_IDENTITIES = CUSTOMER_ACCOUNT_COUNT * AVG_IDENTITIES_PER_CUSTOMER;
