// Throwaway verification for runtimeMutations.evaluateControl(): proves a
// runtime-created system's control can move from provider-inherited-only to
// individually assessed with real evidence, through the same
// buildLiveEngine() pipeline the Add System wizard uses. Not wired into
// `npm run check` — run directly with `node scripts/check-evaluate-control.mjs`.
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  const { buildLiveEngine, emptyRuntimeFacts } = await server.ssrLoadModule("/src/engine/liveGraph.ts");
  const { evaluateControl } = await server.ssrLoadModule("/src/engine/runtimeMutations.ts");
  const { YAML_FACTS } = await server.ssrLoadModule("/src/graph/sources/yaml.ts");

  const systemId = "SYS-USR-1";
  const assetId = "AST-USR-1-1";

  const baseRuntime = {
    ...emptyRuntimeFacts(),
    systems: [{
      id: systemId, name: "Verification Harness System", env: "AWS (cloud)",
      hostingType: "cloud", provider: "AWS", standards: ["SOC 2"],
      mission: "Prove the evaluate-control pipeline.", boundary: "One asset, one control.",
      connections: [], roles: [], syncSource: "manual", lastSynced: "just now",
      oktaEnforced: "compliant", mfaEnforced: "compliant", internetFacing: false,
      availabilityTier: "tier-3-standard",
      criticalityFactors: {
        confidentiality: { score: 50, reason: "test" }, integrity: { score: 50, reason: "test" },
        availability: { score: 50, reason: "test" }, regulatory: { score: 50, reason: "test" },
        businessDependency: { score: 50, reason: "test" },
      },
      userCount: 1, regions: ["us-east-1"],
      dataProfile: { subjects: [], approxRecords: 0, retention: "n/a", residency: ["United States"] },
      aiUsage: { usesAI: false, autonomousActions: false },
      regulatoryContext: [],
      onboardingProfile: { identityTypes: [], networkExposure: ["private-internal"], hasThirdPartyIntegration: false, sdlcApplicable: false },
    }],
    assets: [{
      id: assetId, systemId, name: "Verification Asset", type: "server", kind: "compute-service",
      provider: "AWS", code: "A1",
      impactLevel: "moderate",
      inherentLikelihood: 1,
    }],
    assetDataTypes: [{ assetId, dataTypeId: "DT-001", role: "processes" }],
    assessmentScopes: [{
      systemId, engagement: "Verification harness", assessor: "Verification script",
      periodStart: "2026-01-01", periodEnd: "2027-01-01",
      samplingRationale: "Single-control smoke test for evaluateControl.",
      controlIds: [],
    }],
  };

  // Pass 1: find a key control genuinely applicable to this system to
  // evaluate — only key controls carry per-implementation evidence.
  const dryRun = buildLiveEngine(YAML_FACTS, baseRuntime);
  if (!dryRun.engine) throw new Error("baseline runtime facts failed to build: " + dryRun.problems.join("; "));
  const applicable = dryRun.engine.applicability.applicableControlsForSystem(systemId);
  const keyControlIds = new Set(dryRun.engine.graph.keyControls.map((c) => c.id));
  // Skip anything the enterprise-wide-scope correction (or provider
  // inheritance) already assessed — this is meant to prove evaluateControl
  // moves a genuinely untouched control, not one that started that way.
  // Also require it to be asset-scoped and actually required on our one
  // asset, so the evidence/mechanism we file against that asset is valid.
  const target = applicable
    .filter((c) => keyControlIds.has(c.id))
    .filter((c) => !dryRun.engine.assessment.assessmentFor(systemId, c.id)?.assessed)
    .find((c) => dryRun.engine.applicability.resolveApplicability(assetId, c.id).required);
  if (!target) throw new Error("no applicable, still-unassessed, asset-required key control found for this system");
  const before = dryRun.engine.assessment.assessmentFor(systemId, target.id);
  console.log(`before evaluateControl: ${target.id} assessed=${before?.assessed} basis=${before?.basis}`);

  // Pass 2: evaluate that control with a clean passing evidence record.
  const evaluated = evaluateControl(baseRuntime, {
    systemId, controlId: target.id,
    mechanism: { assetId, mechanism: "Verified by this harness", responsibility: "internal" },
    evidenceEntries: [{
      source: "Verification Harness", evidenceType: "Auditor examination",
      assetIds: [assetId], coveragePct: 100, result: "pass", independence: "external",
    }],
  });

  const result = buildLiveEngine(YAML_FACTS, evaluated);
  if (!result.engine) throw new Error("evaluated runtime facts failed to build: " + result.problems.join("; "));

  const after = result.engine.assessment.assessmentFor(systemId, target.id);
  console.log(`after evaluateControl: ${target.id} assessed=${after?.assessed} basis=${after?.basis} implemented=${after?.levels?.Implemented?.rating}`);

  if (!after?.assessed) throw new Error("expected the control to be assessed after evaluateControl");
  if (after.basis !== "measured") throw new Error(`expected basis "measured" (individually assessed, not inherited/unassessed), got "${after.basis}"`);
  if (after.levels.Implemented.rating <= 0) throw new Error(`expected a clean passing record to move Implemented above 0, got ${after.levels.Implemented.rating}`);

  console.log("\nPASS — evaluateControl() moves a runtime system's control from unassessed/inherited to individually assessed.");
  process.exitCode = 0;
} catch (err) {
  console.error("\nFAIL —", err.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
