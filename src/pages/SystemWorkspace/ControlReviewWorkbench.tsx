import React, { useMemo, useState } from "react";
import { Ban, Building2, Check, ClipboardCheck, Cloud, Layers } from "lucide-react";
import { C } from "../../theme";
import { commitRuntimeFacts } from "../../engine";
import { upsertControlReview } from "../../engine/runtimeMutations";
import { AUDIT_READINESS_LABELS, REVIEW_WAVES } from "../../engine/review";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { SectionHeader } from "./shared/SectionHeader";
import type { ReviewWave } from "../../engine/review";
import type { ControlId, SystemId } from "../../graph/ids";
import type { ReviewBucket } from "../../graph/edges/controlReviews";
import type { Control } from "../../graph/nodes/controls";

const WAVE_META: Record<ReviewWave, { label: string; Icon: typeof Ban; hint: string; color: () => string; bg: () => string }> = {
  "not-applicable": { label: "Not applicable", Icon: Ban, hint: "Confirm derived exclusions, or pull a control back into scope.", color: () => C.muted, bg: () => C.panel2 },
  "vendor-inherited": { label: "Vendor inherited", Icon: Cloud, hint: "Confirm the provider actually runs these controls for this boundary.", color: () => C.accent, bg: () => C.accentBg },
  enterprise: { label: "Company-level", Icon: Building2, hint: "Confirm this system is in the central program or process.", color: () => C.green, bg: () => C.greenBg },
  "system-owned": { label: "Remaining technical", Icon: Layers, hint: "Grade the controls ACME still has to evidence on this boundary.", color: () => C.ink, bg: () => C.panel2 },
};

const WORKSPACE_GRID = "2fr 160px 2fr 170px";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function bucketForWave(wave: ReviewWave): ReviewBucket {
  return wave;
}

interface ControlReviewWorkbenchProps {
  systemId: SystemId;
  assessor: string;
  onGradeControl: (controlId: ControlId) => void;
  initialWave?: ReviewWave | null;
}

