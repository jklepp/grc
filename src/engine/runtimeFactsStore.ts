// Persistence for user-created systems/assets — the Add System wizard's save
// target. This is the only place in the app that writes to localStorage as a
// source of graph facts (as opposed to ProcedureLibrary's execution-log
// localStorage, which the engine never reads).
//
// A missing or malformed blob is always treated as "no runtime systems" rather
// than an error — a prototype's local storage getting cleared, corrupted, or
// written by an older version of this schema should degrade to the plain YAML
// dataset, never break the app on load.
import type { RuntimeFacts } from "./liveGraph";
import { emptyRuntimeFacts } from "./liveGraph";

const STORAGE_KEY = "grc-runtime-facts";

export function loadRuntimeFacts(): RuntimeFacts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRuntimeFacts();
    const parsed = JSON.parse(raw);
    const empty = emptyRuntimeFacts();
    return {
      systems: Array.isArray(parsed.systems) ? parsed.systems : empty.systems,
      assets: Array.isArray(parsed.assets) ? parsed.assets : empty.assets,
      assetDataTypes: Array.isArray(parsed.assetDataTypes) ? parsed.assetDataTypes : empty.assetDataTypes,
      assessmentScopes: Array.isArray(parsed.assessmentScopes) ? parsed.assessmentScopes : empty.assessmentScopes,
      expectedClassification:
        parsed.expectedClassification && typeof parsed.expectedClassification === "object"
          ? parsed.expectedClassification
          : empty.expectedClassification,
      implementationMechanisms: Array.isArray(parsed.implementationMechanisms) ? parsed.implementationMechanisms : empty.implementationMechanisms,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : empty.evidence,
      notImplemented: Array.isArray(parsed.notImplemented) ? parsed.notImplemented : empty.notImplemented,
      prismaOverrides: Array.isArray(parsed.prismaOverrides) ? parsed.prismaOverrides : empty.prismaOverrides,
      findings: Array.isArray(parsed.findings) ? parsed.findings : empty.findings,
    };
  } catch {
    return emptyRuntimeFacts();
  }
}

export function saveRuntimeFacts(facts: RuntimeFacts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
}

// True if there's anything at all for buildLiveEngine to merge in — not just
// a runtime-created system. evaluateControl/addPrismaOverride/addFinding all
// write facts against EXISTING (YAML-authored) systems with no accompanying
// system record, so checking systems.length alone would silently discard
// those facts on every reload the moment this only checked for new systems.
export function hasRuntimeFacts(facts: RuntimeFacts): boolean {
  return (
    facts.systems.length > 0 ||
    facts.implementationMechanisms.length > 0 ||
    facts.evidence.length > 0 ||
    facts.notImplemented.length > 0 ||
    facts.prismaOverrides.length > 0 ||
    facts.findings.length > 0
  );
}

// SYS-USR-<n> / AST-USR-<n>-<m>, distinct from the YAML source's SYS-0xx /
// AST-0xx-xx ids so a runtime id can never collide with an authored one.
export function nextSystemId(existing: RuntimeFacts): string {
  const n = existing.systems.length + 1;
  return `SYS-USR-${n}`;
}

export function nextAssetId(systemId: string, index: number): string {
  const suffix = systemId.replace("SYS-USR-", "");
  return `AST-USR-${suffix}-${index + 1}`;
}

// EVD-USR-<n>, distinct from the YAML source's EVD-<domain>-<n> ids, same
// reasoning as nextSystemId/nextAssetId above.
export function nextEvidenceId(existing: RuntimeFacts): string {
  const n = existing.evidence.length + 1;
  return `EVD-USR-${n}`;
}

// FND-USR-<n>, distinct from the YAML source's SEC-<n> ids, same reasoning as
// nextSystemId/nextAssetId above.
export function nextFindingId(existing: RuntimeFacts): string {
  const n = existing.findings.length + 1;
  return `FND-USR-${n}`;
}
