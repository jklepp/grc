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
    };
  } catch {
    return emptyRuntimeFacts();
  }
}

export function saveRuntimeFacts(facts: RuntimeFacts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
}

export function hasRuntimeFacts(facts: RuntimeFacts): boolean {
  return facts.systems.length > 0;
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
