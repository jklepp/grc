// Resolves the declarative rules into a per-asset answer, with its reasoning.
//
// The two questions this exists to answer, in the auditor's own words:
//
//   "Why does CRY-05 apply to the customer data bucket?"
//     -> required, because it holds data at rest at Confidential tier or above
//        (rule: asset type + classification), and the tier is Restricted,
//        driven by Customer PII and Customer Documents.
//
//   "Why doesn't CFG-02 apply to the KMS key?"
//     -> a rule matched, and it was excepted: AWS KMS exposes no configurable
//        hardening surface, so its baseline is inherited from the provider.
//
// Neither was answerable before. A control expectation came from
// CONTROL_PROFILES[tier], which sets a maturity/evidence floor per assurance
// category — enough to say a Restricted asset needs Managed-grade Data
// Protection, never which controls that means.
import { ASSETS, ASSET_BY_ID, type Asset } from "../graph/nodes/assets";
import { SYSTEM_BY_ID } from "../graph/nodes/systems";
import { ASSET_SCOPED_CONTROLS, PROGRAM_SCOPED_CONTROLS, KEY_CONTROL_BY_ID, type KeyControl } from "../graph/nodes/keyControls";
import { APPLICABILITY_RULES, exceptionFor, type ApplicabilityRule, type ApplicabilityException, type ApplicabilityCondition } from "../graph/edges/applicabilityRules";
import { tierRank } from "../graph/nodes/taxonomy";
import { assetClassification, assetClassificationDetail, dataKindsForAsset } from "./classification";

interface ApplicabilityContext {
  kind: string;
  hostingType: string;
  classification: string | null;
  dataKinds: string[];
}

// A rule matches when every condition it names holds. An unnamed condition is
// not a wildcard failure — it simply isn't part of that rule's test, which is
// how a rule with `requiredWhen: {}` reads as "applies to everything."
function ruleMatches(rule: ApplicabilityRule, context: ApplicabilityContext): boolean {
  const { assetKinds, minClassification, dataKinds, hostingTypes }: ApplicabilityCondition = rule.requiredWhen;
  if (assetKinds && !assetKinds.includes(context.kind as Asset["kind"])) return false;
  if (hostingTypes && !hostingTypes.includes(context.hostingType as (typeof hostingTypes)[number])) return false;
  if (minClassification && context.classification !== null && tierRank(context.classification) < tierRank(minClassification)) return false;
  if (dataKinds && !dataKinds.some((k) => context.dataKinds.includes(k))) return false;
  return true;
}

function contextFor(assetId: string): ApplicabilityContext {
  const asset = ASSET_BY_ID[assetId];
  const system = SYSTEM_BY_ID[asset.systemId];
  return {
    kind: asset.kind,
    hostingType: system.hostingType,
    classification: assetClassification(assetId),
    dataKinds: dataKindsForAsset(assetId),
  };
}

export interface ApplicabilityResolution {
  assetId: string;
  controlId: string;
  required: boolean;
  exception: ApplicabilityException | null;
  reasons: { rationale: string; source: string }[];
  notRequiredBecause: string | null;
  context: ApplicabilityContext;
  classificationDrivenBy?: unknown[];
}

// Everything known about whether one control applies to one asset — the shape
// the Graph Explorer renders and the engine branches on.
export function resolveApplicability(assetId: string, controlId: string): ApplicabilityResolution {
  const context = contextFor(assetId);
  const matched = APPLICABILITY_RULES.filter((r) => r.controlId === controlId && ruleMatches(r, context));
  const exception = exceptionFor(assetId, controlId);
  const classificationDetail = assetClassificationDetail(assetId);

  if (matched.length === 0) {
    return {
      assetId,
      controlId,
      required: false,
      exception: null,
      reasons: [],
      // Why NOT — the half that was never expressible before.
      notRequiredBecause: `No applicability rule for ${controlId} matches this asset (type ${context.kind}, ${context.classification} tier, ${context.hostingType} hosted).`,
      context,
    };
  }

  if (exception) {
    return {
      assetId,
      controlId,
      required: false,
      exception,
      reasons: matched.map((r) => ({ rationale: r.rationale, source: r.source })),
      notRequiredBecause: exception.reason,
      context,
    };
  }

  return {
    assetId,
    controlId,
    required: true,
    exception: null,
    reasons: matched.map((r) => ({ rationale: r.rationale, source: r.source })),
    classificationDrivenBy: classificationDetail?.drivenBy ?? [],
    notRequiredBecause: null,
    context,
  };
}

// Precomputed, because every rollup walks this and the rule set is static.
const REQUIRED_BY_ASSET: Record<string, string[]> = {};
ASSETS.forEach((asset) => {
  REQUIRED_BY_ASSET[asset.id] = ASSET_SCOPED_CONTROLS.filter((c) => resolveApplicability(asset.id, c.id).required).map((c) => c.id);
});

export function requiredControlsForAsset(assetId: string): KeyControl[] {
  return (REQUIRED_BY_ASSET[assetId] || []).map((id) => KEY_CONTROL_BY_ID[id]);
}

export function requiredControlsForAssetInCategory(assetId: string, category: string): KeyControl[] {
  return requiredControlsForAsset(assetId).filter((c) => c.category === category);
}

export function assetsRequiringControl(controlId: string): Asset[] {
  return ASSETS.filter((a) => (REQUIRED_BY_ASSET[a.id] || []).includes(controlId));
}

// Every asset/control pair a rule excused, with its stated reason. Surfaced on
// the Graph Explorer so exceptions are reviewable as a set rather than only
// discoverable one control at a time.
export function allExceptions(): ApplicabilityResolution[] {
  return ASSETS.flatMap((asset) =>
    ASSET_SCOPED_CONTROLS.map((c) => resolveApplicability(asset.id, c.id)).filter((r) => r.exception)
  );
}

export const PROGRAM_CONTROL_IDS: string[] = PROGRAM_SCOPED_CONTROLS.map((c) => c.id);
