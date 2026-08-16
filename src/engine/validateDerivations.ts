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
  const { graph, classification, applicability, assessment, rollups } = engine;
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

  // ---- The maturity ceiling's foundation ---------------------------------------
  // A key control no policy cites has no documented basis at all. That is the one
  // case the ceiling does NOT quietly cap: a capped score is a posture finding
  // and belongs in the UI, but a control ACME requires and has never written a
  // policy for is a hole in the library, and a hole is a build failure.
  graph.keyControls.forEach((c) => {
    const policies = graph.policiesByControl[c.id] ?? [];
    check(
      policies.length > 0,
      `key control ${c.id} (${c.friendlyName}): no policy in the library cites this control, so nothing documents why ACME requires it. Add it to a policy's controlIds or stop tracking it as a key control.`
    );
  });

  // Every program-scoped control must apply to at least one system, or it is
  // inert in exactly the way the asset-scoped check above catches one level down.
  graph.programScopedControls.forEach((c) => {
    const applies = graph.systems.some((s) => applicability.resolveProgramApplicability(s.id, c.id).required);
    check(
      applies,
      `program control ${c.id}: no system requires it — either its rule in program-applicability.yaml is too narrow, or it should not be a key control`
    );
  });

  // A program control with no rule at all would silently apply nowhere, which
  // reads identically to "deliberately scoped out" and is how the program layer
  // went missing from the hero score in the first place.
  graph.programScopedControls.forEach((c) => {
    check(
      (graph.rulesByProgramControl[c.id] ?? []).length > 0,
      `program control ${c.id}: no program applicability rule declares which systems it covers, so it would score nowhere`
    );
  });

  // A mechanism record against a pair that isn't required describes how ACME
  // satisfies something it doesn't have to.
  graph.implementationMechanisms.forEach((m) => {
    check(
      applicability.resolveApplicability(m.assetId, m.controlId).required,
      `implementation mechanism ${m.assetId}/${m.controlId}: this control is not required for this asset, so there is no implementation for the mechanism to describe`
    );
    // Naming the operator is the whole point of the vendor/shared distinction.
    check(
      m.responsibility === undefined || m.responsibility === "internal" || Boolean(m.provider),
      `implementation mechanism ${m.assetId}/${m.controlId}: responsibility is "${m.responsibility}" but no provider is named — an inherited control has to say who operates it`
    );
  });

  // Every program implementation should resolve to a real number, same as the
  // asset rollups above.
  rollups.systemRollups.forEach((s) => {
    s.programImplementations.forEach((i) => {
      check(
        Number.isFinite(i.rawScore),
        `program implementation ${i.id}: did not resolve to a number`
      );
    });
  });

  // ---- The PRISMA assessment scope, checked against the facts ------------------
  // This is the check that makes hand-listing the scope safe. The declared list
  // and the set of controls the facts can actually support have to be the same
  // set, and a discrepancy in either direction means something different:
  //
  //   declared, unsupported  an empty claim. The coverage figure counts a
  //                          control nobody assessed, which inflates the
  //                          denominator's numerator — the exact dishonesty
  //                          declaring a scope was supposed to prevent.
  //   supported, undeclared  either scope creep nobody signed off, or evidence
  //                          filed against the wrong system.
  //
  // "Supported" means any fact that could feed a level above Procedure: the two
  // documentation levels derive for every control in the library, so they can
  // never distinguish an assessed control from an unassessed one.
  graph.systems.forEach((system) => {
    const scope = graph.assessmentScopeBySystem[system.id];
    if (!scope) return; // graph/validate.ts already failed the build for this.

    const assetIds = new Set((graph.assetsBySystem[system.id] ?? []).map((a) => a.id));
    const supported = new Set<string>();
    graph.evidence.forEach((e) => {
      if (e.assetIds.length === 0 || e.assetIds.some((a) => assetIds.has(a))) supported.add(e.controlId);
    });
    graph.implementationMechanisms.forEach((m) => { if (assetIds.has(m.assetId)) supported.add(m.controlId); });
    graph.implementationOverrides.forEach((o) => { if (assetIds.has(o.assetId)) supported.add(o.controlId); });
    graph.notImplemented.forEach((n) => { if (assetIds.has(n.assetId)) supported.add(n.controlId); });
    graph.findings.forEach((f) => { if (assetIds.has(f.assetId)) supported.add(f.controlId); });

    const declared = new Set<string>(scope.controlIds);
    const applicable = new Set(applicability.applicableControlsForSystem(system.id).map((c) => c.id));

    declared.forEach((id) => {
      check(
        supported.has(id),
        `assessment scope for ${system.id} lists ${id}, but no evidence, mechanism, override, not-implemented declaration or finding on this system supports it — an assessed control with nothing behind it is an empty claim`
      );
      check(
        applicable.has(id),
        `assessment scope for ${system.id} lists ${id}, which is not applicable to that system — no standard it certifies against names it and no rule requires it there`
      );
    });

    supported.forEach((id) => {
      if (!applicable.has(id)) return; // reported by the evidence check above.
      check(
        declared.has(id),
        `${id} has implementation facts on ${system.id} but is not in its declared assessment scope — either the scope is out of date, or those facts are filed against the wrong system`
      );
    });
  });

  // ---- Every assessment resolves, and never to a misleading zero ---------------
  graph.systems.forEach((system) => {
    const all = assessment.assessmentsForSystem(system.id);
    const scored = all.filter((a) => a.assessed);

    all.forEach((a) => {
      if (a.assessed) {
        check(
          Number.isFinite(a.rawScore),
          `assessment ${a.id}: is in scope but did not resolve to a number`
        );
      } else {
        check(
          a.rawScore === null,
          `assessment ${a.id}: is not assessed but carries a score of ${a.rawScore} — an unassessed control must be null, never zero, or the gap reads as a failure`
        );
      }
    });

    // A system scoring nothing would report 0% coverage, which reads as a
    // catastrophic finding when it actually means the scope never loaded.
    check(scored.length > 0, `system ${system.id}: no control is assessed at all — coverage would report zero, which is a missing scope rather than a posture finding`);
    check(
      all.length === scored.length + all.filter((a) => !a.assessed).length,
      `system ${system.id}: coverage does not partition — applicable ${all.length} is not assessed ${scored.length} plus unassessed ${all.length - scored.length}`
    );
  });

  // ---- The system score itself -------------------------------------------------
  // The hero number on every page. It is now a weighted mean over categories
  // that each renormalize over whatever was assessed, and the failure mode of
  // that shape is silence: a category with nothing in it contributes no entry,
  // and if every category emptied the mean would be null rather than an error.
  rollups.systemRollups.forEach((s) => {
    check(
      Number.isFinite(s.rawAssurance),
      `system ${s.id}: assurance did not resolve to a number — every assurance category is empty, which means nothing was assessed`
    );
    check(
      s.coverage.applicable === s.coverage.assessed + s.coverage.unassessed,
      `system ${s.id}: coverage does not partition (${s.coverage.applicable} applicable vs ${s.coverage.assessed} assessed + ${s.coverage.unassessed} unassessed)`
    );
    ASSURANCE_CATEGORIES.forEach((c) => {
      const category = s.categories[c];
      check(
        category.raw === null || Number.isFinite(category.raw),
        `system ${s.id} category ${c}: resolved to ${category.raw}, which is neither a number nor an honest null`
      );
    });
  });

  check(
    Number.isFinite(rollups.enterprise.rawAssurance),
    `enterprise assurance did not resolve to a number`
  );

  // ---- Assessor overrides -----------------------------------------------------
  // Same contract as an applicability exception: an override that agrees with
  // the derivation is dead text that looks like a considered judgment.
  graph.prismaOverrides.forEach((o) => {
    const a = assessment.assessmentFor(o.systemId, o.controlId);
    check(
      a !== null && a.assessed,
      `PRISMA override ${o.systemId}/${o.controlId}: that control is not assessed on that system, so there is no derived rating to override`
    );
    if (a === null) return;
    check(
      a.levels[o.level].derived !== o.rating,
      `PRISMA override ${o.systemId}/${o.controlId} at ${o.level}: overrides to ${o.rating}, which is what the derivation already concluded — an override that changes nothing is a note, not a judgment`
    );
  });

  // A control a risk depends on that nobody assesses anywhere means the risk's
  // residual position rests on a control with no score behind it.
  graph.riskControls.forEach((rc) => {
    const assessedSomewhere = graph.systems.some((s) => assessment.assessmentFor(s.id, rc.controlId)?.assessed);
    check(
      assessedSomewhere,
      `risk ${rc.riskId} is held down by ${rc.controlId}, which no system assesses — the risk's residual position would rest on nothing`
    );
  });

  if (problems.length > 0) {
    throw new Error(
      `Derivation integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
    );
  }
}