export function ControlReviewWorkbench({ systemId, assessor, onGradeControl, initialWave = null }: ControlReviewWorkbenchProps) {
  const liveEngine = useLiveEngine();
  const walk = liveEngine.review.wavesForSystem(systemId);
  const readiness = liveEngine.review.auditReadinessForSystem(systemId);
  const [wave, setWave] = useState<ReviewWave>(initialWave && walk.waves[initialWave] ? initialWave : walk.firstIncomplete);
  const [reviewer, setReviewer] = useState(assessor);
  const [rejectingId, setRejectingId] = useState<ControlId | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [saveError, setSaveError] = useState<string[] | null>(null);

  const current = walk.waves[wave];
  const rows = current.remaining;
  const meta = WAVE_META[wave];

  const byDomain = useMemo(() => {
    const groups: Array<{ domain: string; items: typeof rows }> = [];
    rows.forEach((item) => {
      const last = groups[groups.length - 1];
      if (last && last.domain === item.control.domain) last.items.push(item);
      else groups.push({ domain: item.control.domain, items: [item] });
    });
    return groups;
  }, [rows]);

  function saveReviews(reviews: Array<{ control: Control; stance: "confirm" | "reject"; note: string }>): boolean {
    setSaveError(null);
    const existing = loadRuntimeFacts();
    let runtime = existing;
    reviews.forEach(({ control, stance, note }) => {
      runtime = upsertControlReview(runtime, {
        systemId,
        controlId: control.id,
        bucket: bucketForWave(wave),
        stance,
        note,
        reviewedBy: reviewer.trim(),
        reviewedAt: today(),
      });
    });
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setSaveError(problems);
      return false;
    }
    setRejectingId(null);
    setRejectNote("");
    return true;
  }

  const canWrite = reviewer.trim().length > 0 && wave !== "system-owned";

  return (
    <div className="px-8 pb-10 space-y-6">
      <SectionHeader
        icon={ClipboardCheck}
        title="Control Workspace"
        description="Walk the derived buckets, confirm or reject each call, then grade remaining technical controls. This is the human record an auditor will ask for."
        aside={
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Audit-ready</div>
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{AUDIT_READINESS_LABELS[readiness.overall]}</div>
          </div>
        }
      />

      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{meta.label}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>
              {rows.length} control{rows.length !== 1 ? "s" : ""} remaining · {meta.hint}
            </div>
          </div>
          {wave !== "system-owned" && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                Reviewer
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="rounded-md px-2 py-1 text-[12px]"
                  style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.ink, width: 200 }}
                  placeholder="Assessor of record"
                />
              </label>
              <button
                type="button"
                disabled={!canWrite || rows.length === 0}
                onClick={() => saveReviews(rows.map((item) => ({ control: item.control, stance: "confirm", note: item.reason })))}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: canWrite && rows.length > 0 ? C.accent : C.border, color: "#fff" }}
              >
                <span className="inline-flex items-center gap-1"><Check size={12} /> Confirm remaining</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
          {REVIEW_WAVES.map((id) => {
            const waveMeta = WAVE_META[id];
            const projection = walk.waves[id];
            const active = wave === id;
            const color = waveMeta.color();
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setWave(id); setRejectingId(null); }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shrink-0"
                style={{
                  background: active ? waveMeta.bg() : "transparent",
                  color,
                  boxShadow: active ? `0 0 0 1.5px ${color}` : "none",
                }}
              >
                <waveMeta.Icon size={11} />
                {projection.remaining.length} {waveMeta.label}
              </button>
            );
          })}
        </div>

        {saveError && (
          <div className="px-4 py-2 text-[11px]" style={{ background: C.redBg, color: C.red }}>
            {saveError.join(" ")}
          </div>
        )}

        <div className="grid text-[11px] font-medium px-4 py-2.5" style={{ gridTemplateColumns: WORKSPACE_GRID, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
          <div>CONTROL</div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>BUCKET</div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>DERIVED REASON</div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>ACTION</div>
        </div>

        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {rows.length === 0 && (
            <div className="p-6 text-xs text-center" style={{ color: C.muted }}>
              {wave === "system-owned" ? "No unassessed key technical controls in this bucket." : "Nothing left to confirm in this wave."}
            </div>
          )}
          {byDomain.map((group) => (
            <React.Fragment key={group.domain}>
              <div className="px-4 py-2 text-[10px] uppercase tracking-wide font-semibold sticky top-0" style={{ color: C.muted, background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                {group.domain} · {group.items.length}
              </div>
              {group.items.map((item) => {
                const rejecting = rejectingId === item.control.id;
                return (
                  <div key={item.control.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <div className="grid px-4 items-center" style={{ gridTemplateColumns: WORKSPACE_GRID }}>
                      <div className="py-3 min-w-0">
                        <div className="text-sm leading-snug" style={{ color: C.ink }}>{item.control.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{item.control.id}</div>
                      </div>
                      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: meta.bg(), color: meta.color() }}>
                          <meta.Icon size={11} /> {meta.label}
                        </span>
                      </div>
                      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
                        <div className="text-[11px] leading-snug" style={{ color: C.muted }}>{item.reason}</div>
                      </div>
                      <div className="py-3 pl-3" style={{ borderLeft: `1px solid ${C.border}` }}>
                        {wave === "system-owned" ? (
                          <button
                            type="button"
                            onClick={() => onGradeControl(item.control.id)}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                            style={{ background: C.accent, color: "#fff" }}
                          >
                            Grade
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() => saveReviews([{ control: item.control, stance: "confirm", note: item.reason }])}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                              style={{ background: C.greenBg, color: C.green, opacity: canWrite ? 1 : 0.4 }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() => { setRejectingId(item.control.id); setRejectNote(""); }}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                              style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}`, opacity: canWrite ? 1 : 0.4 }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {rejecting && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <input
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          className="flex-1 rounded-md px-2 py-1.5 text-[12px]"
                          style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.ink }}
                          placeholder="Why the derived call does not hold on this boundary"
                        />
                        <button
                          type="button"
                          disabled={!rejectNote.trim()}
                          onClick={() => saveReviews([{ control: item.control, stance: "reject", note: rejectNote.trim() }])}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ background: rejectNote.trim() ? C.accent : C.border, color: "#fff" }}
                        >
                          Save reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
