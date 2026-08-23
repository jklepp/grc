// Display metadata for the system canvas: which icon and short label an asset
// kind draws with, and how a node's posture strip is coloured.
//
// Deliberately NOT in src/graph/nodes/assets.ts. That file is facts, and which
// glyph a vector database renders with is not one — applicability rules key on
// `kind`, and nothing about scoring should be reachable from a module whose job
// is picking icons.
import {
  Activity, AppWindow, Bot, Boxes, BrainCircuit, Building2, Clock, Database,
  DatabaseBackup, FileCode, Fingerprint, GitBranch, HardDrive, Key, KeyRound,
  Layers, LogOut, Network, Package, Plug, Radar, Scale, ScrollText, Server,
  ShieldAlert, ShieldCheck, ShieldHalf, Terminal, Upload, UserCog, Webhook,
  Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetKind } from "../../graph/nodes/assets";
import type { AssetRollup } from "../../engine";
import { DARK } from "../../theme";

export const ASSET_KIND_ICON: Record<AssetKind, LucideIcon> = {
  "api-gateway": Network,
  "compute-service": Server,
  "vector-db": Boxes,
  "object-storage": HardDrive,
  "backup-vault": DatabaseBackup,
  "relational-db": Database,
  "key-management": Key,
  "secrets-store": KeyRound,
  "saas-tenant": Building2,
  "saas-api": Plug,
  "service-account": Bot,
  "integration-endpoint": Webhook,
  "export-endpoint": Upload,
  "log-feed": ScrollText,
  waf: ShieldCheck,
  "model-gateway": Network,
  "policy-service": Scale,
  "tool-gateway": Wrench,
  cache: Zap,
  "egress-gateway": LogOut,
  iam: UserCog,
  telemetry: Activity,
  siem: Radar,
  "runtime-security": ShieldAlert,
  "cicd-pipeline": GitBranch,
  "artifact-registry": Package,
  "iac-pipeline": FileCode,
  "identity-provider": Fingerprint,
  "secure-web-gateway": ShieldHalf,
  "web-app": AppWindow,
  "model-endpoint": BrainCircuit,
  "message-queue": Layers,
  "batch-job": Clock,
  "admin-console": Terminal,
};

// Used for the legend and as a fallback sub-label. The card itself prefers
// `asset.type`, which is the curated display string ("AWS ECS Service
// (Fargate)") and says more than the normalised kind ever could.
export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  "api-gateway": "API gateway",
  "compute-service": "Compute service",
  "vector-db": "Vector database",
  "object-storage": "Object storage",
  "backup-vault": "Backup vault",
  "relational-db": "Relational database",
  "key-management": "Key management",
  "secrets-store": "Secrets store",
  "saas-tenant": "SaaS tenant",
  "saas-api": "SaaS API",
  "service-account": "Service account",
  "integration-endpoint": "Integration endpoint",
  "export-endpoint": "Export endpoint",
  "log-feed": "Log feed",
  waf: "Web application firewall",
  "model-gateway": "Model gateway",
  "policy-service": "Policy service",
  "tool-gateway": "Tool gateway",
  cache: "Cache",
  "egress-gateway": "Egress gateway",
  iam: "Identity & workload IAM",
  telemetry: "Telemetry",
  siem: "SIEM",
  "runtime-security": "Runtime security",
  "cicd-pipeline": "CI/CD pipeline",
  "artifact-registry": "Artifact registry",
  "iac-pipeline": "IaC pipeline",
  "identity-provider": "Identity provider",
  "secure-web-gateway": "Secure web gateway",
  "web-app": "Web app",
  "model-endpoint": "Model endpoint",
  "message-queue": "Message queue",
  "batch-job": "Batch job",
  "admin-console": "Admin console",
};

export type PostureState = "unscoped" | "finding" | "failing" | "thin" | "holding";

export interface Posture {
  state: PostureState;
  color: string;
  hatched: boolean;
  title: string;
}

// THIS IS NOT AN ASSET SCORE, AND THE DISTINCTION IS THE WHOLE POINT.
//
// An asset has no assurance number — the controls that apply to it are scored
// once, against its system (see the header of engine/rollups.ts). What this
// does is bucket counts the engine has already produced into five states so a
// card can carry a four-pixel strip. It reduces information; it never invents
// any. Nothing derived here feeds a rollup, and it must not start to: the
// moment something upstream reads it, it has become the per-asset score the
// model deliberately does not have.
//
// The "thin" state is hatched rather than a flat grey. In this palette grey is
// a legitimate status colour (DARK.na carries "not applicable"), so a flat grey
// strip would read as an answer. A hatch reads as an absence, which is what
// "nobody has looked at most of this" actually is.
export function assetPosture(asset: AssetRollup): Posture {
  if (asset.applicableControlCount === 0) {
    return {
      state: "unscoped",
      color: DARK.na,
      hatched: false,
      title: "No control applies to this asset, so there is nothing to show.",
    };
  }

  // remediationStatus is the finding's only lifecycle field (see
  // graph/nodes/findings.ts) — anything not Complete is still open.
  const severe = asset.findings.filter(
    (f) => f.remediationStatus !== "Complete" && (f.severity === "critical" || f.severity === "high")
  );
  if (severe.length > 0) {
    return {
      state: "finding",
      color: DARK.red,
      hatched: false,
      title: `${severe.length} open ${severe.length === 1 ? "finding" : "findings"} at high or critical severity.`,
    };
  }

  const notHolding = asset.notImplementedCount + asset.partialCount;
  if (notHolding > 0) {
    return {
      state: "failing",
      color: DARK.amber,
      hatched: false,
      title: `${notHolding} of ${asset.applicableControlCount} applicable controls not fully holding here.`,
    };
  }

  if (asset.undeterminedCount > 0 || asset.evidenceCoveragePct < 60) {
    return {
      state: "thin",
      color: DARK.muted,
      hatched: true,
      title:
        asset.undeterminedCount > 0
          ? `${asset.undeterminedCount} applicable controls have no evidence behind them.`
          : `Only ${asset.evidenceCoveragePct}% of the controls required here have been evidenced.`,
    };
  }

  return {
    state: "holding",
    color: DARK.green,
    hatched: false,
    title: `All ${asset.applicableControlCount} applicable controls held at last assessment.`,
  };
}

// The strip's background, as a CSS value. Hatched states get a 45-degree
// repeating gradient rather than a flat fill.
export function postureFill(posture: Posture): string {
  if (!posture.hatched) return posture.color;
  return `repeating-linear-gradient(45deg, ${posture.color} 0 3px, transparent 3px 7px)`;
}
