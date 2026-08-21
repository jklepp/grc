import React, { useState } from "react";
import type { CSSProperties } from "react";
import { C } from "../../theme";
import { COMPLIANCE_LABELS, COMPLIANCE_RATINGS, PRISMA_LEVELS } from "../../engine";
import { ratingColor } from "./controlMeta";
import type { ComplianceRating, PrismaLevel } from "../../graph/nodes/taxonomy";
import type { LevelRating } from "../../engine";

function inputStyle(): CSSProperties {
  return {
    background: C.panel, border: `1px solid ${C.border}`, color: C.ink,
    borderRadius: 8, padding: "6px 8px", fontSize: 12, width: "100%",
  };
}

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
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="grid grid-cols-5 gap-2">
        {PRISMA_LEVELS.map((level) => {
          const derived = levels[level].derived;
          return (
            <div key={level}>
              <div className="text-[10px] font-semibold mb-1" style={{ color: C.muted }}>{level}</div>
              <div className="flex flex-col gap-1">
                {RATINGS_HIGH_TO_LOW.map((rating) => {
                  const active = ratings[level] === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      disabled={disabled}
                      onClick={() => setRatings((current) => ({ ...current, [level]: rating }))}
                      className="text-[10px] font-semibold px-1.5 py-1 rounded"
                      style={{
                        background: active ? ratingColor(rating) : C.panel2,
                        color: active ? "#fff" : C.ink,
                        border: `1px solid ${active ? ratingColor(rating) : C.border}`,
                        opacity: disabled ? 0.55 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {rating}
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] mt-1 leading-tight" style={{ color: C.muted }}>
                {COMPLIANCE_LABELS[ratings[level]]}
                {ratings[level] !== derived ? ` · derived ${derived}` : " · derived"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Assessed by</div>
          <input style={inputStyle()} disabled={disabled} value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Note (required if you change a lane)</div>
          <input style={inputStyle()} disabled={disabled} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why a lane differs from the derived rating" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>Comment (required)</div>
        <textarea
          style={{ ...inputStyle(), minHeight: 72, resize: "vertical" }}
          disabled={disabled}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Describe in detail why the system satisfies each PRISMA lane"
        />
      </div>
      <button
        type="button"
        className="text-xs font-semibold px-3 py-1.5 rounded-lg mt-3"
        style={{ background: ready && !disabled ? C.accent : C.border, color: "#fff" }}
        disabled={!ready || disabled}
        onClick={() => onSubmit({
          grades: PRISMA_LEVELS.map((level) => ({ level, rating: ratings[level], derived: levels[level].derived })),
          assessedBy: assessedBy.trim(),
          note: note.trim(),
          comment: comment.trim(),
        })}
      >
        {submitLabel}
      </button>
    </div>
  );
}
