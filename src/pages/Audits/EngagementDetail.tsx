import React, { useMemo, useState } from "react";
import { ArrowLeft, Database, Download, Inbox, Layers, ListChecks, Lock, Play } from "lucide-react";
import { C } from "../../theme";
import Modal, { ModalCloseButton } from "../../components/Modal";
import { Button, Field, Select, TextInput } from "../../components/wizard/WizardUI";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { useSignedInUser } from "../../auth/useUser";
import { allows, canManageEngagement } from "../../auth/gates";
import { applyEngagementClose, saveEngagement, saveEngagementControl } from "../../engine/runtimeMutations";
import {
  AUDITOR_RESULT_META, AUDIT_TYPE_LABELS, CERTIFICATION_KINDS, CERTIFICATION_KIND_LABELS, ENGAGEMENT_STATUS_META, NONCONFORMITY_LABELS,
  type CertificationKind, type Engagement,
} from "../../graph/nodes/engagements";
import { DEFAULT_ENGAGEMENT_FILTERS, EngagementControls, type EngagementFilters } from "./EngagementControls";
import { Panel } from "../SystemWorkspace/shared/Panel";
import { SectionHeader } from "../SystemWorkspace/shared/SectionHeader";
import { StatRing } from "../SystemWorkspace/shared/StatRing";
import { BarRow, Chip } from "../SystemWorkspace/SystemControls";
import { AUDITOR_RESULT_BADGE, sourceMeta } from "../SystemWorkspace/controlMeta";
import { commit, downloadCsv, nowIso, Pill, ResultPill, SOURCE_LABELS } from "./shared";

type Tab = "controls" | "requests" | "populations";
const isTab = (v?: string): v is Tab => v === "controls" || v === "requests" || v === "populations";

