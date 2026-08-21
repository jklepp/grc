import { useState } from "react";
import { Check } from "lucide-react";
import { COMPLIANCE_LABELS, COMPLIANCE_RATINGS, PRISMA_LEVELS } from "../../engine";
import { ratingColor } from "./controlMeta";
import { C } from "../../theme";
import {
  Button, ChoiceChip, Field, FieldGrid, TextArea, TextInput, TX, Well,
} from "../../components/wizard/WizardUI";
import type { ComplianceRating, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { LevelRating } from "../../engine";

export interface LaneGrade {
  level: PrismaLevel;
  rating: ComplianceRating;
  derived: ComplianceRating;
}

interface PrismaLaneGraderProps {
  levels: Record<PrismaLevel, LevelRating>;
  assessedBy: string;
  onAssessedByChange?: (value: string) => void;
  note: string;
  onNoteChange?: (value: string) => void;
  comment: string;
  onCommentChange?: (value: string) => void;
  onSubmit: (result: { grades: LaneGrade[]; assessedBy: string; note: string; comment: string }) => void;
  submitLabel?: string;
  disabled?: boolean;
}

const RATINGS_HIGH_TO_LOW = [...COMPLIANCE_RATINGS].reverse();

export function PrismaLaneGrader({
  levels, assessedBy: assessedByProp, onAssessedByChange, note: noteProp, onNoteChange, comment: commentProp, onCommentChange, onSubmit, submitLabel = "Save PRISMA ratings", disabled = false,
}: PrismaLaneGraderProps) {
  const [ratings, setRatings] = useState<Record<PrismaLevel, ComplianceRating>>(
    Object.fromEntries(PRISMA_LEVELS.map((level) => [level, levels[level].rating ?? levels[level].derived ?? 50])) as Record<PrismaLevel, ComplianceRating>
  );
  const [assessedByLocal, setAssessedByLocal] = useState(assessedByProp);
  const [noteLocal, setNoteLocal] = useState(noteProp);
  const [commentLocal, setCommentLocal] = useState(commentProp);
  const assessedBy = onAssessedByChange ? assessedByProp : assessedByLocal;
  const note = onNoteChange ? noteProp : noteLocal;
  const comment = onCommentChange ? commentProp : commentLocal;

  const changed = PRISMA_LEVELS.some((level) => ratings[level] !== levels[level].derived);
  const ready = Boolean(assessedBy.trim()) && (!changed || note.trim().length > 0) && comment.trim().length > 0;

  function setAssessedBy(value: string) {
    if (onAssessedByChange) onAssessedByChange(value);
    else setAssessedByLocal(value);
  }
  function setNote(value: string) {
    if (onNoteChange) onNoteChange(value);
    else setNoteLocal(value);
  }
  function setComment(value: string) {
    if (onCommentChange) onCommentChange(value);
    else setCommentLocal(value);
  }

  return (
    <Well className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {PRISMA_LEVELS.map((level) => {
          const derived = levels[level].derived;
          return (
            <div key={level} className="min-w-0">
              <div className={`${TX.label} mb-2`} style={{ color: C.muted }}>{level}</div>
              <div className="flex flex-col gap-1.5">
                {RATINGS_HIGH_TO_LOW.map((rating) => (
                  <ChoiceChip
                    key={rating}
                    selected={ratings[level] === rating}
                    disabled={disabled}
                    solid
                    tint={ratingColor(rating)}
                    ariaLabel={`${level} — ${rating}, ${COMPLIANCE_LABELS[rating]}`}
                    onClick={() => setRatings((current) => ({ ...current, [level]: rating }))}
                    className="w-full"
                  >
                    {rating}
                  </ChoiceChip>
                ))}
              </div>
              <div className={`${TX.help} mt-2`} style={{ color: C.muted }}>
                {COMPLIANCE_LABELS[ratings[level]]}
                {ratings[level] !== derived ? ` · derived ${derived}` : " · derived"}
              </div>
            </div>
          );
        })}
      </div>

      <FieldGrid cols={2}>
        <Field label="Assessed by" error={disabled || assessedBy.trim() ? null : "Required to save a grade."}>
          <TextInput disabled={disabled} value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)} placeholder="Your name" />
        </Field>
        <Field
          label="Note"
          note="Required if you change a lane away from its derived rating."
          error={disabled || !changed || note.trim() ? null : "A changed lane needs a reason."}
        >
          <TextInput disabled={disabled} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why a lane differs from the derived rating" />
        </Field>
        <Field label="Comment" span2 error={disabled || comment.trim() ? null : "Required to save a grade."}>
          <TextArea
            disabled={disabled}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe in detail why the system satisfies each PRISMA lane"
            style={{ minHeight: 76 }}
          />
        </Field>
      </FieldGrid>

      <div className="flex justify-end">
        <Button
          variant="primary"
          icon={Check}
          disabled={!ready || disabled}
          onClick={() => onSubmit({
            grades: PRISMA_LEVELS.map((level) => ({ level, rating: ratings[level], derived: levels[level].derived })),
            assessedBy: assessedBy.trim(),
            note: note.trim(),
            comment: comment.trim(),
          })}
        >
          {submitLabel}
        </Button>
      </div>
    </Well>
  );
}
