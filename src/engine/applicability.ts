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
import { isForcedApplicable, isForcedNotApplicable, pendingResolvedAsApplicable, reviewFor } from "./review";

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
    // hostingType is the only system-derived field here — kind, classification
    // and dataKinds are asset-owned and identical regardless of which system is
    // asking. A shared asset's hostingType resolves against its first-declared
    // system; fully system-aware resolution would mean threading systemId
    // through every resolveApplicability call site (~15), which is out of
    // scope unless a real shared asset needs divergent hostingType treatment.
    const system = graph.systemById[asset.systemIds[0]];
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
    identityTypes: string[];
    hasPrivilegedIdentity: boolean;
    adminPosture: string | null;
    apiPosture: string | null;
    egressPosture: string | null;
    hasThirdPartyIntegration: boolean;
    vendorCategories: string[];
    sdlcApplicable: boolean;
    networkExposure: string[];
    hasCustomerIdentities: boolean;
    usesAI: boolean;
    autonomousActions: boolean;
    regulatoryContext: string[];
  }

  function systemContext(systemId: SystemId): SystemContext {
    const system = graph.systemById[systemId];
    const assets = graph.assetsBySystem[systemId] ?? [];
    const assetIds = new Set(assets.map((a) => a.id));
    const declared = system.onboardingProfile;

    // Populations recorded against this boundary — see identity.ts. A
    // population with totalCount 0 is a recorded absence, not a presence.
    const identityPopulations = (graph.identityPopulationsBySystem[systemId] ?? []).filter((p) => p.totalCount > 0);
    const exposure = graph.exposurePostureBySystem[systemId];
    const vendors = graph.systemVendorsBySystem[systemId] ?? [];
    const sdlc = graph.sdlcPostureBySystem[systemId];

    // Measured identity/exposure/vendor/SDLC facts (identity.ts / exposure.ts
    // / vendors.ts / sdlc.ts, the System Register cockpit domains) are unioned
    // with what onboarding declared, never overridden by it — a declaration
    // stays true even if a sync hasn't recorded the matching measurement yet,
    // and a real measurement is never hidden by a stale or absent declaration.
    const identityTypes = [...new Set([...identityPopulations.map((p) => p.identityType), ...declared.identityTypes])];

    return {
      hostingType: system.hostingType,
      // Every data kind present anywhere in the boundary, which is what a
      // system-level obligation like PRI-05 actually attaches to.
      dataKinds: [...new Set(assets.flatMap((a) => classification.dataKindsForAsset(a.id)))],
      assetKinds: [...new Set(assets.map((a) => a.kind as string))],
      hasExternalActors: graph.actorAccess.some((a) => assetIds.has(a.assetId)),
      identityTypes,
      hasPrivilegedIdentity: identityTypes.includes("privileged") || identityTypes.includes("break-glass"),
      adminPosture: exposure?.adminPosture ?? null,
      apiPosture: exposure?.apiPosture ?? null,
      egressPosture: exposure?.egressPosture ?? null,
      hasThirdPartyIntegration: vendors.length > 0 || declared.hasThirdPartyIntegration,
      vendorCategories: [...new Set(vendors.map((v) => graph.vendorById[v.vendorId]?.category).filter(Boolean))] as string[],
      sdlcApplicable: (sdlc?.applicable ?? false) || declared.sdlcApplicable,
      networkExposure: declared.networkExposure,
      // dataProfile.subjects is a real, already-curated fact (see
      // DATA_SUBJECT_TYPES) — reused here rather than asking the same
      // question again under a new name.
      hasCustomerIdentities: system.dataProfile.subjects.includes("customers") || system.dataProfile.subjects.includes("end-users"),
      usesAI: system.aiUsage.usesAI,
      autonomousActions: system.aiUsage.autonomousActions,
      regulatoryContext: system.regulatoryContext,
    };
  }

  function programRuleMatches(rule: ProgramApplicabilityRule, context: SystemContext): boolean {
    const {
      hostingTypes, dataKinds, assetKinds, hasExternalActors,
      identityTypes, hasPrivilegedIdentity, adminPostures, apiPostures, egressPostures,
      hasThirdPartyIntegration, vendorCategories, sdlcApplicable, networkExposure, hasCustomerIdentities,
      usesAI, autonomousActions, regulatoryContext,
    } = rule.appliesWhen;
    if (hostingTypes && !hostingTypes.includes(context.hostingType)) return false;
    if (dataKinds && !dataKinds.some((k) => context.dataKinds.includes(k))) return false;
    if (assetKinds && !assetKinds.some((k) => context.assetKinds.includes(k))) return false;
    if (hasExternalActors !== undefined && hasExternalActors !== context.hasExternalActors) return false;
    if (identityTypes && !identityTypes.some((k) => context.identityTypes.includes(k))) return false;
    if (hasPrivilegedIdentity !== undefined && hasPrivilegedIdentity !== context.hasPrivilegedIdentity) return false;
    if (adminPostures && (context.adminPosture === null || !adminPostures.includes(context.adminPosture))) return false;
    if (apiPostures && (context.apiPosture === null || !apiPostures.includes(context.apiPosture))) return false;
    if (egressPostures && (context.egressPosture === null || !egressPostures.includes(context.egressPosture))) return false;
    if (hasThirdPartyIntegration !== undefined && hasThirdPartyIntegration !== context.hasThirdPartyIntegration) return false;
    if (vendorCategories && !vendorCategories.some((k) => context.vendorCategories.includes(k))) return false;
    if (sdlcApplicable !== undefined && sdlcApplicable !== context.sdlcApplicable) return false;
    if (networkExposure && !networkExposure.some((k) => context.networkExposure.includes(k))) return false;
    if (hasCustomerIdentities !== undefined && hasCustomerIdentities !== context.hasCustomerIdentities) return false;
    if (usesAI !== undefined && usesAI !== context.usesAI) return false;
    if (autonomousActions !== undefined && autonomousActions !== context.autonomousActions) return false;
    if (regulatoryContext && !regulatoryContext.some((k) => context.regulatoryContext.includes(k))) return false;
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
    //
    // A control listed in graph.pendingByPair matched here — that's exactly
    // what makes it pending rather than moot — but is held out of the
    // resolved applicable set until the open question behind it is answered.
    // pendingControlsForSystem (below) is where it's reported instead.
    return graph.inScopeControls.filter((c) => {
      if (isForcedApplicable(graph, systemId, c.id)) return true;
      // Checked before the pending/rule read below so an operator's explicit
      // out-of-scope call wins over a rule match the same way isForcedApplicable
      // already wins the opposite direction — an override is never silently
      // outvoted by the derivation it was written to override.
      if (isForcedNotApplicable(graph, systemId, c.id)) return false;
      const pending = graph.pendingByPair[`${systemId}::${c.id}`];
      if (pending) return pendingResolvedAsApplicable(graph, systemId, c.id);
      return byStandard.has(c.id);
    }) as Control[];
  }

  // Controls that matched a system's applicability the same way any other
  // does, but that a pendingApplicability record pulls out of the resolved
  // set above — reported with the open question, not silently dropped.
  function pendingControlsForSystem(systemId: SystemId): { control: Control; reason: string }[] {
    const system = graph.systemById[systemId];
    const byStandard = new Set(controlsForStandards(system.standards).map((c) => c.id));
    (graph.assetsBySystem[systemId] ?? []).forEach((asset) => {
      (requiredByAsset[asset.id] ?? []).forEach((id) => byStandard.add(id));
    });
    (programBySystem[systemId] ?? []).forEach((id) => byStandard.add(id));

    return graph.pendingApplicability
      .filter((p) => p.systemId === systemId && byStandard.has(p.controlId) && !reviewFor(graph, p.systemId, p.controlId))
      .map((p) => ({ control: graph.controlById[p.controlId] as Control, reason: p.reason }));
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
    pendingControlsForSystem,
    PROGRAM_CONTROL_IDS: programControlIds,
  };
}

export type ApplicabilityApi = ReturnType<typeof createApplicability>;
