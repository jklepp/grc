// Vendor / dependency assurance for the System Register cockpit. Each
// system-vendor edge is resolved to its vendor and the vendor's most recent
// assurance record, optionally cross-referenced to the provider certification
// backing it.
import type { Graph } from "../graph/types";
import type { EngineContext } from "./context";
import { cadenceStatus } from "./assurance";
import type { SystemId } from "../graph/ids";

export function createVendors(graph: Graph, ctx: EngineContext) {
  function vendorsForSystem(systemId: SystemId) {
    const vendors = (graph.systemVendorsBySystem[systemId] ?? []).map((sv) => {
      const vendor = graph.vendorById[sv.vendorId];
      const assuranceRows = graph.vendorAssuranceByVendor[sv.vendorId] ?? [];
      const latestAssurance = assuranceRows.reduce<(typeof assuranceRows)[number] | null>(
        (latest, a) => (!latest || Date.parse(a.reassessedAt) > Date.parse(latest.reassessedAt) ? a : latest),
        null
      );
      const assurance = latestAssurance
        ? {
            ...latestAssurance,
            cadence: cadenceStatus(latestAssurance.reassessedAt, latestAssurance.cadenceDays, ctx.now),
            certification: latestAssurance.certificationId
              ? (graph.providerCertifications.find((c) => c.id === latestAssurance.certificationId) ?? null)
              : null,
          }
        : null;
      return { ...sv, vendor, assurance };
    });
    const anyOverdue = vendors.some((v) => !v.assurance || v.assurance.cadence.overdue);

    return { systemId, vendors, anyOverdue };
  }

  return { vendorsForSystem };
}

export type VendorsApi = ReturnType<typeof createVendors>;
