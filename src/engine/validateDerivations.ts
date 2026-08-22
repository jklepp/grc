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
import { isForcedNotApplicable } from "./review";
import type { Engine } from "./create";
import type { ControlId, SystemId } from "../graph/ids";

export function validateDerivations(engine: Engine, options: { throwOnFailure?: boolean } = {}): string[] {
  const { throwOnFailure = true } = options;
  const { graph, classification, applicability, assessment, rollups, findings, compliance } = engine;
  const problems: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };

  // DORMANT ASSESSMENTS
  //
  // A control can be assessed and later scoped out — an assessor grades it,
  // then someone works out its premise never held on this boundary and records
  // an exclusion with a reason and a name. Three checks below would otherwise
  // read that history as corruption: the override has no derived rating left to
  // sit on, the declared scope lists something no longer applicable, and every
  // asset that used to be sampled now looks like a short population.
  //
  // None of that is wrong, it is just over. The facts stay on record — deleting
  // an assessment to satisfy a validator would destroy exactly the audit trail
  // this tool exists to keep, and for a control assessed in the authored YAML
  // there is nothing a runtime write could delete anyway. So a pair a human has
  // scoped out is exempt from the checks that assume it is still live.
  //
  // Deliberately narrow: only a CONFIRMED not-applicable review counts (the
  // same record isForcedApplicable reads the other way round), so this cannot
  // be reached by a rule, a derivation, or an unanswered pending question. A
  // person has to have said so.
  const scopedOutByReview = (systemId: SystemId, controlId: ControlId) =>
    isForcedNotApplicable(graph, systemId, controlId);

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

  // A pending applicability entry only means something if the control would
  // otherwise have resolved applicable — the same failure mode as the
  // exception check above, one state over. A control no framework or rule
  // ever matched isn't "undecided," it's just not applicable, and marking it
  // pending would misreport it as a live open question.
  graph.pendingApplicability.forEach((p) => {
    const stillPending = applicability
      .pendingControlsForSystem(p.systemId)
      .some((x) => x.control.id === p.controlId);
    const reviewed = Boolean(graph.controlReviewByKey[`${p.systemId}::${p.controlId}`]);
    check(
      stillPending || reviewed,
      `pendingApplicability ${p.systemId}/${p.controlId}: no framework or applicability rule ever matches this control on this system, so there is no open question to be pending about — remove it or fix what it was meant to gate`
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
  // for something to be under. A program-scoped control has no per-asset
  // implementation to check against (see assessment.ts's populationFor) —
  // resolveApplicability(assetId, controlId) never returns true for one no
  // matter which asset is named, because program controls are matched at the
  // system level instead (resolveProgramApplicability). The asset on a
  // program-scoped finding is only where it's tracked, so it's checked against
  // the same system-level test evidence and PRISMA scoring already use.
  graph.findings.forEach((f) => {
    const keyControl = graph.keyControlById[f.controlId];
    if (keyControl?.scope === "program") {
      check(
        applicability.resolveProgramApplicability(f.systemId, f.controlId).required,
        `finding ${f.id}: ${f.controlId} is program-scoped and not required for ${f.systemId}, so there is no assessment for this finding to live under`
      );
      return;
    }
    // With an asset named, the strict per-asset test the check has always run:
    // the gap is claimed to sit on that implementation, so that implementation
    // has to be required there.
    if (f.assetId) {
      check(
        applicability.resolveApplicability(f.assetId, f.controlId).required,
        `finding ${f.id}: ${f.controlId} is not required for ${f.assetId}, so there is no implementation for this finding to live under`
      );
      return;
    }
    // Without one, the same question asked at the boundary: is this control
    // required anywhere in the system the finding names? A gap against a control
    // that does not apply here is still a claim about something that is not
    // there, whether or not an asset was singled out.
    check(
      (graph.assetsBySystem[f.systemId] ?? []).some((a) => applicability.resolveApplicability(a.id, f.controlId).required),
      `finding ${f.id}: ${f.controlId} is not required on any asset in ${f.systemId}, so there is no implementation for this finding to live under`
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

  // An asset no longer has an assurance score or category scores to check —
  // it is a diagnostic now, not a scoring subject. What still has to resolve is
  // everything derived from the asset's OWN facts: FIPS 199 impact level (the
  // inventory tag) and classification (which still decides which controls apply).
  // The system's FIPS 199 overall impact, not the asset's, is the enterprise-hop weight.
  rollups.assetRollups.forEach((a) => {
    check(Boolean(a.impactLevelBand?.label), `asset ${a.id}: impactLevel did not resolve to a FIPS 199 band`);
    check(Boolean(a.classification), `asset ${a.id}: classification did not derive — check its data-type edges`);
    // Every control that is BOTH required here and inside this system's
    // assessment scope has to produce an instance. If it does not, the
    // Implemented level's denominator is silently short and the control scores
    // higher than the estate justifies.
    //
    // Scoped is the necessary qualifier. A control the rules require on this
    // asset but that nobody assessed correctly has no instance — that is the
    // applicable-but-unassessed state the whole model is built to express, and
    // an earlier version of this check flagged it as an error, which would have
    // forced every applicable control into scope and destroyed the distinction.
    // Checked per system a shared asset sits in: an instance sampled under
    // System A doesn't prove System B (which the same asset also belongs to)
    // sampled it too — each system's assessment scope is independent.
    applicability.requiredControlsForAsset(a.id).forEach((c) => {
      a.systemIds.forEach((sid) => {
        if (!graph.assessedPairs.has(`${sid}::${c.id}`)) return;
        if (scopedOutByReview(sid, c.id)) return; // dormant — see DORMANT ASSESSMENTS
        check(
          a.controls.some((i) => i.systemId === sid && i.controlId === c.id),
          `asset ${a.id}: ${c.id} is required here and is in ${sid}'s assessment scope, but no instance sampled this asset under that system — the control's Implemented rating would be computed over a short population`
        );
      });
    });
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
      // A record tagged to a documentation lane (Policy/Procedure/Measured/
      // Managed) substantiates that lane's claim but cannot feed a level
      // above Procedure on its own — a policy PDF on file is not an
      // assessment, so it doesn't make a control "supported" here.
      if ((e.prismaLevel ?? "Implemented") !== "Implemented") return;
      if (e.assetIds.length === 0 || e.assetIds.some((a) => assetIds.has(a))) supported.add(e.controlId);
    });
    graph.implementationMechanisms.forEach((m) => { if (assetIds.has(m.assetId)) supported.add(m.controlId); });
    graph.implementationOverrides.forEach((o) => { if (assetIds.has(o.assetId)) supported.add(o.controlId); });
    graph.notImplemented.forEach((n) => { if (assetIds.has(n.assetId)) supported.add(n.controlId); });
    graph.findings.forEach((f) => { if (f.systemId === system.id) supported.add(f.controlId); });

    const declared = new Set<string>(scope.controlIds);
    const applicable = new Set(applicability.applicableControlsForSystem(system.id).map((c) => c.id));

    declared.forEach((id) => {
      // A scoped-out pair keeps its scope entry as history — see DORMANT
      // ASSESSMENTS. It is neither an empty claim nor scope creep; it is a
      // control this system did assess, before deciding it does not apply.
      if (scopedOutByReview(system.id, id as ControlId)) return;
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

  graph.controlReviews.forEach((r) => {
    if (r.stance === "confirm" && r.bucket === "not-applicable") {
      const applicable = applicability.applicableControlsForSystem(r.systemId).some((c) => c.id === r.controlId);
      check(
        !applicable,
        `controlReview ${r.systemId}/${r.controlId}: confirmed not-applicable, but the control still resolves applicable — reject the derived exclusion instead of confirming it`
      );
    }
    if (r.stance === "confirm" && r.bucket === "vendor-inherited") {
      check(
        compliance.responsibilityForControl(r.systemId, r.controlId) === "vendor",
        `controlReview ${r.systemId}/${r.controlId}: confirmed external inheritance, but responsibility is not vendor`
      );
    }
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
      Boolean(s.overallImpactBand?.label),
      `system ${s.id}: security category did not resolve to a FIPS 199 overall impact`
    );
    check(
      Number.isFinite(s.impactWeight) && s.impactWeight > 0,
      `system ${s.id}: FIPS 199 overall impact did not resolve to a rollup weight`
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
    // The override outlives the assessment it was made against once the pair is
    // scoped out — see DORMANT ASSESSMENTS.
    if (scopedOutByReview(o.systemId, o.controlId)) return;
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

  // ---- Cockpit exercises can't report unresolved findings that nothing
  // tracks toward remediation --------------------------------------------------
  // An exercise record's own counts (criticalFindingCount, issuesIdentified...)
  // are a summary; the POA&M is where remediation actually gets tracked. If
  // the summary says something is still open, at least one Finding sourced
  // from that exercise type has to exist on the same system, or the number is
  // an unbacked claim exactly like every other "plausible number naming no
  // controls" this model exists to reject.
  graph.systems.forEach((system) => {
    const latestByType: Record<string, (typeof graph.securityTests)[number]> = {};
    (graph.securityTestsBySystem[system.id] ?? []).forEach((t) => {
      const existing = latestByType[t.type];
      if (!existing || Date.parse(t.completedAt) > Date.parse(existing.completedAt)) latestByType[t.type] = t;
    });
    Object.values(latestByType).forEach((t) => {
      if (t.criticalFindingCount === 0 && t.highFindingCount === 0) return;
      const open = findings.openFindingsForSource(system.id, t.type as "penetration-test" | "red-team")
        .filter((f) => f.severity === "critical" || f.severity === "high");
      check(
        open.length > 0,
        `security test ${t.id}: reports ${t.criticalFindingCount} critical / ${t.highFindingCount} high findings, but no open critical/high finding on ${system.id} carries source "${t.type}" — nothing tracks it toward remediation`
      );
    });

    const drTests = graph.drTestsBySystem[system.id] ?? [];
    const latestDrTest = drTests.reduce<(typeof drTests)[number] | null>(
      (latest, t) => (!latest || Date.parse(t.conductedAt) > Date.parse(latest.conductedAt) ? t : latest), null
    );
    if (latestDrTest && !latestDrTest.restoreSuccessful) {
      const open = findings.openFindingsForSource(system.id, "dr-test");
      check(
        open.length > 0,
        `DR test ${latestDrTest.id}: restoreSuccessful is false, but no open finding on ${system.id} carries source "dr-test"`
      );
    }

    // System-scoped tabletops only — a "program" scope exercise has no single
    // system to check an open finding against.
    const systemTabletops = (graph.tabletopExercisesByScope[system.id] ?? []);
    const latestTabletop = systemTabletops.reduce<(typeof systemTabletops)[number] | null>(
      (latest, t) => (!latest || Date.parse(t.conductedAt) > Date.parse(latest.conductedAt) ? t : latest), null
    );
    if (latestTabletop && latestTabletop.issuesIdentified > 0) {
      const open = findings.openFindingsForSource(system.id, "ir-tabletop");
      check(
        open.length > 0,
        `tabletop exercise ${latestTabletop.id}: identified ${latestTabletop.issuesIdentified} issues, but no open finding on ${system.id} carries source "ir-tabletop"`
      );
    }
  });

  if (problems.length > 0 && throwOnFailure) {
    throw new Error(
      `Derivation integrity check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`
    );
  }
  return problems;
}
