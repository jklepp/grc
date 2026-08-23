import { COMPLIANCE_LABELS, COMPLIANCE_RATINGS, EVIDENCE_TYPES, PRISMA_LEVELS } from "../../engine";
import { ratingColor } from "./controlMeta";
import { C } from "../../theme";
import {
  CheckRow, ChoiceChip, Field, FieldGrid, InlineHint, Select, StatusPill, TextArea, TextInput, TX, Well,
} from "../../components/wizard/WizardUI";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { AssetId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { LevelRating } from "../../engine";

export interface LaneGrade {
  level: PrismaLevel;
  rating: ComplianceRating;
  derived: ComplianceRating;
}

// Everything the operator can say about one control, in one object. Lifted out
// of this component so the panel's footer — the single primary action — can
// read its readiness and commit it; the grader itself has no save button.
//
// `ratings` holds only EXPLICIT picks. A lane the operator never touched is
// absent, and reads its live derived rating instead of a value snapshotted at
// mount. That matters because the derived baseline moves while the form is
// being filled in (see the panel's preview derivation): seeding every lane up
// front would freeze the four documentation lanes against a stale number.
export interface LaneGraderState {
  ratings: Partial<Record<PrismaLevel, ComplianceRating>>;
  assessedBy: string;
  comment: string;
  // The Implemented lane's substantiation. Only meaningful before a control is
  // assessed — it is the fact that pulls the control into assessment scope, so
  // without it a PRISMA override on this control would be a silent no-op (see
  // engine/assessment.ts's unassessed early return) and the scope entry would
  // fail validateDerivations' "empty claim" check.
  evidencePending: boolean;
  source: string;
  evidenceType: EvidenceType;
  assetId: AssetId | "";
  reason: string;
}

// What each point on the scale concretely claims, shown live as the assessor
// picks Implemented. 0 has no evidence branch (it records a gap, not a claim),
// so its line explains the asset+reason it asks for instead.
const RATING_GUIDANCE: Record<ComplianceRating, string> = {
  0: "Nothing implements this control on this boundary. Records a remediation-ready gap against an asset, with the reason, instead of evidence.",
  25: "Exists somewhere, but ad hoc — not consistently applied across the assets that require it.",
  50: "Implemented on part of the boundary, or with material exceptions. A document or self-attestation alone tops out here.",
  75: "Operating on all in-scope assets with minor exceptions. Expects testing evidence — a screenshot or stronger, not just inquiry.",
  100: "Operating everywhere with no known exceptions, backed by current testing evidence covering every required asset.",
};

const RATINGS_HIGH_TO_LOW = [...COMPLIANCE_RATINGS].reverse();

export function initialLaneGraderState(args: {
  levels: Record<PrismaLevel, LevelRating> | null | undefined;
  assessed: boolean;
  assessedBy: string;
  assetOptions: AssetOption[];
}): LaneGraderState {
  const { levels, assessed, assessedBy, assetOptions } = args;
  // An assessed control may already carry overrides; those are explicit picks
  // and have to survive into the form so re-saving doesn't quietly drop them.
  const ratings: Partial<Record<PrismaLevel, ComplianceRating>> = {};
  if (assessed && levels) {
    PRISMA_LEVELS.forEach((level) => {
      if (levels[level].rating !== levels[level].derived) ratings[level] = levels[level].rating;
    });
  }
  return {
    ratings,
    assessedBy,
    comment: "",
    evidencePending: false,
    source: "",
    evidenceType: "Auditor examination",
    assetId: assetOptions[0]?.assetId ?? "",
    reason: "",
  };
}

// The rating a lane will actually be saved at: the explicit pick, or the live
// derived value for a lane nobody touched. Implemented before a first
// assessment has neither — that pick is the one thing this form requires.
export function effectiveRating(
  value: LaneGraderState,
  levels: Record<PrismaLevel, LevelRating>,
  level: PrismaLevel,
  assessed: boolean,
): ComplianceRating | null {
  const picked = value.ratings[level];
  if (picked != null) return picked;
  if (!assessed && level === "Implemented") return null;
  return levels[level].derived;
}

export function laneGrades(
  value: LaneGraderState,
  levels: Record<PrismaLevel, LevelRating>,
  assessed: boolean,
): LaneGrade[] {
  return PRISMA_LEVELS.map((level) => ({
    level,
    rating: effectiveRating(value, levels, level, assessed) ?? levels[level].derived,
    derived: levels[level].derived,
  }));
}

// One readiness rule, read by both the grader (inline field errors) and the
// panel footer, which names the blocker rather than sitting greyed out for a
// reason the operator has to go hunting for.
export function laneGraderBlocker(args: {
  value: LaneGraderState;
  assessed: boolean;
  isProgramScoped: boolean;
  assetOptions: AssetOption[];
}): string | null {
  const { value, assessed, isProgramScoped, assetOptions } = args;
  const implemented = value.ratings.Implemented;

  if (!assessed && !isProgramScoped && assetOptions.length === 0) {
    return "No registered asset requires this asset-scoped control. Update asset attributes or mark it Not In Scope.";
  }
  // No gate on the signature any more. It used to name where a missing one
  // would have to come from, because the operator had no box to fix it in; the
  // assessment is signed with whoever is signed in now, so there is no state in
  // which it can be absent. 5.1 is satisfied by construction rather than by a
  // check that could never pass its own failure.
  if (!assessed) {
    if (implemented == null) return "Pick where the Implemented lane stands.";
    if (implemented === 0) {
      if (!isProgramScoped && !value.assetId) return "Pick the asset this gap is recorded against.";
      if (!value.reason.trim()) return "Say why nothing implements this control on this boundary.";
    } else if (!value.evidencePending && !value.source.trim()) {
      return "Cite an evidence source, or tick “I don’t have evidence yet”.";
    }
  }
  // No separate gate for a changed lane. The comment below is required on
  // every assessment and is what every override is signed with, so demanding a
  // second box the moment a lane moved asked the same question twice — and the
  // writer already fell back to the comment when that box was empty.
  if (!value.comment.trim()) return "Say why this control stands where you have graded it.";
  return null;
}

interface PrismaLaneGraderProps {
  levels: Record<PrismaLevel, LevelRating>;
  assessed: boolean;
  isProgramScoped: boolean;
  assetOptions: AssetOption[];
  value: LaneGraderState;
  onChange: (patch: Partial<LaneGraderState>) => void;
  // Whether the operator has touched this form yet. An assessed control keeps
  // its existing answers, which would otherwise raise their own field errors
  // the instant the panel opens — nagging about a decision somebody made weeks
  // ago. A control with nothing on record states its requirements straight
  // away, because meeting them is the whole job.
  dirty: boolean;
}

// The one place a control gets scored, first assessment or hundredth. Five
// lanes, all live, all pickable — an operator grades everything they can see
// rather than attesting one lane in a separate box and finding the rest greyed
// out. The Implemented lane carries its own substantiation inline, because it
// is the only lane no fact in the graph can derive on its own: Policy and
// Procedure read the policy and SOP libraries, Measured and Managed read
// evidence prevalence and the review calendar, but whether a control is
// actually running on the assets that require it is a question only a human
// answers — and answering it is what puts the control in scope.
export function PrismaLaneGrader({
  levels, assessed, isProgramScoped, assetOptions, value, onChange, dirty,
}: PrismaLaneGraderProps) {
  const showErrors = !assessed || dirty;
  const implemented = value.ratings.Implemented;
  const needsImplementedPick = !assessed && implemented == null;
  const canDeclareMissing = isProgramScoped || assetOptions.length > 0;

  function pick(level: PrismaLevel, rating: ComplianceRating) {
    onChange({ ratings: { ...value.ratings, [level]: rating } });
  }

  return (
    <Well className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {PRISMA_LEVELS.map((level) => {
          const derived = levels[level].derived;
          const effective = effectiveRating(value, levels, level, assessed);
          const isImplemented = level === "Implemented";
          const awaiting = isImplemented && needsImplementedPick;
          // 0 on Implemented writes a not-implemented declaration against an
          // asset, so it needs somewhere to write it. Shown-but-disabled rather
          // than hidden, so the scale doesn't silently change shape per column.
          const zeroBlocked = isImplemented && !assessed && !canDeclareMissing;
          return (
            <div key={level} className="min-w-0">
              <div className={`${TX.label} mb-2 flex items-center gap-1.5`} style={{ color: awaiting ? C.accent : C.muted }}>
                <span className="truncate">{level}</span>
                {awaiting && <span style={{ color: C.amber }}>*</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                {RATINGS_HIGH_TO_LOW.map((rating) => (
                  <ChoiceChip
                    key={rating}
                    selected={effective === rating}
                    disabled={rating === 0 && zeroBlocked}
                    solid
                    tint={ratingColor(rating)}
                    ariaLabel={`${level} — ${rating}, ${COMPLIANCE_LABELS[rating]}`}
                    onClick={() => pick(level, rating)}
                    className="w-full"
                  >
                    {rating}
                  </ChoiceChip>
                ))}
              </div>
              <div className={`${TX.help} mt-2`} style={{ color: awaiting ? C.accent : C.muted }}>
                {awaiting
                  ? "Pick where this stands"
                  : `${COMPLIANCE_LABELS[effective ?? derived]}${effective !== derived ? ` · derived ${derived}` : " · derived"}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Implemented substantiation ----
          Attached to the grid rather than hosted in its own section: this is
          not a second way to score the control, it is the paperwork the one
          lane that puts it in scope has always needed. It appears once that
          lane has a rating — before that there is nothing to back, and the
          footer's blocker already names the one thing to do next (4.7). */}
      {!assessed && !needsImplementedPick && (
        <Well hollow className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={TX.itemTitle} style={{ color: C.ink }}>Implemented — what backs this rating</span>
            <span className="ml-auto">
              <StatusPill tone="info">
                {`${implemented} — ${COMPLIANCE_LABELS[implemented as ComplianceRating]}`}
              </StatusPill>
            </span>
          </div>
          <p className={TX.help} style={{ color: C.muted }}>{RATING_GUIDANCE[implemented as ComplianceRating]}</p>
          {implemented === 0 ? (
            <FieldGrid cols={2}>
              {!isProgramScoped && (
                <Field label="Asset">
                  <Select
                    value={value.assetId}
                    aria-label="Asset the gap is recorded against"
                    onChange={(e) => onChange({ assetId: e.target.value as AssetId })}
                  >
                    {assetOptions.map((a) => <option key={a.assetId} value={a.assetId}>{a.label}</option>)}
                  </Select>
                </Field>
              )}
              <Field
                label="Reason"
                span2={isProgramScoped}
                error={value.reason.trim() ? null : "Required — say why nothing implements this control here."}
              >
                <TextInput
                  value={value.reason}
                  onChange={(e) => onChange({ reason: e.target.value })}
                  placeholder="Why this control is not implemented on this boundary"
                />
              </Field>
            </FieldGrid>
          ) : (
            <div className="flex flex-col gap-3">
              <CheckRow
                checked={value.evidencePending}
                onChange={(checked) => onChange({ evidencePending: checked })}
                ariaLabel="I do not have evidence yet — attach it later"
                label={<>I don&rsquo;t have evidence yet — attach it later</>}
              />
              {value.evidencePending ? (
                <InlineHint tone="neutral">
                  Saved as a self-attestation — the weakest evidence grade, so the derived rating won&rsquo;t overstate what is on file. Replace it under Evidence by lane once you have the real source.
                </InlineHint>
              ) : (
                <FieldGrid cols={2}>
                  <Field label="Source" error={value.source.trim() ? null : "Required — name where the evidence came from."}>
                    <TextInput
                      value={value.source}
                      onChange={(e) => onChange({ source: e.target.value })}
                      placeholder="e.g. Screenshot of Okta MFA enforcement"
                    />
                  </Field>
                  <Field label="Evidence type">
                    <Select
                      value={value.evidenceType}
                      aria-label="Evidence type"
                      onChange={(e) => onChange({ evidenceType: selectedValue(EVIDENCE_TYPES, e.target.value, value.evidenceType) })}
                    >
                      {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                </FieldGrid>
              )}
            </div>
          )}
          {!isProgramScoped && assetOptions.length === 0 && (
            <InlineHint tone="warning">No registered asset requires this asset-scoped control. Update the asset attributes, or use Mark Not In Scope in Scope below.</InlineHint>
          )}
        </Well>
      )}

      <Field
        label="Comment"
        note="Signs the assessment, and every lane you have moved away from its derived rating."
        error={!showErrors || value.comment.trim() ? null : "Required to save an assessment."}
      >
        <TextArea
          value={value.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder="Why does this control stand where you have graded it?"
          style={{ minHeight: 76 }}
        />
      </Field>
    </Well>
  );
}
