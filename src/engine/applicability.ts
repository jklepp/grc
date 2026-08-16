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
// Neither was answerable before. A control expectation came from the control
// profile at a tier, which sets a maturity/evidence floor per assurance
// category — enough to say a Restricted asset needs Managed-grade Data
// Protection, never which controls that means.
import type { Graph } from "../graph/types";
import type { Asset } from "../graph/nodes/assets";
import type { Control } from "../graph/nodes/controls";
import type { KeyControl } from "../graph/nodes/keyControls";
import type {
  ApplicabilityRule, ApplicabilityException, ApplicabilityCondition,
} from "../graph/edges/applicabilityRules";
import type { ProgramApplicabilityRule } from "../graph/edges/controlImplementations";
import { tierRank } from "../graph/nodes/taxonomy";
import type { ClassificationApi } from "./classification";
import type { AssetId, ControlId, SystemId } from "../graph/ids";

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

export interface ApplicabilityResolution {
  assetId: AssetId;
  controlId: ControlId;
  required: boolean;
  exception: ApplicabilityException | null;
  reasons: { rationale: string; source: string }[];
  notRequiredBecause: string | null;
  context: ApplicabilityContext;
  classificationDrivenBy?: unknown[];
}

export function createApplicability(graph: Graph, classification: ClassificationApi) {
  function contextFor(assetId: AssetId): ApplicabilityContext {
    const asset = graph.assetById[assetId];
    const system = graph.systemById[asset.systemId];
    return {
      kind: asset.kind,
      hostingType: system.hostingType,
      classification: classification.assetClassification(assetId),
      dataKinds: classification.dataKindsForAsset(assetId),
    };
  }

  // Everything known about whether one control applies to one asset — the shape
  // the Graph Explorer renders and the engine branches on.
  function resolveApplicability(assetId: AssetId, controlId: ControlId): ApplicabilityResolution {
    const context = contextFor(assetId);
    const matched = (graph.rulesByControl[controlId] ?? []).filter((r) => ruleMatches(r, context));
    const exception = graph.exceptionByPair[`${assetId}::${controlId}`] ?? null;
    const classificationDetail = classification.assetClassificationDetail(assetId);

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

  // Precomputed, because every rollup walks this and the rule set is static
  // within one graph.
  const requiredByAsset: Record<AssetId, ControlId[]> = {};
  graph.assets.forEach((asset) => {
    requiredByAsset[asset.id] = graph.assetScopedControls
      .filter((c) => resolveApplicability(asset.id, c.id).required)
      .map((c) => c.id);
  });

  function requiredControlsForAsset(assetId: AssetId): KeyControl[] {
    return (requiredByAsset[assetId] || []).map((id) => graph.keyControlById[id]);
  }

  function requiredControlsForAssetInCategory(assetId: AssetId, category: string): KeyControl[] {
    return requiredControlsForAsset(assetId).filter((c) => c.category === category);
  }

  function assetsRequiringControl(controlId: ControlId): Asset[] {
    return graph.assets.filter((a) => (requiredByAsset[a.id] || []).includes(controlId)) as Asset[];
  }

  // Every asset/control pair a rule excused, with its stated reason. Surfaced on
  // the Graph Explorer so exceptions are reviewable as a set rather than only
  // discoverable one control at a time.
  function allExceptions(): ApplicabilityResolution[] {
    return graph.assets.flatMap((asset) =>
      graph.assetScopedControls.map((c) => resolveApplicability(asset.id, c.id)).filter((r) => r.exception)
    );
  }

  const programControlIds: ControlId[] = graph.programScopedControls.map((c) => c.id);

  // ---- Program controls, one level up ------------------------------------------
  // The same machinery, asking about a system instead of an asset. It exists
  // because "all systems inherit the program controls" turned out to be false on
  // inspection: four of the seven hold everywhere, three depend on what a system
  // contains, and blanket-inheriting AAT-01 would assert AI governance coverage
  // for the Workday boundary, which holds no AI asset.
  //
  // Deriving it rather than ticking a box means the answer is re-checked on every
  // build and carries its reason with it — the same property that makes asset
  // applicability auditable.
  interface SystemContext {
    hostingType: string;
    dataKinds: string[];
    assetKinds: string[];
    hasExternalActors: boolean;
  }

  function systemContext(systemId: SystemId): SystemContext {
    const assets = graph.assetsBySystem[systemId] ?? [];
    const assetIds = new Set(assets.map((a) => a.id));
    return {
      hostingType: graph.systemById[systemId].hostingType,
      // Every data kind present anywhere in the boundary, which is what a
      // system-level obligation like PRI-05 actually attaches to.
      dataKinds: [...new Set(assets.flatMap((a) => classification.dataKindsForAsset(a.id)))],
      assetKinds: [...new Set(assets.map((a) => a.kind as string))],
      hasExternalActors: graph.actorAccess.some((a) => assetIds.has(a.assetId)),
    };
  }

  function programRuleMatches(rule: ProgramApplicabilityRule, context: SystemContext): boolean {
    const { hostingTypes, dataKinds, assetKinds, hasExternalActors } = rule.appliesWhen;
    if (hostingTypes && !hostingTypes.includes(context.hostingType)) return false;
    if (dataKinds && !dataKinds.some((k) => context.dataKinds.includes(k))) return false;
    if (assetKinds && !assetKinds.some((k) => context.assetKinds.includes(k))) return false;
    if (hasExternalActors !== undefined && hasExternalActors !== context.hasExternalActors) return false;
    return true;
  }

  function resolveProgramApplicability(systemId: SystemId, controlId: ControlId) {
    const context = systemContext(systemId);
    const matched = (graph.rulesByProgramControl[controlId] ?? []).filter((r) => programRuleMatches(r, context));
    const exception = graph.programExceptionByPair[`${systemId}::${controlId}`] ?? null;

    if (matched.length === 0) {
      return {
        systemId, controlId, required: false, exception: null, reasons: [],
        notRequiredBecause: `No program applicability rule for ${controlId} matches ${systemId} — this control's premise does not hold in that boundary.`,
      };
    }
    if (exception) {
      return {
        systemId, controlId, required: false, exception,
        reasons: matched.map((r) => ({ rationale: r.rationale, source: "Program applicability" })),
        notRequiredBecause: exception.reason,
      };
    }
    return {
      systemId, controlId, required: true, exception: null,
      reasons: matched.map((r) => ({ rationale: r.rationale, source: "Program applicability" })),
      notRequiredBecause: null,
    };
  }

  const programBySystem: Record<string, ControlId[]> = {};
  graph.systems.forEach((s) => {
    programBySystem[s.id] = graph.programScopedControls
      .filter((c) => resolveProgramApplicability(s.id, c.id).required)
      .map((c) => c.id);
  });

  function programControlsForSystem(systemId: SystemId): KeyControl[] {
    return (programBySystem[systemId] ?? []).map((id) => graph.keyControlById[id]);
  }

  // ---- What applies to a system at all -----------------------------------------
  // Moved here from compliance.ts, because "which controls apply" is this
  // module's question and compliance is about how they are reported.
  function controlsForStandards(standards: string[]): Control[] {
    return graph.inScopeControls.filter((c) => c.frameworks.some((f) => standards.includes(f.standard))) as Control[];
  }

  // The denominator for a system's assessment coverage, and the row set of its
  // control matrix.
  //
  // WHY THIS IS A UNION, AND NOT JUST THE FRAMEWORK SET
  // ----------------------------------------------------
  // Two notions of applicability already existed and quietly disagreed. The
  // framework one asks "does a standard we certify against name this control";
  // the rule one asks "does this control's premise hold for something in this
  // boundary." Taking only the first drops real obligations: CLD-06
  // (multi-tenant isolation) maps to ISO 27001, ISO 27018 and PCI DSS but not
  // SOC 2, so for the SOC-2-only Workday boundary the framework reading says it
  // does not apply — while an applicability rule requires it on every SaaS
  // tenant and EV-7010 is a real tenant-isolation attestation filed against two
  // Workday assets.
  //
  // Under the framework reading alone that evidence would be scored nowhere and
  // reported nowhere: ACME would hold proof about a control the app claims is
  // out of scope. A control is applicable if EITHER reading says so, and the
  // standards a system certifies against then decide which report it appears
  // in, not whether it is assessed.
  function applicableControlsForSystem(systemId: SystemId): Control[] {
    const system = graph.systemById[systemId];
    const byStandard = new Set(controlsForStandards(system.standards).map((c) => c.id));

    (graph.assetsBySystem[systemId] ?? []).forEach((asset) => {
      (requiredByAsset[asset.id] ?? []).forEach((id) => byStandard.add(id));
    });
    (programBySystem[systemId] ?? []).forEach((id) => byStandard.add(id));

    // Filtered back through inScopeControls so a rule cannot drag in a control
    // that cites no framework clause at all — that one is out of scope
    // everywhere, and validate.ts already refuses to let a scope name it.
    return graph.inScopeControls.filter((c) => byStandard.has(c.id)) as Control[];
  }

  // Built once. Every coverage figure and every control matrix walks this.
  const applicableBySystem: Record<string, Control[]> = {};
  graph.systems.forEach((s) => (applicableBySystem[s.id] = applicableControlsForSystem(s.id)));

  return {
    resolveApplicability,
    requiredControlsForAsset,
    requiredControlsForAssetInCategory,
    assetsRequiringControl,
    allExceptions,
    resolveProgramApplicability,
    programControlsForSystem,
    controlsForStandards,
    applicableControlsForSystem: (systemId: SystemId) => applicableBySystem[systemId] ?? [],
    PROGRAM_CONTROL_IDS: programControlIds,
  };
}

export type ApplicabilityApi = ReturnType<typeof createApplicability>;
