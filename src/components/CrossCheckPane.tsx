import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import Modal, { ModalCloseButton } from "./Modal";
import { crossCheck, designation, paragraphMarker, SOURCE_DOCUMENTS, type CrossCheckClause } from "../engine/sourceText";
import type { Control } from "../graph/nodes/controls";

// A common control beside the source text of every clause one standard maps to
// it: ACME's words on the left, the standard's on the right. Picking either
// side highlights what it connects to on the other (requirementClauses.ts), so
// a reviewer can check each clause is really covered by the requirement it is
// tagged to. Reading only: nothing here changes mappings or assessments.
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Source Serif 4', serif";

type Pick = { kind: "requirement"; number: number } | { kind: "clause"; clause: string } | null;

function ClauseBlock({ c, lit, dim, onPick }: { c: CrossCheckClause; lit: boolean; dim: boolean; onPick: () => void }) {
  const p = c.source?.paragraph;
  const d = p ? designation(p) : null;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={lit}
      data-lit={lit || undefined}
      className="w-full text-left rounded-lg px-3.5 py-3 transition-opacity"
      style={{
        background: lit ? C.accentBg : C.panel,
        border: `1px solid ${lit ? C.accent : C.border}`,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs" style={{ color: C.accent, fontFamily: MONO }}>{c.clause}</span>
        <span className="flex items-center gap-1.5">
          {d && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: d === "Addressable" ? C.amberBg : d === "Required" ? C.greenBg : C.accentBg, color: d === "Addressable" ? C.amber : d === "Required" ? C.green : C.accent }}>{d}</span>
          )}
          {c.requirements.length > 0 && (
            <span className="text-[10px]" style={{ color: C.muted, fontFamily: MONO }}>→ req {c.requirements.join(", ")}</span>
          )}
        </span>
      </div>
      {c.source ? (
        <>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>§ {c.source.section.id} {c.source.section.title}</div>
          {c.source.ancestors.map((a) => (
            <div key={a.id} className="mt-1.5 text-xs leading-relaxed" style={{ color: C.muted }}>
              <span style={{ fontFamily: MONO }}>{paragraphMarker(a)} </span>
              {a.heading && <span className="italic">{a.heading} </span>}
              {a.text}
            </div>
          ))}
          <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: C.ink }}>
            <span style={{ fontFamily: MONO, color: C.accent }}>{paragraphMarker(c.source.paragraph)} </span>
            {c.source.paragraph.heading && <span className="italic font-semibold">{c.source.paragraph.heading} </span>}
            {c.source.paragraph.text}
          </div>
        </>
      ) : (
        <div className="mt-1 text-xs" style={{ color: C.muted }}>No source text for this clause.</div>
      )}
    </button>
  );
}

