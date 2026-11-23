import React, { useMemo, useState } from "react";
import { ClipboardCheck, Plus, ArrowRight, Award } from "lucide-react";
import { C } from "../../theme";
import { PageHeader } from "../../components/Headings";
import Modal, { ModalCloseButton } from "../../components/Modal";
import { Button, Field, Select, TextInput } from "../../components/wizard/WizardUI";
import { useLiveEngine } from "../../engine/useLiveEngine";
import { useSignedInUser } from "../../auth/useUser";
import { allows, canManageEngagement } from "../../auth/gates";
import { nextEngagementId, saveEngagement } from "../../engine/runtimeMutations";
import { HITRUST_R2_STANDARD } from "../../graph/nodes/providerCertifications";
import {
  AUDIT_TYPES, AUDIT_TYPE_LABELS, CERTIFICATION_KIND_LABELS, ENGAGEMENT_STATUS_META,
  type AuditType, type Engagement, type EngagementFocus,
} from "../../graph/nodes/engagements";
import type { SystemId } from "../../graph/ids";
import { commit, nowIso, today, Pill, TrackerBar } from "./shared";
import { EngagementDetail } from "./EngagementDetail";

// Audits: every engagement, open ones first, and the certificates and reports
// ACME holds. An engagement opens in place; there is no wizard to run one —
// the work is a grid (EngagementDetail).
export default function Audits() {
  const engine = useLiveEngine();
  const user = useSignedInUser();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = allows(canManageEngagement(user));

  const engagements = engine.engagements.all();
  if (openId && engine.graph.engagementById[openId]) {
    return <EngagementDetail engagementId={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={ClipboardCheck}
        title="Audits"
        description="Engagements against the system of record: what is in scope, what the auditor concluded, and what each one published back when it closed."
        right={canManage ? <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New audit</Button> : undefined}
      />
      <div className="px-4 lg:px-8 pb-10 flex flex-col gap-6">
        <section className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {engagements.length === 0 && <div className="p-6 text-sm" style={{ color: C.muted }}>No audits yet.</div>}
          {engagements.map((e) => {
            const s = engine.engagements.summary(e.id);
            const t = s.tracker;
            const status = ENGAGEMENT_STATUS_META[e.status];
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setOpenId(e.id)}
                className="w-full text-left grid gap-4 px-5 py-4 wz-hover items-center"
                style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1.6fr) 120px 16px", borderBottom: `1px solid ${C.border}` }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: C.ink }}>{e.name}</span>
                    <Pill color={status.color}>{status.label}</Pill>
                    <Pill>{e.focus === "external" ? "External" : "Internal"}</Pill>
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    {AUDIT_TYPE_LABELS[e.auditType]} · {e.frameworks.join(", ")} · {s.systems.map((x) => x.name).join(", ")}
                    {e.auditFirm ? ` · ${e.auditFirm}` : ""}
                  </div>
                </div>
                <div className="min-w-0">
                  <TrackerBar counts={{ "not-assessed": t.notAssessed, "in-place": t.inPlace, partial: t.partial, "not-in-place": t.notInPlace }} />
                </div>
                <div className="text-right text-xs" style={{ color: C.muted }}>
                  {e.status === "closed" ? (
                    <>Closed<div style={{ color: C.ink }}>{e.closedAt?.slice(0, 10)}</div></>
                  ) : (
                    <>Due {e.dueDate}<div style={{ color: s.daysToDue < 0 ? C.red : s.daysToDue <= 30 ? C.amber : C.ink }}>
                      {s.daysToDue < 0 ? `${-s.daysToDue} days overdue` : `${s.daysToDue} days left`}
                    </div></>
                  )}
                </div>
                <ArrowRight size={15} color={C.muted} />
              </button>
            );
          })}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: C.ink }}><Award size={15} /> Certificates & reports</h2>
          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            {[...engine.graph.certifications].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((c) => {
              const current = Date.parse(c.validUntil) >= engine.ctx.now.getTime();
              return (
                <div key={c.id} className="px-5 py-3 flex items-start justify-between gap-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: C.ink }}>
                      {c.standard} {CERTIFICATION_KIND_LABELS[c.kind]}
                      <span className="ml-2"><Pill color={current ? "green" : "muted"}>{current ? "Current" : "Expired"}</Pill></span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>
                      {c.auditFirm} · {c.systemIds.map((id) => engine.graph.systemById[id]?.name ?? id).join(", ")}
                      {c.periodStart ? ` · period ${c.periodStart} to ${c.periodEnd}` : ""}
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>{c.reference}</div>
                  </div>
                  <div className="text-right text-xs shrink-0" style={{ color: C.muted }}>
                    Issued {c.issuedAt}<div>Valid until <span style={{ color: C.ink }}>{c.validUntil}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {creating && <NewEngagementModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />}
    </div>
  );
}

function NewEngagementModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const engine = useLiveEngine();
  const frameworkOptions = useMemo(() => [...engine.compliance.IN_SCOPE_FRAMEWORKS, HITRUST_R2_STANDARD], [engine]);
  const year = new Date().getFullYear();
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<EngagementFocus>("external");
  const [auditType, setAuditType] = useState<AuditType>("certification");
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [systemIds, setSystemIds] = useState<SystemId[]>([]);
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [auditFirm, setAuditFirm] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const systems = engine.graph.systems;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  function toggleFramework(f: string) {
    const next = toggle(frameworks, f);
    setFrameworks(next);
    // Systems that certify against a chosen framework are the natural scope; the person can still change it.
    setSystemIds(systems.filter((s) => s.standards.some((std) => next.includes(std))).map((s) => s.id));
  }

  function create() {
    const issues: string[] = [];
    if (!name.trim()) issues.push("Name the audit.");
    if (frameworks.length === 0) issues.push("Choose at least one framework.");
    if (systemIds.length === 0) issues.push("Choose at least one system.");
    if (focus === "external" && !auditFirm.trim()) issues.push("An external audit needs an audit firm.");
    if (issues.length) { setProblems(issues); return; }
    const id = nextEngagementId(engine.graph.engagements, year);
    const engagement: Engagement = {
      id, name: name.trim(), focus, auditType, status: "preparing", frameworks, systemIds,
      periodStart, periodEnd, dueDate, ...(auditFirm.trim() ? { auditFirm: auditFirm.trim() } : {}),
      ownerId: "grc", startedAt: nowIso(),
    };
    const result = commit((rt) => saveEngagement(rt, engagement));
    if (result.length) setProblems(result);
    else onCreated(id);
  }

  const chip = (on: boolean) => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : "transparent", color: on ? C.accent : C.ink });

  return (
    <Modal open onClose={onClose} width={720} height={720}>
      <div className="flex items-center justify-between px-6 pt-5 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-semibold" style={{ color: C.ink }}>New audit</h2>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        <p className="m-0 text-xs" style={{ color: C.muted }}>
          The audit reads each system's current control records when it starts. Anything you change during it is kept as a draft and published back when it closes.
        </p>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ISO 27001 Surveillance 2027" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Focus">
            <Select value={focus} onChange={(e) => setFocus(e.target.value as EngagementFocus)}>
              <option value="external">External — an audit firm</option>
              <option value="internal">Internal — readiness or internal audit</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={auditType} onChange={(e) => setAuditType(e.target.value as AuditType)}>
              {AUDIT_TYPES.map((t) => <option key={t} value={t}>{AUDIT_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Frameworks">
          <div className="flex flex-wrap gap-1.5">
            {frameworkOptions.map((f) => (
              <button key={f} type="button" onClick={() => toggleFramework(f)} className="text-xs px-2.5 py-1.5 rounded-full" style={chip(frameworks.includes(f))}>{f}</button>
            ))}
          </div>
        </Field>
        <Field label="Systems in scope" note="A certificate or report usually covers several systems.">
          <div className="flex flex-wrap gap-1.5">
            {systems.map((s) => (
              <button key={s.id} type="button" onClick={() => setSystemIds(toggle(systemIds, s.id))} className="text-xs px-2.5 py-1.5 rounded-full" style={chip(systemIds.includes(s.id))}>{s.name}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Period starts"><TextInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
          <Field label="Period ends"><TextInput type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
          <Field label="Due"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label={focus === "external" ? "Audit firm" : "Audit firm (optional)"}><TextInput value={auditFirm} onChange={(e) => setAuditFirm(e.target.value)} /></Field>
        {problems.length > 0 && (
          <div className="text-xs rounded-md px-3 py-2" style={{ color: C.red, background: C.redBg }}>{problems.slice(0, 4).map((p) => <div key={p}>{p}</div>)}</div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={create}>Create audit</Button>
      </div>
    </Modal>
  );
}
