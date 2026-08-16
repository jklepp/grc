// ASSET —[implements]→ CONTROL
//
// The edge the whole model turns on: a control's definition is universal, its
// implementation is contextual. Least Privilege means one thing, and it works
// extremely well on the KMS key and badly on the RAG service. There is no
// honest single number for "how good is Least Privilege at ACME," which is why
// there is no score on the control itself anywhere in this app.
//
// HOW AN IMPLEMENTATION IS COMPOSED, AND WHY IT ISN'T ALL TYPED HERE
// -------------------------------------------------------------------
// Applicability resolves to ~176 asset/control pairs. Hand-authoring a maturity
// stage and an effectiveness percentage for each would mean inventing ~350
// numbers nobody assessed — the machine-generated posture this app has always
// refused to ship, just with more keystrokes. So an implementation is composed
// from inputs that already exist and were each arrived at deliberately:
//
//   maturity       defaults to the asset's category-level assessment for the
//                  category this control belongs to. That assessment is a real
//                  curated judgment (edges/categoryAssessments.ts); a control
//                  inherits it unless someone has recorded something different.
//   effectiveness  starts from the same assessment, then moves with what the
//                  evidence for THIS control on THIS asset actually returned.
//                  A failed cross-tenant test drags CLD-06 on the RAG service
//                  down without touching CLD-06 on the S3 bucket.
//   confidence     comes entirely from the evidence records (type, coverage,
//                  freshness). Nothing here asserts it.
//
// So the differentiation between two implementations of the same control comes
// from evidence, which is the only input that is actually per-pair. That is the
// intended reading: what separates a strong implementation from a weak one is
// what you can show about it.
//
// This file holds the four things that genuinely are per-implementation facts
// a person owns:
//
//   OWNERSHIP              who runs this control on this system, by default
//   OWNER_OVERRIDES         where a specific implementation's owner differs
//                          from that default, with why
//   IMPLEMENTATION_OVERRIDES  where the recorded maturity differs from the
//                          asset's category baseline, with the reason
//   NOT_IMPLEMENTED        where a required control has no implementation at
//                          all — declared, not inferred from absence, so that
//                          "we haven't built this" and "nobody has looked" stay
//                          distinguishable
//
// engine/implementation.ts does the composing.
import type { MaturityStage } from "../nodes/taxonomy";
import type { AssetId, ControlId, OrgId, FindingId } from "../ids";


export interface OwnerOverride {
  assetId: AssetId;
  controlId: ControlId;
  ownerIds: OrgId[];
  note: string;
}


export interface ImplementationOverride {
  assetId: AssetId;
  controlId: ControlId;
  maturityStage: MaturityStage;
  note: string;
  findingId?: FindingId;
}


export interface NotImplemented {
  assetId: AssetId;
  controlId: ControlId;
  reason: string;
}