export function CrossCheckPane({ control, standard, onClose }: { control: Control; standard: string; onClose: () => void }) {
  const view = useMemo(() => crossCheck(control, standard), [control, standard]);
  const doc = SOURCE_DOCUMENTS[standard];
  const [pick, setPick] = useState<Pick>(null);
  const leftRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);

  // Bring the first match on the OTHER side into view; the side clicked is
  // already where the reader is looking.
  useEffect(() => {
    if (!pick) return;
    const other = pick.kind === "clause" ? leftRef.current : rightRef.current;
    other?.querySelector("[data-lit]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pick]);

  const litRequirements = new Set<number>(
    pick?.kind === "requirement" ? [pick.number]
      : pick?.kind === "clause" ? view.clauses.find((c) => c.clause === pick.clause)?.requirements ?? []
        : [],
  );
  const litClauses = new Set<string>(
    pick?.kind === "clause" ? [pick.clause]
      : pick?.kind === "requirement" ? view.clauses.filter((c) => c.requirements.includes(pick.number)).map((c) => c.clause)
        : [],
  );
  const clausesPerRequirement = (n: number) => view.clauses.filter((c) => c.requirements.includes(n)).length;
  const toggle = (next: NonNullable<Pick>) =>
    setPick((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? null : next));

  return (
    <Modal open onClose={onClose} width={1400} height={940}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="min-w-0">
          <div className="text-xs" style={{ color: C.accent, fontFamily: MONO }}>Cross-check · {control.id} against {doc?.title ?? standard}</div>
          <h2 className="mt-1 text-xl" style={{ color: C.ink, fontFamily: SERIF, fontWeight: 600 }}>{control.name}</h2>
          <p className="mt-1 mb-0 text-xs" style={{ color: C.muted }}>
            {view.clauses.length} {standard} clause{view.clauses.length === 1 ? "" : "s"} mapped. Select a requirement or a clause to see what it connects to on the other side.
            {pick && (
              <button type="button" onClick={() => setPick(null)} className="ml-2 underline" style={{ color: C.accent }}>Clear selection</button>
            )}
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
        <section ref={leftRef} aria-label="Common control" className="min-h-0 overflow-y-auto px-6 py-5" style={{ borderRight: `1px solid ${C.border}` }}>
          <h3 className="m-0 text-xs font-semibold tracking-wider uppercase" style={{ color: C.muted }}>ACME common control</h3>
          <p className="mt-2 mb-4 text-[13px] leading-relaxed whitespace-pre-line" style={{ color: C.ink }}>{view.statement}</p>
          {view.requirements.length < view.totalRequirements && (
            <p className="-mt-2 mb-4 text-xs" style={{ color: C.muted }}>
              {view.requirements.length} of {view.totalRequirements} requirements: the parts {standard} maps to. The rest of the control falls outside {standard}.
            </p>
          )}
          {view.requirements.length > 0 ? (
            <div className="flex flex-col gap-2">
              {view.requirements.map((r) => {
                const lit = litRequirements.has(r.number);
                const n = clausesPerRequirement(r.number);
                return (
                  <button
                    key={r.number}
                    type="button"
                    aria-pressed={lit}
                    data-lit={lit || undefined}
                    onClick={() => toggle({ kind: "requirement", number: r.number })}
                    className="w-full text-left flex gap-3 rounded-lg px-3.5 py-3 transition-opacity"
                    style={{
                      background: lit ? C.accentBg : C.panel,
                      border: `1px solid ${lit ? C.accent : C.border}`,
                      opacity: pick && !lit ? 0.45 : 1,
                    }}
                  >
                    <span className="w-6 shrink-0 text-right text-[13px] font-semibold" style={{ color: C.accent, fontFamily: MONO }}>{r.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>{r.title}</span>
                      <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{r.detail}</span>
                    </span>
                    <span className="shrink-0 text-[10px] self-start mt-0.5" style={{ color: n ? C.muted : C.na, fontFamily: MONO }}>
                      {n ? `${n} ${standard}` : `no ${standard}`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs" style={{ color: C.muted }}>This control has no itemized requirements; its {standard} clauses map to the control as a whole.</p>
          )}
        </section>

        <section ref={rightRef} aria-label={`${standard} source text`} className="min-h-0 overflow-y-auto px-6 py-5" style={{ background: C.panel2 }}>
          <h3 className="m-0 text-xs font-semibold tracking-wider uppercase" style={{ color: C.muted }}>
            {doc?.title ?? standard}{doc ? ` · ${doc.citation}` : ""}
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            {view.clauses.map((c) => (
              <ClauseBlock
                key={c.clause}
                c={c}
                lit={litClauses.has(c.clause)}
                dim={Boolean(pick) && !litClauses.has(c.clause)}
                onPick={() => toggle({ kind: "clause", clause: c.clause })}
              />
            ))}
          </div>
          {doc && <p className="mt-4 mb-0 text-[10px]" style={{ color: C.muted }}>Source: eCFR, as of {doc.asOf}. {doc.license}</p>}
        </section>
      </div>
    </Modal>
  );
}
