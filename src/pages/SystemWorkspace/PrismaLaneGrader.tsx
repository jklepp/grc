import type { ReactNode } from "react";
import { AlertTriangle, Link2, Plus, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { COMPLIANCE_LABELS, COMPLIANCE_RATINGS, EVIDENCE_TYPES, PRISMA_LEVELS } from "../../engine";
import { ratingColor } from "./controlMeta";
import { C } from "../../theme";
import {
  Button, CheckRow, ChoiceChip, DisclosureButton, EmptyState, Field, FieldGrid, InlineHint, Select, StatusPill,
  TextArea, TextInput, TX, Well,
} from "../../components/wizard/WizardUI";
import { selectedValue } from "./formHelpers";
import type { AssetOption } from "./formHelpers";
import type { AssetId } from "../../graph/ids";
import type { ComplianceRating, EvidenceType, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { LevelRating, ScoredEvidence } from "../../engine";

export interface LaneGrade {
  level: PrismaLevel;
  rating: ComplianceRating;
  derived: ComplianceRating;
}

/** The library record a lane's derived rating was read off, where one exists. */
export interface LaneDerivedDoc {
  code: string;
  title: string;
  detail: string | null;
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

// What a lane with nothing on file and nothing to derive from is missing. Names
// the artifact rather than saying "None attached" twice: the pill beside it
// already carries the standing, so the line's job is to say what would fix it.
const LANE_EMPTY_HINT: Record<PrismaLevel, string> = {
  Policy: "Nothing attached — the approved policy that puts this control in writing.",
  Procedure: "Nothing attached — the procedure that carries this control at step level.",
  Implemented: "Nothing attached — this is the lane the engine samples, so it wants the test output, the configuration observation, the screenshot.",
  Measured: "Nothing attached — the metric export or dashboard that shows this control is being measured.",
  Managed: "Nothing attached — the review minutes, or the governance calendar entry that closes the loop.",
};

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

// What one lane's collapsed line says about its substantiation: the governing
// record when there is one, the newest attachment when there are attachments,
// and what is missing when there is neither. One reading, so the pill and the
// line beside it cannot disagree.
function laneStanding(
  level: PrismaLevel,
  records: ScoredEvidence[],
  derivedFrom: LaneDerivedDoc | undefined,
): { pill: string; tone: "success" | "neutral" | "warning"; icon: LucideIcon; color: string; line: string } {
  if (records.length > 0) {
    const [first] = records;
    const age = first.ageDays === 0 ? "collected today" : `collected ${first.ageDays}d ago`;
    return {
      pill: `${records.length} attached`,
      tone: "success",
      icon: Link2,
      color: C.green,
      line: [
        `${first.source} · ${first.result} · coverage ${first.coveragePct}% · ${age}${first.stale ? " · stale" : ""}`,
        records.length > 1 ? `+${records.length - 1} more` : null,
      ].filter(Boolean).join("  ·  "),
    };
  }
  // A lane with a derived source is substantiated even with nothing attached,
  // so it must not wear the same warning as a lane nothing backs at all. The
  // pill says only that it derives — the record it derives from is named in
  // full on the line directly below, and a pill long enough to carry the code
  // does not fit the standing column beside a 454px scale.
  if (derivedFrom) {
    return {
      pill: "Derived",
      tone: "neutral",
      icon: ScrollText,
      color: C.muted,
      line: `${derivedFrom.code} · ${derivedFrom.title}${derivedFrom.detail ? ` — ${derivedFrom.detail}` : ""}`,
    };
  }
  return { pill: "None attached", tone: "warning", icon: AlertTriangle, color: C.amber, line: LANE_EMPTY_HINT[level] };
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
  /** Records already attached to each lane, newest-first as the engine returns them. */
  laneEvidence: Record<PrismaLevel, ScoredEvidence[]>;
  /** The library record a lane's rating derives from, for the two lanes that read libraries. */
  laneDerivedDoc: Partial<Record<PrismaLevel, LaneDerivedDoc>>;
  /** Which lane has its evidence open. One at a time, so the five rows stay comparable. */
  openLane: PrismaLevel | null;
  onToggleLane: (level: PrismaLevel) => void;
  onAttach: (level: PrismaLevel) => void;
  /**
   * The open lane's evidence: the governing record, the cards, and the attach
   * or edit form. Supplied by the panel because those all read and stage
   * against its draft engine; the row owns only the chrome around them.
   */
  renderLaneEvidence: (level: PrismaLevel) => ReactNode;
  /** True while the panel is staging an attach or edit inside the open lane. */
  laneFormOpen: boolean;
}

// The one place a control gets scored, first assessment or hundredth. Five
// rows, one per lane — each one grades that lane AND carries what backs it, so
// a rating and its evidence are never two sections apart. The scales sit on
// the same column lines in every row, so the five picked chips read down the
// section as the control's ladder profile.
//
// The Implemented lane carries its own substantiation inline, because it is
// the only lane no fact in the graph can derive on its own: Policy and
// Procedure read the policy and SOP libraries, Measured and Managed read
// evidence prevalence and the review calendar, but whether a control is
// actually running on the assets that require it is a question only a human
// answers — and answering it is what puts the control in scope.
export function PrismaLaneGrader({
  levels, assessed, isProgramScoped, assetOptions, value, onChange, dirty,
  laneEvidence, laneDerivedDoc, openLane, onToggleLane, onAttach, renderLaneEvidence, laneFormOpen,
}: PrismaLaneGraderProps) {
  const showErrors = !assessed || dirty;
  const implemented = value.ratings.Implemented;
  const needsImplementedPick = !assessed && implemented == null;
  const canDeclareMissing = isProgramScoped || assetOptions.length > 0;

  function pick(level: PrismaLevel, rating: ComplianceRating) {
    onChange({ ratings: { ...value.ratings, [level]: rating } });
  }

  return (
    <div className="flex flex-col gap-3">
      {PRISMA_LEVELS.map((level, idx) => {
        const derived = levels[level].derived;
        const effective = effectiveRating(value, levels, level, assessed);
        const isImplemented = level === "Implemented";
        const awaiting = isImplemented && needsImplementedPick;
        // 0 on Implemented writes a not-implemented declaration against an
        // asset, so it needs somewhere to write it. Shown-but-disabled rather
        // than hidden, so the scale doesn't silently change shape per row.
        const zeroBlocked = isImplemented && !assessed && !canDeclareMissing;
        // The Implemented substantiation is the paperwork the one lane that
        // puts this control in scope has always needed — not a second way to
        // score it. It rides the row rather than the collapsible evidence
        // below, because the footer's blocker asks for it and a required field
        // must not be reachable only by expanding something.
        const substantiating = isImplemented && !assessed && !needsImplementedPick;
        const open = openLane === level;
        const standing = laneStanding(level, laneEvidence[level], laneDerivedDoc[level]);
        return (
          <Well key={level} className="flex flex-col gap-3">
            {/* The scale column is FIXED, not fluid: an auto-sized standing
                column would let a long pill ("Derived from POL-03") squeeze
                the chips on one row and not the next, and the five rows only
                read as one ladder profile while every chip sits on the same
                column line. 454px is the five chips at their 86px cap plus
                the four 6px gaps. */}
            <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[168px_454px_minmax(0,1fr)] xl:gap-4 xl:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`${TX.code} w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0`}
                    style={{ border: `1.5px solid ${awaiting ? C.accent : C.border}`, color: awaiting ? C.accent : C.muted }}
                  >
                    {idx + 1}
                  </span>
                  <span className={TX.itemTitle} style={{ color: awaiting ? C.accent : C.ink }}>{level}</span>
                  {awaiting && <span style={{ color: C.amber }}>*</span>}
                </div>
                <div
                  className={`${TX.help} mt-1.5`}
                  style={{ color: awaiting ? C.accent : effective !== derived ? C.amber : C.muted }}
                >
                  {awaiting
                    ? "Pick where this stands"
                    : `${COMPLIANCE_LABELS[effective ?? derived]}${effective !== derived ? ` · overridden from ${derived}` : " · derived"}`}
                </div>
              </div>

              <div className="flex gap-1.5 min-w-0">
                {COMPLIANCE_RATINGS.map((rating) => (
                  <ChoiceChip
                    key={rating}
                    selected={effective === rating}
                    disabled={rating === 0 && zeroBlocked}
                    solid
                    tint={ratingColor(rating)}
                    ariaLabel={`${level} — ${rating}, ${COMPLIANCE_LABELS[rating]}`}
                    onClick={() => pick(level, rating)}
                    className="flex-1 max-w-[86px]"
                  >
                    {rating}
                  </ChoiceChip>
                ))}
              </div>

              {/* Wraps rather than overflows: the scale column is fixed, so
                  anything too wide for what is left has to fall to a second
                  line instead of sliding back under the last chip. */}
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <StatusPill tone={standing.tone}>{standing.pill}</StatusPill>
                <Button size="sm" icon={Plus} onClick={() => onAttach(level)}>Attach</Button>
              </div>
            </div>

            {/* ---- Implemented substantiation ---- */}
            {substantiating && (
              <Well hollow className="flex flex-col gap-3.5 xl:ml-[184px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={TX.itemTitle} style={{ color: C.ink }}>What backs this rating</span>
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
                        Saved as a self-attestation — the weakest evidence grade, so the derived rating won&rsquo;t overstate what is on file. Replace it from this row once you have the real source.
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

            {/* The lane's substantiation in one line, and the way into it. Sits
                under the scale rather than beside it so the five lines start on
                the same column and can be read as a block. */}
            <div className="xl:pl-[184px]">
              <DisclosureButton
                open={open}
                onToggle={() => onToggleLane(level)}
                tone="neutral"
                summary={standing.line}
              >
                <standing.icon size={12} className="shrink-0" style={{ color: standing.color }} />
              </DisclosureButton>
            </div>

            {open && (
              <div className="xl:pl-[184px] flex flex-col gap-2.5">
                {renderLaneEvidence(level)}
                {laneEvidence[level].length === 0 && !laneDerivedDoc[level] && !laneFormOpen && (
                  <EmptyState>{LANE_EMPTY_HINT[level]}</EmptyState>
                )}
              </div>
            )}
          </Well>
        );
      })}

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
    </div>
  );
}