export function EngagementDetail({ engagementId, initialTab, onBack }: { engagementId: string; initialTab?: string; onBack: () => void }) {
  const engine = useLiveEngine();
  const user = useSignedInUser();
  const canManage = allows(canManageEngagement(user));
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "controls");
  const [closing, setClosing] = useState(false);
  const [filters, setFilters] = useState<EngagementFilters>(DEFAULT_ENGAGEMENT_FILTERS);
  const filterFromTracker = (next: EngagementFilters) => {
    const same = JSON.stringify(next) === JSON.stringify(filters);
    setFilters(same ? DEFAULT_ENGAGEMENT_FILTERS : next);
    setTab("controls");
  };
  const e = engine.graph.engagementById[engagementId];
  const s = engine.engagements.summary(engagementId);
  const status = ENGAGEMENT_STATUS_META[e.status];
  const closed = e.status === "closed";

  function exportCsv() {
    const rows = engine.engagements.rowsFor(e.id);
    downloadCsv(`${e.id}-controls.csv`,
      ["Control", "Name", "System", "Source", "In scope", "Justification", "Statement", "Record status", "Evidence", "Auditor result", "Nonconformity", "Note"],
      rows.map((r) => [
        r.controlId, r.control.name, r.systemName, SOURCE_LABELS[r.source] ?? r.source, r.inScope ? "Yes" : "No", r.justification,
        r.effective.statement, r.effective.status ?? r.coverage.status, r.effective.evidence.join("; "),
        AUDITOR_RESULT_META[r.result].label, r.nonconformity ? NONCONFORMITY_LABELS[r.nonconformity] : "", r.resultNote,
      ]));
  }

  const meta = (label: string, value: React.ReactNode) => (
    <div>
      <div className="text-[11px]" style={{ color: C.muted }}>{label}</div>
      <div className="text-[13px] mt-1" style={{ color: C.ink }}>{value}</div>
    </div>
  );

  return (
    <div className="w-full px-4 lg:px-8 pt-6 pb-10 flex flex-col gap-5">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: C.accent }}>
          <ArrowLeft size={14} /> Audits
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="m-0 text-2xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{e.name}</h1>
          <div className="flex gap-2">
            <Button icon={Download} onClick={exportCsv}>Export controls</Button>
            {canManage && e.status === "preparing" && (
              <Button icon={Play} onClick={() => commit((rt) => saveEngagement(rt, { ...e, status: "in-audit" }))}>Start fieldwork</Button>
            )}
            {canManage && !closed && <Button variant="primary" icon={Lock} onClick={() => setClosing(true)}>Close audit</Button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
          {meta("Focus", <Pill color="accent">{e.focus === "external" ? "External" : "Internal"}</Pill>)}
          {meta("Status", <Pill color={status.color}>{status.label}</Pill>)}
          {meta("Type", AUDIT_TYPE_LABELS[e.auditType])}
          {meta("Frameworks", e.frameworks.join(", "))}
          {meta("Systems", s.systems.map((x) => x.name).join(", "))}
          {meta("Period", e.periodStart === e.periodEnd ? e.periodStart : `${e.periodStart} to ${e.periodEnd}`)}
          {meta(closed ? "Closed" : "Due", closed ? e.closedAt?.slice(0, 10) : `${e.dueDate} · ${s.daysToDue < 0 ? `${-s.daysToDue} days overdue` : `${s.daysToDue} days left`}`)}
          {e.auditFirm && meta("Audit firm", e.auditFirm)}
        </div>
      </div>

      <AuditTracker engagementId={e.id} closed={closed} filters={filters} onFilter={filterFromTracker} />

      <div className="flex items-center gap-1" style={{ borderBottom: `1px solid ${C.border}` }}>
        {([["controls", "Controls", ListChecks], ["requests", "Requests", Inbox], ["populations", "Data & populations", Database]] as [Tab, string, typeof ListChecks][]).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium transition-colors"
            style={{ color: tab === id ? "#fff" : C.muted, background: tab === id ? C.accentStrong : "transparent" }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {closed && s.snapshot ? (
        tab === "populations" ? <FrozenPopulations populations={s.snapshot.populations} /> : <FrozenControls engagement={e} />
      ) : tab === "controls" ? (
        <EngagementControls engagement={e} canManage={canManage} filters={filters} onFilters={setFilters} />
      ) : tab === "requests" ? (
        <Requests engagement={e} canManage={canManage} />
      ) : (
        <Populations engagement={e} />
      )}

      {closing && <CloseModal engagement={e} onClose={() => setClosing(false)} />}
    </div>
  );
}

// ---- Tracker -----------------------------------------------------------------------
// The audit's summary card, built like the Controls tabs' Control Posture card:
// an anchor figure, one bar per auditor result on a shared baseline, and a
// footer of chips. Bars and chips filter the Controls grid below.
function AuditTracker({ engagementId, closed, filters, onFilter }: {
  engagementId: string;
  closed: boolean;
  filters: EngagementFilters;
  onFilter: (f: EngagementFilters) => void;
}) {
  const engine = useLiveEngine();
  const rows = useMemo(() => engine.engagements.rowsFor(engagementId), [engine, engagementId]);
  const t = engine.engagements.summary(engagementId).tracker;
  const inScope = t.inScope;
  const assessed = inScope - t.notAssessed;
  const pct = inScope ? Math.round((assessed / inScope) * 100) : 0;
  const hatch = `repeating-linear-gradient(135deg, ${C.muted} 0 4px, ${C.panel2} 4px 10px)`;
  const examined = ([
    ["in-place", t.inPlace, C.green],
    ["partial", t.partial, C.amber],
    ["not-in-place", t.notInPlace, C.amber],
  ] as const).map(([key, n, fill]) => ({ key, n, fill })).sort((a, b) => b.n - a.n);
  const present = examined.filter((x) => x.n > 0);
  const zeroed = examined.filter((x) => x.n === 0);
  const sourceIds = ["yours", "central", "provider", "prisma"] as const;
  const sourceCount = (id: (typeof sourceIds)[number]) => rows.filter((r) =>
    id === "yours" ? r.editable : id === "central" ? (r.source === "common" || r.source === "enterprise-attestation") : id === "provider" ? r.source === "provider" : r.prisma).length;
  const sourceLabel = { yours: "System-specific & hybrid", central: "Common & enterprise", provider: "Provider", prisma: "Cyber Assurance" } as const;
  const sourceIcon = { yours: "system", central: "common", provider: "provider", prisma: "prisma" } as const;
  const nc = t.nonconformities;

  return (
    <Panel>
      <SectionHeader icon={Layers} title="Control Tracker" description="What the auditor has concluded, what is still to test, and where each answer comes from." />
      <div className="flex items-center justify-between gap-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3.5 min-w-0">
          <StatRing pct={pct} color={C.accent} trackColor={C.panel2} size={46} stroke={5} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] leading-none font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{assessed}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>of {inScope} assessed</span>
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              Requests accepted {t.requestsAccepted} of {inScope}{!closed ? ` · ${t.drafts} draft${t.drafts === 1 ? "" : "s"} to publish · ${t.flagged} need work` : ""}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{inScope} controls in scope</div>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>
            {t.excluded} excluded · Major {nc.major} · Minor {nc.minor} · OFI {nc.ofi}
          </div>
        </div>
      </div>

      <div className="pt-4">
        {t.notAssessed > 0 && (
          <BarRow label={AUDITOR_RESULT_BADGE["not-assessed"].label} count={t.notAssessed} applicable={inScope} fill={hatch}
            active={filters.result === "not-assessed"} onClick={() => onFilter({ ...filters, result: "not-assessed" })} />
        )}
        <div style={{ marginTop: t.notAssessed > 0 ? 14 : 0 }}>
          {present.map((x) => (
            <BarRow key={x.key} label={AUDITOR_RESULT_BADGE[x.key].label} count={x.n} applicable={inScope} fill={x.fill}
              active={filters.result === x.key} onClick={() => onFilter({ ...filters, result: x.key })} />
          ))}
        </div>
        {zeroed.length > 0 && (
          <div className="grid items-center mt-1.5 gap-3 grid-cols-[92px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(0,1fr)]">
            <span />
            <span className="text-xs" style={{ color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
              {zeroed.map((x) => AUDITOR_RESULT_BADGE[x.key].label).join(", ")} — 0 {zeroed.length === 1 ? "" : "each"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
        <span className="text-[10px] uppercase tracking-wide font-semibold shrink-0" style={{ color: C.muted }}>Source</span>
        {sourceIds.map((id) => sourceCount(id) > 0 && (
          <Chip key={id} label={sourceLabel[id]} count={sourceCount(id)} color={C.muted} bg={sourceMeta(sourceIcon[id]).bg}
            active={filters.source === id} onClick={() => onFilter({ ...filters, source: id })} flat />
        ))}
      </div>
    </Panel>
  );
}

// ---- Requests --------------------------------------------------------------------
// The evidence the audit asks for, one per in-scope row, grouped by what kind of
// evidence it is. GRC marks each accepted on the auditor's behalf.
function Requests({ engagement, canManage }: { engagement: Engagement; canManage: boolean }) {
  const engine = useLiveEngine();
  const rows = useMemo(() => engine.engagements.rowsFor(engagement.id).filter((r) => r.inScope), [engine, engagement.id]);
  const [showAccepted, setShowAccepted] = useState(false);
  const groups = [...new Set(rows.map((r) => r.request.label))].map((label) => ({ label, rows: rows.filter((r) => r.request.label === label) }));

  function toggle(r: (typeof rows)[number]) {
    commit((rt) => saveEngagementControl(rt, {
      ...(r.row ?? { engagementId: r.engagementId, systemId: r.systemId, controlId: r.controlId, inScope: true, result: "not-assessed" }),
      requestAccepted: !r.request.accepted,
      updatedAt: nowIso(),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-1.5 text-xs" style={{ color: C.ink }}>
        <input type="checkbox" checked={showAccepted} onChange={(ev) => setShowAccepted(ev.target.checked)} /> Show accepted requests
      </label>
      {groups.map((g) => {
        const open = g.rows.filter((r) => !r.request.accepted);
        const list = showAccepted ? g.rows : open;
        return (
          <section key={g.label} className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="text-sm font-semibold" style={{ color: C.ink }}>{g.label}</span>
              <span className="text-xs" style={{ color: C.muted }}>{g.rows.length - open.length} of {g.rows.length} accepted</span>
            </div>
            {list.length === 0 && <div className="px-4 py-3 text-xs" style={{ color: C.muted }}>Every request here is accepted.</div>}
            {list.map((r) => (
              <div key={r.key} className="px-4 py-2.5 flex items-start gap-3 text-xs" style={{ borderTop: `1px solid ${C.border}` }}>
                <input type="checkbox" disabled={!canManage} checked={r.request.accepted} onChange={() => toggle(r)} aria-label={`Accept request for ${r.controlId}`} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div><span className="font-mono" style={{ color: C.accent }}>{r.controlId}</span> <span style={{ color: C.ink }}>{r.control.name}</span> <span style={{ color: C.muted }}>· {r.systemName}</span></div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.effective.evidence.length > 0
                      ? r.effective.evidence.map((ev) => <Pill key={ev}>{ev}</Pill>)
                      : <span style={{ color: r.editable ? C.amber : C.muted }}>{r.editable ? "No evidence referenced yet" : "Held centrally"}</span>}
                  </div>
                </div>
                <ResultPill result={r.result} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ---- Populations --------------------------------------------------------------
function Populations({ engagement }: { engagement: Engagement }) {
  const engine = useLiveEngine();
  const sections = engine.engagements.populations(engagement.id);
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-xs" style={{ color: C.muted }}>
        What the auditor samples from, read from the graph for the systems in scope{engagement.periodStart !== engagement.periodEnd ? ` and the period ${engagement.periodStart} to ${engagement.periodEnd}` : ""}. Frozen as counts when the audit closes.
      </p>
      {sections.map((sec) => (
        <section key={sec.key} className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{sec.label}</div>
              <div className="text-xs" style={{ color: C.muted }}>{sec.description}</div>
            </div>
            <div className="text-lg font-semibold" style={{ color: C.ink }}>{sec.total}</div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
            {sec.rows.map((r, i) => <span key={i}>{r.systemName} · {r.label}: <span style={{ color: C.ink }}>{r.count}</span></span>)}
          </div>
        </section>
      ))}
    </div>
  );
}

function FrozenPopulations({ populations }: { populations: Record<string, number> }) {
  return (
    <section className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-xs mb-2" style={{ color: C.muted }}>As they stood when the audit closed.</div>
      {Object.entries(populations).map(([k, v]) => (
        <div key={k} className="flex justify-between text-sm py-1" style={{ color: C.ink }}><span>{k}</span><span>{v}</span></div>
      ))}
    </section>
  );
}

// ---- Frozen controls ---------------------------------------------------------------
// A closed audit shows exactly what it closed on, never a re-derivation.
function FrozenControls({ engagement }: { engagement: Engagement }) {
  const engine = useLiveEngine();
  const snap = engine.graph.snapshotByEngagement[engagement.id];
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = snap.rows.filter((r) => !q || r.controlId.toLowerCase().includes(q) || r.statement.toLowerCase().includes(q));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TextInput value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Search controls" style={{ maxWidth: 260 }} />
        <span className="text-xs" style={{ color: C.muted }}>Frozen at close, {snap.closedAt.slice(0, 10)} · {snap.rows.length} rows</span>
      </div>
      <div className="rounded-xl overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <table className="w-full text-left text-xs border-collapse" style={{ minWidth: 820 }}>
          <thead className="text-[10px] uppercase tracking-wide" style={{ color: C.muted, background: C.panel2 }}>
            <tr><th className="px-3 py-2">Control</th><th className="px-3 py-2">System</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Statement</th><th className="px-3 py-2">Result</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.systemId}-${r.controlId}`} style={{ borderTop: `1px solid ${C.border}`, opacity: r.inScope ? 1 : 0.5 }}>
                <td className="px-3 py-2 font-mono" style={{ color: C.accent }}>{r.controlId}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{engine.graph.systemById[r.systemId]?.name ?? r.systemId}</td>
                <td className="px-3 py-2"><Pill>{SOURCE_LABELS[r.source] ?? r.source}</Pill></td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{r.statement}{!r.inScope && r.justification ? <span style={{ color: C.muted }}> — excluded: {r.justification}</span> : null}</td>
                <td className="px-3 py-2"><ResultPill result={r.result} />{r.nonconformity && <span className="ml-1"><Pill>{NONCONFORMITY_LABELS[r.nonconformity]}</Pill></span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Closing ---------------------------------------------------------------------
function CloseModal({ engagement: e, onClose }: { engagement: Engagement; onClose: () => void }) {
  const engine = useLiveEngine();
  const user = useSignedInUser();
  const [closedAt] = useState(nowIso);
  const preview = useMemo(() => engine.engagements.closePlan(e.id, { closedAt, recordedBy: user.id }), [engine, e.id, closedAt, user.id]);
  // Conflicting drafts start unticked: publishing one overrides a newer answer.
  const [publish, setPublish] = useState<Set<string>>(() => new Set(preview.diff.filter((d) => !d.conflict).map((d) => d.row.key)));
  const [issue, setIssue] = useState(e.focus === "external");
  const [kind, setKind] = useState<CertificationKind>(e.auditType === "type-2" ? "type-2-report" : e.auditType === "type-1" ? "type-1-report" : e.auditType === "hitrust-r2" ? "validated-assessment" : e.auditType === "annual" ? "audit-report" : "certificate");
  const [issuedAt, setIssuedAt] = useState(closedAt.slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() + (kind === "certificate" ? 3 : 1)); return d.toISOString().slice(0, 10); });
  const [reference, setReference] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const t = preview.tracker;

  function close() {
    if (issue && !reference.trim()) { setProblems(["Give the certificate or report a reference."]); return; }
    const plan = engine.engagements.closePlan(e.id, {
      closedAt, recordedBy: user.id,
      certification: issue ? {
        kind, issuedAt, validUntil, auditFirm: e.auditFirm ?? "Internal", reference: reference.trim(),
        ...(e.periodStart !== e.periodEnd ? { periodStart: e.periodStart, periodEnd: e.periodEnd } : {}),
      } : null,
    });
    const published = plan.published.filter((p) => publish.has(`${e.id}::${p.systemId}::${p.controlId}`));
    const errs = commit((rt) => applyEngagementClose(rt, { ...plan, published }));
    if (errs.length) setProblems(errs);
    else onClose();
  }

  return (
    <Modal open onClose={onClose} width={860} height={780}>
      <div className="flex items-center justify-between px-6 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h2 className="m-0 text-lg font-semibold" style={{ color: C.ink }}>Close {e.name}</h2>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 text-xs">
        <div style={{ color: C.muted }}>
          Closing freezes the audit exactly as it stands — {t.inScope} controls in scope: {t.inPlace} in place, {t.partial} partial, {t.notInPlace} not in place, {t.notAssessed} not assessed — and publishes the drafts you tick below to the system of record as new versions. Earlier versions stay readable in each record's history.
        </div>

        <section>
          <h3 className="m-0 mb-2 text-sm font-semibold" style={{ color: C.ink }}>Changes to publish ({publish.size} of {preview.diff.length})</h3>
          {preview.diff.length === 0 && <div style={{ color: C.muted }}>This audit drafted no changes. Nothing will be published.</div>}
          <div className="flex flex-col gap-2">
            {preview.diff.map((d) => {
              const on = publish.has(d.row.key);
              return (
                <label key={d.row.key} className="rounded-lg px-3 py-2.5 flex gap-3 cursor-pointer" style={{ border: `1px solid ${d.conflict ? C.red : C.border}` }}>
                  <input type="checkbox" checked={on} onChange={() => setPublish((cur) => { const n = new Set(cur); if (n.has(d.row.key)) n.delete(d.row.key); else n.add(d.row.key); return n; })} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono" style={{ color: C.accent }}>{d.row.controlId}</span>
                      <span style={{ color: C.ink }}>{d.row.control.name} · {d.row.systemName}</span>
                      {d.conflict && <Pill color="red">The record changed after this audit started</Pill>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>Current {d.before ? `· ${d.before.status}` : ""}</div>
                        <div style={{ color: C.muted }}>{d.before?.statement ?? "Not recorded"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>After · {d.after.status}</div>
                        <div style={{ color: C.ink }}>{d.after.statement}</div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <label className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: C.ink }}>
            <input type="checkbox" checked={issue} onChange={(ev) => setIssue(ev.target.checked)} /> Record the certificate or report this audit produced
          </label>
          {issue && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <Select value={kind} onChange={(ev) => setKind(ev.target.value as CertificationKind)}>
                  {CERTIFICATION_KINDS.map((k) => <option key={k} value={k}>{CERTIFICATION_KIND_LABELS[k]}</option>)}
                </Select>
              </Field>
              <Field label="Reference"><TextInput value={reference} onChange={(ev) => setReference(ev.target.value)} placeholder="Certificate number or report title" /></Field>
              <Field label="Issued"><TextInput type="date" value={issuedAt} onChange={(ev) => setIssuedAt(ev.target.value)} /></Field>
              <Field label="Valid until"><TextInput type="date" value={validUntil} onChange={(ev) => setValidUntil(ev.target.value)} /></Field>
            </div>
          )}
        </section>

        {t.notInPlace + t.partial > 0 && (
          <div className="rounded-md px-3 py-2" style={{ background: C.amberBg, color: C.ink }}>
            {t.notInPlace + t.partial} control{t.notInPlace + t.partial === 1 ? "" : "s"} closed partial or not in place. Raise a finding for each from the system's Controls tab so the corrective action is tracked.
          </div>
        )}
        {problems.length > 0 && <div className="rounded-md px-3 py-2" style={{ color: C.red, background: C.redBg }}>{problems.slice(0, 4).map((p) => <div key={p}>{p}</div>)}</div>}
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon={Lock} onClick={close}>Close and publish</Button>
      </div>
    </Modal>
  );
}
