// Derivation integrity. Everything graph/validate can't check without computing
// something. Throws.
//
// The checks here are the ones that catch a graph which is internally
// consistent but says something false: an exception excusing a control that
// wasn't required anyway, evidence collected against a pair the rules say
// doesn't apply, or a bottom-up classification rollup that no longer reproduces
// the answer a human reached top-down.
//
// This used to run at module load, as a side effect of importing the engine.
// It now takes an engine, because a check that needs derived values needs
// something to have derived them — and because a test that WANTS a broken graph
// (to assert these checks actually fire) has to be able to build one without
// the import itself exploding.
import { CLASS_ORDER } from "../theme";
import { CLASSIFICATION_TIERS, ASSURANCE_CATEGORIES } from "../graph/nodes/taxonomy";
import type { Engine } from "./create";

export function validateDerivations(engine: Engine): void {
  const { graph, classification, applicability, rollups } = engine;
  const problems: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };

  // The graph's tier vocabulary and the theme's display order are defined
  // separately — presentation shouldn't import the model. Them disagreeing,
  // though, means a tier renders with the wrong colour or none at all.
  check(
    CLASSIFICATION_TIERS.length === CLASS_ORDER.length && CLASSIFICATION_TIERS.every((t, i) => t === CLASS_ORDER[i]),
    `CLASSIFICATION_TIERS (${CLASSIFICATION_TIERS.join(", ")}) and theme.js CLASS_ORDER (${CLASS_ORDER.join(", ")}) have diverged`
  );

  // The rollup has to reproduce the curated answer. If a data type's sensitivity
  // or an asset's data edges change such that a system's tier would move, that is
  // either a real finding or a data-entry mistake, and both should stop the build
  // rather than silently reclassify a system.
  graph.systems.forEach((s) => {
    const derived = classification.systemClassification(s.id);
    const expected = graph.facts.expectedClassification[s.id];
    check(
      derived === expected,
      `system ${s.id}: classification derives to "${derived}" but expectedClassification says "${expected}". Either the data edges changed meaningfully (update the expectation deliberately) or an edge is wrong.`
    );
  });

  // An exception excuses a control from an asset. If no rule would have required
  // it, the exception is dead text that looks like a considered decision.
  graph.applicabilityExceptions.forEach((e) => {
    const withoutException = applicability.resolveApplicability(e.assetId, e.controlId);
    check(
      withoutException.reasons.length > 0,
      `applicability exception ${e.assetId}/${e.controlId}: no rule would have required this control here, so the exception excuses nothing — remove it or fix the rule it was written against`
    );
  });

  // An override or a not-implemented declaration against a control that doesn't
  // apply is a claim about something that isn't there.
  graph.implementationOverrides.forEach((o) => {
    check(
      applicability.resolveApplicability(o.assetId, o.controlId).required,
      `implementation override ${o.assetId}/${o.controlId}: this control is not required for this asset, so there is no implementation to override`
    );
  });

  graph.notImplemented.forEach((n) => {
    check(
      applicability.resolveApplicability(n.assetId, n.controlId).required,
      `not-implemented declaration ${n.assetId}/${n.controlId}: this control is not required for this asset — a control that doesn't apply is "not applicable", not "not implemented"`
    );
  });

  // A finding lives under an implementation, so the implementation has to exist
  // for something to be under.
  graph.findings.forEach((f) => {
    check(
      applicability.resolveApplicability(f.assetId, f.controlId).required,
      `finding ${f.id}: ${f.controlId} is not required for ${f.assetId}, so there is no implementation for this finding to live under`
    );
  });

  // Evidence collected against a pair the rules say doesn't apply means either
  // the rules are wrong or the evidence is filed against the wrong asset. Either
  // way the coverage figures derived from it would be wrong.
  graph.evidence.forEach((e) => {
    const keyControl = graph.keyControlById[e.controlId];
    if (!keyControl || keyControl.scope === "program") return;
    e.assetIds.forEach((assetId) => {
      const resolved = applicability.resolveApplicability(assetId, e.controlId);
      check(
        resolved.required,
        `evidence ${e.id}: collected for ${e.controlId} on ${assetId}, but applicability says it isn't required there (${resolved.notRequiredBecause})`
      );
    });
  });

  // A rollup that produced no number anywhere would render as a blank rather than
  // a gap, which is the failure mode this whole model exists to remove.
  rollups.assetRollups.forEach((a) => {
    check(Number.isFinite(a.overallAssurance), `asset ${a.id}: overall assurance did not resolve to a number`);
    check(Number.isFinite(a.criticality), `asset ${a.id}: criticality did not resolve to a number`);
    check(Boolean(a.classification), `asset ${a.id}: classification did not derive — check its data-type edges`);
    ASSURANCE_CATEGORIES.forEach((c) =>
      check(Number.isFinite(a.categoryScores[c]), `asset ${a.id}: category "${c}" did not resolve to a number`)
    );
  });

  // Every asset-scoped key control should apply somewhere. One that applies
  // nowhere is either mis-scoped or its rule conditions are too narrow, and
  // either way it is inert.
  graph.assetScopedControls.forEach((c) => {
    const applies = graph.assets.some((a) => applicability.resolveApplicability(a.id, c.id).required);
    check(
      applies,
      `key control ${c.id}: asset-scoped, but no asset in the register requires it — its rule conditions may be too narrow`
    );
  });

  if (problems.length > 0) {
    throw new Error(
      `Derivation integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
    );
  }
}
