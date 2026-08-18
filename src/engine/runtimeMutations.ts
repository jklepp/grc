// Evaluating a control on a runtime-created system — the missing half of the
// Add System wizard's lifecycle. Creating a system + its assets already
// produces a real, scored system (provider-inheritance only, see
// AddSystemWizard.jsx); this is what lets a control move from
// provider-inherited-only to individually assessed with real evidence.
//
// Every function here is pure: it takes a RuntimeFacts object and returns a
// new one. Nothing here saves or reloads — callers dry-run the result through
// buildLiveEngine() exactly like AddSystemWizard.handleCreate() does, and
// only call saveRuntimeFacts() once that dry run is clean. That's what keeps
// this from becoming a second scoring path: the same validateGraph /
// validateDerivations that check every YAML-authored fact check these too.
//
// validateDerivations.ts's assessment-scope check is bidirectional (see its
// "declared, unsupported" / "supported, undeclared" comment) — a controlId in
// AssessmentScope.controlIds with nothing behind it fails as an "empty
// claim," and evidence/a mechanism/a not-implemented declaration with no
// matching scope entry fails as "scope creep." evaluateControl() below is the
// only function meant to be called directly for that reason: it always pairs
// the scope entry with at least one supporting fact in the same call.
import type { RuntimeFacts } from "./liveGraph";
import type { AssetId, ControlId, SystemId } from "../graph/ids";
import type { ImplementationMechanism, NotImplemented, Responsibility } from "../graph/edges/controlImplementations";
import type { RawEvidence } from "../graph/nodes/evidence";
import { nextEvidenceId } from "./runtimeFactsStore";

// Adds controlId to the given system's declared assessment scope, if it
// isn't there already. A no-op if the system has no runtime AssessmentScope
// (i.e. it isn't a runtime-created system) — there is nothing to append to.
export function addControlToScope(runtime: RuntimeFacts, systemId: SystemId, controlId: ControlId): RuntimeFacts {
  const scope = runtime.assessmentScopes.find((s) => s.systemId === systemId);
  if (!scope || scope.controlIds.includes(controlId)) return runtime;
  return {
    ...runtime,
    assessmentScopes: runtime.assessmentScopes.map((s) =>
      s.systemId === systemId ? { ...s, controlIds: [...s.controlIds, controlId] } : s
    ),
  };
}

// ImplementationMechanism carries no id — the (assetId, controlId) pair is
// the key (graph.mechanismByPair) — so this replaces any existing record for
// that pair rather than appending a duplicate.
export function upsertImplementationMechanism(
  runtime: RuntimeFacts,
  mechanism: ImplementationMechanism
): RuntimeFacts {
  const withoutExisting = runtime.implementationMechanisms.filter(
    (m) => !(m.assetId === mechanism.assetId && m.controlId === mechanism.controlId)
  );
  return { ...runtime, implementationMechanisms: [...withoutExisting, mechanism] };
}

export interface EvidenceDraft extends Omit<RawEvidence, "id" | "collectedAt"> {
  collectedAt?: string;
}

// Assigns an id and defaults collectedAt to today, then appends. Evidence
// records are never upserted-by-pair like a mechanism — a control can (and
// usually does) accumulate more than one evidence record over time.
export function addEvidence(runtime: RuntimeFacts, draft: EvidenceDraft): RuntimeFacts {
  const id = nextEvidenceId(runtime);
  const evidence: RawEvidence = {
    ...draft,
    id: id as RawEvidence["id"],
    collectedAt: draft.collectedAt ?? new Date().toISOString().slice(0, 10),
  };
  return { ...runtime, evidence: [...runtime.evidence, evidence] };
}

// Same replace-by-pair semantics as upsertImplementationMechanism — a pair is
// either declared not implemented or it isn't, never twice.
export function declareNotImplemented(runtime: RuntimeFacts, notImplemented: NotImplemented): RuntimeFacts {
  const withoutExisting = runtime.notImplemented.filter(
    (n) => !(n.assetId === notImplemented.assetId && n.controlId === notImplemented.controlId)
  );
  return { ...runtime, notImplemented: [...withoutExisting, notImplemented] };
}

export interface EvaluateControlInput {
  systemId: SystemId;
  controlId: ControlId;
  mechanism?: { assetId: AssetId; mechanism: string; responsibility?: Responsibility; provider?: string };
  evidenceEntries?: EvidenceDraft[];
  notImplemented?: { assetId: AssetId; reason: string };
}

// The one function a future "evaluate this control" UI actually calls.
// Composes the above so the control always lands in scope together with
// whatever supports that claim — never scope-only, which would fail
// validateDerivations's "empty claim" check the moment this is dry-run.
export function evaluateControl(runtime: RuntimeFacts, input: EvaluateControlInput): RuntimeFacts {
  const { systemId, controlId, mechanism, evidenceEntries, notImplemented } = input;
  if (!mechanism && !(evidenceEntries && evidenceEntries.length > 0) && !notImplemented) {
    throw new Error("evaluateControl: at least one of mechanism, evidenceEntries, or notImplemented is required");
  }

  let next = addControlToScope(runtime, systemId, controlId);

  if (mechanism) {
    next = upsertImplementationMechanism(next, {
      assetId: mechanism.assetId, controlId,
      responsibility: mechanism.responsibility, provider: mechanism.provider,
      mechanism: mechanism.mechanism,
    });
  }

  (evidenceEntries ?? []).forEach((draft) => {
    next = addEvidence(next, { ...draft, controlId });
  });

  if (notImplemented) {
    next = declareNotImplemented(next, { assetId: notImplemented.assetId, controlId, reason: notImplemented.reason });
  }

  return next;
}
