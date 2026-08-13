// Extends the Cyber Assurance model (assuranceModel.js) to every clickable
// node on the Enterprise Data Map, not just the handful with a real Asset
// Register entry.
//
// Two genuinely different cases, and the UI is expected to tell them apart:
//   - "registered" — the node's systemId has one or more real assets in
//     assets.js. Every number here is the real assetSummary() data, averaged
//     across that system's assets. Full criticality-factor reasons included.
//   - "estimated" — a pipeline hop (the API gateway, a backup copy, an
//     export drop) with no register entry. Criticality is a flat estimate
//     from its domain's classification tier, not five individually-judged
//     factors — inventing specific CIA reasons for 40+ synthetic nodes would
//     look precise without being true. Its 6 Assurance Category scores ARE
//     real, though: they're derived from the same 6 tracked-control statuses
//     already shown elsewhere on this node (see CONTROL_CATEGORY below), not
//     invented — and so is Compliance Coverage, reusing the same node.pct
//     already shown in the "Tracked Controls" section. Evidence Confidence is
//     the one metric left out for estimated nodes: there's no real
//     evidence-type signal (self-attestation vs. automated test vs. ...) for
//     a synthetic hop's status array, so showing a number would be inventing
//     precision that isn't there.
import { ASSET_SUMMARIES } from "./assets";
import {
  ASSURANCE_CATEGORIES,
  criticalityBand,
  overallControlAssurance,
  assuranceBand,
  impactFromCriticality,
  residualLikelihood,
  riskScore,
  riskBand,
} from "./assuranceModel";

// Same order as CONTROLS in systemRegister.js: [Encryption at Rest,
// Encryption in Transit, Access Logging & Review, Least-Privilege Access,
// DLP Monitoring, Retention & Disposal]. Configuration and Resilience have no
// directly tracked control, so they fall back to the node's overall pct.
const CONTROL_CATEGORY = ["Data Protection", "Data Protection", "Detection", "Identity & Access", "Data Protection", "Governance"];
const STATUS_SCORE = { compliant: 95, partial: 55, gap: 20 };

const ESTIMATED_CRITICALITY = { Restricted: 82, Confidential: 65, Internal: 50, Public: 35 };
const ESTIMATED_LIKELIHOOD = { Restricted: 4, Confidential: 3, Internal: 2, Public: 2 };

function estimatedCategoryScores(controlRows, overallPct) {
  const totals = {};
  ASSURANCE_CATEGORIES.forEach((c) => (totals[c] = { sum: 0, count: 0 }));
  controlRows.forEach((row, i) => {
    const category = CONTROL_CATEGORY[i];
    totals[category].sum += STATUS_SCORE[row.status];
    totals[category].count += 1;
  });
  const scores = {};
  ASSURANCE_CATEGORIES.forEach((c) => {
    scores[c] = totals[c].count > 0 ? Math.round(totals[c].sum / totals[c].count) : Math.round(overallPct);
  });
  return scores;
}

function estimatedAssurance(node) {
  const classification = node.classification || "Confidential";
  const criticality = ESTIMATED_CRITICALITY[classification] ?? 60;
  const categoryScores = estimatedCategoryScores(node.controlRows, node.pct);
  const overallAssurance = overallControlAssurance(categoryScores);
  const impact = impactFromCriticality(criticality);
  const inherentLikelihood = ESTIMATED_LIKELIHOOD[classification] ?? 3;
  const inherentScore = riskScore(inherentLikelihood, impact);
  const residualLikely = residualLikelihood(inherentLikelihood, overallAssurance);
  const residualScore = riskScore(residualLikely, impact);
  return {
    source: "estimated",
    criticality,
    criticalityBand: criticalityBand(criticality),
    criticalityFactors: null,
    categoryScores,
    overallAssurance,
    assuranceBand: assuranceBand(overallAssurance),
    evidenceConfidence: null,
    // Same underlying signal as the "Tracked Controls" section below (a
    // pipeline node has no framework crosswalk to compute a real required-
    // controls ratio from), just re-expressed as the same percentage shape
    // registered assets report so the two are comparable at a glance.
    complianceCoveragePct: Math.round(node.pct),
    impact,
    inherentRisk: { likelihood: inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    residualRisk: { likelihood: residualLikely, impact, score: residualScore, band: riskBand(residualScore) },
  };
}

function registeredAssurance(system) {
  const assets = ASSET_SUMMARIES.filter((a) => a.systemId === system.id);
  if (assets.length === 0) return null;

  const avg = (key) => Math.round(assets.reduce((a, x) => a + x[key], 0) / assets.length);
  const categoryScores = {};
  ASSURANCE_CATEGORIES.forEach((c) => {
    categoryScores[c] = Math.round(assets.reduce((a, x) => a + x.categoryScores[c], 0) / assets.length);
  });

  const criticality = avg("criticality");
  const overallAssurance = avg("overallAssurance");
  const evidenceConfidence = avg("evidenceConfidence");
  const complianceCoveragePct = avg("complianceCoveragePct");
  const impact = impactFromCriticality(criticality);
  const inherentLikelihood = Math.round((assets.reduce((a, x) => a + x.inherentLikelihood, 0) / assets.length) * 10) / 10;
  const inherentScore = riskScore(inherentLikelihood, impact);
  const residualLikely = residualLikelihood(inherentLikelihood, overallAssurance);
  const residualScore = riskScore(residualLikely, impact);

  return {
    source: "registered",
    assets,
    criticality,
    criticalityBand: criticalityBand(criticality),
    // Only show a single factor-by-factor breakdown when there's exactly one
    // asset behind this node — averaging five reasoned factors across
    // multiple assets would blur which reason belongs to which number.
    criticalityFactors: assets.length === 1 ? assets[0].criticalityFactors : null,
    categoryScores,
    overallAssurance,
    assuranceBand: assuranceBand(overallAssurance),
    evidenceConfidence,
    complianceCoveragePct,
    impact,
    inherentRisk: { likelihood: inherentLikelihood, impact, score: inherentScore, band: riskBand(inherentScore) },
    residualRisk: { likelihood: residualLikely, impact, score: residualScore, band: riskBand(residualScore) },
  };
}

// node is the object returned by dataMap.js's getNode() — needs .system,
// .classification, .controlRows, and .pct.
export function getNodeAssurance(node) {
  if (node.system) {
    const registered = registeredAssurance(node.system);
    if (registered) return registered;
  }
  return estimatedAssurance(node);
}
