// Assembled from each domain's own "most recent event" timestamp — there is
// no cross-cutting changelog/audit-log fact in the graph yet, so this is a
// pure sort-by-date presentation composition, not a new scoring concept.
// A future `changeLogForSystem(systemId)` engine function could replace the
// body of this function with zero change to the component that renders it.
export function recentActivityForSystem({ identity, resilience, secTests, ir, vendors }) {
  const events = [];

  if (identity.review) {
    events.push({
      ts: identity.review.reviewedAt,
      domain: "Identity",
      label: "Access review completed",
      detail: `${identity.review.reviewedCount} of ${identity.review.totalCount} identities`,
    });
  }

  if (resilience.lastDrTest) {
    events.push({
      ts: resilience.lastDrTest.conductedAt,
      domain: "Resilience",
      label: "Recovery test conducted",
      detail: resilience.targetsMetLastTest ? "Targets met" : "Targets not met",
    });
  }

  ["penetration-test", "red-team"].forEach((type) => {
    const latest = secTests.latestByType[type];
    if (!latest) return;
    events.push({
      ts: latest.completedAt,
      domain: "Security Testing",
      label: `${type === "penetration-test" ? "Penetration test" : "Red team exercise"} completed`,
      detail: latest.vendor,
    });
  });

  if (ir.lastTabletop) {
    events.push({
      ts: ir.lastTabletop.conductedAt,
      domain: "Incident Response",
      label: "IR tabletop conducted",
      detail: ir.lastTabletop.scenario,
    });
  }

  if (ir.lastIncident) {
    events.push({
      ts: ir.lastIncident.occurredAt,
      domain: "Incident Response",
      label: "Production incident",
      detail: `Severity: ${ir.lastIncident.severity}`,
    });
  }

  vendors.vendors.forEach((v) => {
    if (!v.assurance?.reassessedAt) return;
    events.push({
      ts: v.assurance.reassessedAt,
      domain: "Vendor Assurance",
      label: `${v.vendor?.name ?? v.vendorId} reassessed`,
      detail: v.dependency,
    });
  });

  return events
    .filter((e) => e.ts)
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    .slice(0, 8);
}
