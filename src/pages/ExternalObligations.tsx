import React, { useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Handshake, Lightbulb, ShieldAlert, XCircle } from "lucide-react";
import { PageHeader, SectionHeading } from "../components/Headings";
import { C } from "../theme";
import { OBLIGATION_PARAMETERS } from "../engine";
import type { EvaluatedObligation, EvaluatedProof, ObligationParameter, ObligationStatus } from "../engine";
import { isClockUnit } from "../graph/nodes/externalObligations";
import type { ParameterUnit } from "../graph/nodes/externalObligations";

// Everything on this page is read off engine/obligations.ts: scope, proof and
// status are derived there, never decided here.

const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Source Serif 4', serif";

const STATUS_META: Record<ObligationStatus, { label: string; color: string; background: string }> = {
  proven: { label: "Proven", color: C.green, background: C.greenBg },
  "not-proven": { label: "Not proven", color: C.amber, background: C.amberBg },
  "no-proof": { label: "No proof defined", color: C.red, background: C.redBg },
};

function formatValue(unit: ParameterUnit, value: number | string): string {
  if (!isClockUnit(unit)) return String(value);
  const n = Number(value);
  return `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
}

function StatusBadge({ status }: { status: ObligationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: meta.color, background: meta.background }}>
      {meta.label}
    </span>
  );
}

function ParameterRow({ parameter, selected, onSelect }: { parameter: ObligationParameter; selected: boolean; onSelect: () => void }) {
  const count = parameter.obligations.length;
  const strictestLabel = count === 0
    ? "No stricter terms"
    : parameter.strictest
      ? formatValue(parameter.unit, parameter.strictest.value)
      : count === 1
        ? String(parameter.obligations[0].value)
        : `${count} different terms`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full text-left rounded-xl px-4 py-3.5 transition-colors"
      style={{ background: selected ? C.accentBg : C.panel, border: `1px solid ${selected ? C.accent : C.border}` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px]" style={{ color: C.accent, fontFamily: MONO }}>{parameter.controlId}</span>
        <span className="text-[11px] truncate" style={{ color: C.muted }}>{parameter.control?.name}</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: count > 0 ? C.accent : C.muted, background: count > 0 ? C.accentBg : C.panel2 }}
        >
          {count > 0 ? `${count} ${count === 1 ? "party" : "parties"}` : "None"}
        </span>
      </div>
      <div className="text-sm font-semibold mt-1.5" style={{ color: C.ink }}>{parameter.parameter}</div>
      <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
        <span className="rounded px-2 py-0.5" style={{ background: C.panel2, color: C.muted }}>{formatValue(parameter.unit, parameter.value)}</span>
        <ArrowRight size={13} color={C.muted} aria-hidden="true" />
        <span className="font-semibold" style={{ color: count > 0 ? C.ink : C.muted }}>{strictestLabel}</span>
      </div>
    </button>
  );
}

// Clock parameters only: every party's value on one line from 0 to the default.
function ClockScale({ parameter }: { parameter: ObligationParameter }) {
  const max = Number(parameter.value);
  const marks = [
    { key: "default", label: `Default · ${max}`, pct: 100, color: C.muted },
    ...parameter.obligations.map((o) => ({ key: o.id, label: `${o.party} · ${Number(o.value)}`, pct: (Number(o.value) / max) * 100, color: C.accent })),
  ];
  // Two parties on the same value would draw on top of each other; stack them.
  const seen = new Map<number, number>();
  const placed = marks.map((m) => {
    const row = seen.get(m.pct) ?? 0;
    seen.set(m.pct, row + 1);
    return { ...m, row };
  });
  const rows = Math.max(...placed.map((m) => m.row)) + 1;
  const ROW = 18;
  const lineTop = rows * ROW + 8;
  const summary = marks.map((m) => m.label).join(", ");
  return (
    <div role="img" aria-label={`${parameter.parameter} in ${parameter.unit}: ${summary}`} className="relative mx-12 mt-2" style={{ height: lineTop + 22 }}>
      <div className="absolute left-0 right-0 h-1 rounded" style={{ top: lineTop, background: C.border }} />
      {placed.map((m) => (
        <React.Fragment key={m.key}>
          <span
            className="absolute text-[11px] font-semibold whitespace-nowrap"
            style={{ left: `${m.pct}%`, top: (rows - 1 - m.row) * ROW, transform: "translateX(-50%)", color: m.color }}
          >
            {m.label}
          </span>
          <span className="absolute w-3 h-3 rounded-full" style={{ left: `${m.pct}%`, top: lineTop - 4, transform: "translateX(-50%)", background: m.color }} />
        </React.Fragment>
      ))}
      <div className="absolute left-0 text-[10px]" style={{ top: lineTop + 8, color: C.muted }}>0</div>
      <div className="absolute right-0 text-[10px]" style={{ top: lineTop + 8, color: C.muted }}>{parameter.unit}</div>
    </div>
  );
}

function ProofItem({ proof }: { proof: EvaluatedProof }) {
  return (
    <li className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="flex items-start gap-2">
        {proof.proven
          ? <CheckCircle2 size={14} color={C.green} className="mt-0.5 shrink-0" aria-hidden="true" />
          : <XCircle size={14} color={C.amber} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>
            {proof.title}
            <span className="sr-only">{proof.proven ? " — proven" : " — not proven"}</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {proof.checks.map((check) => (
              <li key={check.ref} className="text-xs" style={{ color: C.muted }}>
                <span style={{ fontFamily: MONO, color: C.ink }}>{check.ref}</span> {check.label !== check.ref && <>· {check.label}</>} — {check.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

function ObligationCard({ obligation, unit }: { obligation: EvaluatedObligation; unit: ParameterUnit }) {
  const effective = obligation.inForce
    ? "In force"
    : `From ${obligation.effectiveAt} · ${obligation.daysUntilEffective} days`;
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px]" style={{ color: C.accent, fontFamily: MONO }}>{obligation.id}</span>
            <span className="text-sm font-semibold" style={{ color: C.ink }}>{obligation.party}</span>
            <span className="text-[11px] capitalize" style={{ color: C.muted }}>{obligation.partyKind}</span>
          </div>
          <div className="text-base font-semibold mt-1" style={{ color: C.ink }}>{formatValue(unit, obligation.value)}</div>
          {obligation.detail && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{obligation.detail}</div>}
        </div>
        <StatusBadge status={obligation.status} />
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Effective</dt>
          <dd style={{ color: obligation.inForce ? C.ink : C.amber }}>{effective}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Systems</dt>
          <dd style={{ color: C.ink }}>{obligation.systems.length > 0 ? obligation.systems.map((s) => s.name).join(", ") : "None hold this data"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Whose data</dt>
          <dd style={{ color: C.ink }}>{obligation.dataTypes.map((d) => d.name).join(", ")}</dd>
        </div>
      </dl>
      {obligation.ruledOutSystems.length > 0 && (
        <div className="text-[11px] mt-2" style={{ color: C.muted }}>
          Ruled out: {obligation.ruledOutSystems.map((s) => s.name).join(", ")} — holds none of this data.
        </div>
      )}

      <div className="mt-3">
        {obligation.proofs.length > 0 ? (
          <ul className="space-y-2">
            {obligation.proofs.map((proof) => <ProofItem key={proof.title} proof={proof} />)}
          </ul>
        ) : (
          <div className="rounded-lg p-3 flex items-start gap-2 text-xs" style={{ background: C.redBg, color: C.ink }}>
            <CircleDashed size={14} color={C.red} className="mt-0.5 shrink-0" aria-hidden="true" />
            Nothing checks this term yet. Name the evidence that would show it’s met.
          </div>
        )}
      </div>
    </div>
  );
}

function ParameterDetail({ parameter }: { parameter: ObligationParameter }) {
  const clock = isClockUnit(parameter.unit);
  return (
    <div className="rounded-xl p-5 space-y-6" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: C.accent, fontFamily: MONO }}>{parameter.controlId}</span>
          <span className="text-xs" style={{ color: C.muted }}>{parameter.control?.name}</span>
        </div>
        <h2 className="text-xl leading-snug mt-1" style={{ color: C.ink, fontFamily: SERIF, fontWeight: 600 }}>{parameter.parameter}</h2>
        <div className="text-xs mt-1" style={{ color: C.muted }}>{parameter.description}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(200px,0.8fr)_minmax(0,1.6fr)] gap-3">
        <div className="rounded-lg p-4" style={{ background: C.panel2 }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>ACME default</div>
          <div className="text-2xl mt-1" style={{ color: C.ink, fontFamily: SERIF, fontWeight: 600 }}>{formatValue(parameter.unit, parameter.value)}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>{parameter.source}</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Owner: {parameter.owner?.name ?? parameter.ownerId}</div>
        </div>
        <div className="rounded-lg p-4" style={{ background: C.panel2 }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>What outside parties require</div>
          {parameter.obligations.length === 0 ? (
            <div className="text-sm mt-2" style={{ color: C.muted }}>No outside party requires more than the default.</div>
          ) : clock ? (
            <ClockScale parameter={parameter} />
          ) : (
            <ul className="mt-2 space-y-1">
              {parameter.obligations.map((o) => (
                <li key={o.id} className="text-sm" style={{ color: C.ink }}>
                  <span className="font-semibold">{o.party}</span> — {String(o.value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {parameter.raiseDefault && (
        <div className="rounded-lg p-4 flex items-start gap-3" style={{ background: C.accentBg, border: `1px solid ${C.accent}` }}>
          <Lightbulb size={16} color={C.accent} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm" style={{ color: C.ink }}>
            <div className="font-semibold">Worth deciding: raise the default to {formatValue(parameter.unit, parameter.raiseDefault.value)}?</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              {parameter.raiseDefault.retires} parties require a stricter value than the default. One process run at the strictest value meets every one of them,
              instead of a separate clock per party. Decided by {parameter.owner?.name ?? parameter.ownerId}.
            </div>
          </div>
        </div>
      )}

      {parameter.openFindings.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Open findings on this control</div>
          <ul className="space-y-1.5">
            {parameter.openFindings.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-xs" style={{ color: C.ink }}>
                <ShieldAlert size={13} color={C.amber} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span><span style={{ fontFamily: MONO }}>{f.id}</span> · {f.title} — {f.remediationStatus}, due {f.due}{f.overdue ? " (overdue)" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {parameter.obligations.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.muted }}>
            Obligations · {parameter.notProven} of {parameter.obligations.length} not proven
          </div>
          {parameter.obligations.map((o) => <ObligationCard key={o.id} obligation={o} unit={parameter.unit} />)}
        </div>
      )}
    </div>
  );
}

export default function ExternalObligations() {
  const [selectedId, setSelectedId] = useState(
    () => OBLIGATION_PARAMETERS.find((p) => p.obligations.length > 0)?.id ?? OBLIGATION_PARAMETERS[0]?.id ?? ""
  );
  const selected = OBLIGATION_PARAMETERS.find((p) => p.id === selectedId) ?? OBLIGATION_PARAMETERS[0] ?? null;

  return (
    <div className="w-full pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={Handshake}
        title="External Obligations"
        tagline="Stricter than ACME's defaults"
        description="Security and data terms owed to customers and other outside parties. Each one counts as met only when evidence shows it."
      />

      <div className="px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.6fr)] gap-5 items-start">
        <div>
          <SectionHeading hint="Default → strictest">Controls</SectionHeading>
          <div className="space-y-2.5">
            {OBLIGATION_PARAMETERS.map((parameter) => (
              <ParameterRow
                key={parameter.id}
                parameter={parameter}
                selected={parameter.id === selected?.id}
                onSelect={() => setSelectedId(parameter.id)}
              />
            ))}
          </div>
          <div className="text-[11px] mt-3 px-1" style={{ color: C.muted }}>
            Other contract terms, such as liability, audit rights and insurance, stay with Legal.
          </div>
        </div>

        {selected ? <ParameterDetail parameter={selected} /> : (
          <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            No control defaults are recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
