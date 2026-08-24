import React, { useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock3,
  Filter, Search, ShieldAlert, ShieldCheck, SlidersHorizontal,
} from "lucide-react";
import { PageHeader, SectionHeading } from "../components/Headings";
import { C } from "../theme";
import { EXCEPTION_REGISTER, EXCEPTION_SUMMARY } from "../engine";
import type { ExceptionLifecycleStatus, ExceptionReviewStatus, ManagedException } from "../engine";

type StatusFilter = "all" | ExceptionLifecycleStatus;

const STATUS_META: Record<ExceptionLifecycleStatus, { label: string; color: string; background: string }> = {
  active: { label: "Active", color: C.green, background: C.greenBg },
  expiring: { label: "Expiring", color: C.amber, background: C.amberBg },
  expired: { label: "Expired", color: C.red, background: C.redBg },
};

const REVIEW_META: Record<ExceptionReviewStatus, { label: string; color: string }> = {
  current: { label: "Review current", color: C.green },
  "due-soon": { label: "Review due soon", color: C.amber },
  overdue: { label: "Review overdue", color: C.red },
};

function friendly(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }: { status: ExceptionLifecycleStatus }) {
  const meta = STATUS_META[status];
  return <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: meta.color, background: meta.background }}>{meta.label}</span>;
}

function Metric({ label, value, detail, tone = C.ink }: { label: string; value: number; detail: string; tone?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="text-2xl font-semibold" style={{ color: tone, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
      <div className="text-xs font-semibold mt-1" style={{ color: C.ink }}>{label}</div>
      <div className="text-[11px] mt-1" style={{ color: C.muted }}>{detail}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

function ExceptionDetail({ exception }: { exception: ManagedException }) {
  const reviewMeta = REVIEW_META[exception.reviewStatus];
  return (
    <div className="rounded-xl p-5 sticky top-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{exception.id}</div>
        <StatusBadge status={exception.status} />
      </div>
      <h2 className="text-xl leading-snug mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{exception.title}</h2>
      <div className="text-xs capitalize mb-5" style={{ color: C.muted }}>{friendly(exception.condition)}</div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 mb-5">
        <DetailField label="System" value={exception.system?.name ?? exception.systemId} />
        <DetailField label="Risk owner" value={exception.owner?.name ?? exception.ownerId} />
        <DetailField label="Approved by" value={exception.approver?.name ?? exception.approvedBy} />
        <DetailField label="Approved" value={exception.approvedAt} />
        <DetailField label="Next review" value={<span style={{ color: reviewMeta.color }}>{exception.reviewDueAt} - {reviewMeta.label}</span>} />
        <DetailField label="Expires" value={exception.expiresAt ?? "No expiration recorded"} />
      </div>

      <div className="mb-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Business justification</div>
        <p className="text-xs leading-relaxed" style={{ color: C.ink }}>{exception.reason}</p>
      </div>

      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Compensating controls</div>
        <div className="space-y-2">
          {exception.compensatingControls.map((control) => (
            <div key={control} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: C.ink }}>
              <ShieldCheck size={13} className="mt-0.5 shrink-0" color={C.green} /> {control}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Affected assets</div>
          <div className="flex flex-wrap gap-1.5">
            {exception.affectedAssets.map((asset) => <span key={asset.id} className="text-[11px] rounded px-2 py-1" style={{ background: C.panel2, color: C.ink }}>{asset.name}</span>)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: C.muted }}>Linked controls</div>
          <div className="flex flex-wrap gap-1.5">
            {exception.controls.map((control) => <span key={control.id} title={control.name} className="text-[11px] rounded px-2 py-1" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{control.id}</span>)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg p-3" style={{ background: C.panel2 }}>
        <div className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: C.ink }}><CalendarClock size={13} color={C.accent} /> Governance lifecycle</div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: C.muted }}>
          <span style={{ color: C.green }}>Approved {exception.approvedAt}</span>
          <ChevronRight size={11} />
          <span style={{ color: reviewMeta.color }}>Review {exception.reviewDueAt}</span>
          <ChevronRight size={11} />
          <span style={{ color: exception.status === "expired" ? C.red : C.muted }}>Expire {exception.expiresAt ?? "not set"}</span>
        </div>
      </div>
    </div>
  );
}

export default function ExceptionRegister() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [systemId, setSystemId] = useState("all");
  const [selectedId, setSelectedId] = useState(EXCEPTION_REGISTER[0]?.id ?? "");

  const systems = useMemo(() => Array.from(new Map(EXCEPTION_REGISTER.map((exception) => [exception.systemId, exception.system])).entries()), []);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return EXCEPTION_REGISTER.filter((exception) => {
      const matchesQuery = !normalizedQuery || [exception.id, exception.title, exception.condition, exception.reason, exception.system?.name, exception.owner?.name]
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
      return matchesQuery && (status === "all" || exception.status === status) && (systemId === "all" || exception.systemId === systemId);
    });
  }, [query, status, systemId]);

  const selected = filtered.find((exception) => exception.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="w-full pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={ShieldAlert}
        title="Exception Register"
        tagline="Governed risk acceptance"
        description="The authoritative register for approved security exceptions, their owners, compensating controls, review dates, and expiration decisions."
      />

      <div className="px-4 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric label="Total Exceptions" value={EXCEPTION_SUMMARY.total} detail="Formally governed records" />
        <Metric label="Active" value={EXCEPTION_SUMMARY.active} detail="Approved and within lifecycle" tone={C.green} />
        <Metric label="Expiring" value={EXCEPTION_SUMMARY.expiring} detail="Expiration within 90 days" tone={C.amber} />
        <Metric label="Review Required" value={EXCEPTION_SUMMARY.reviewDue} detail="Due soon or overdue" tone={EXCEPTION_SUMMARY.reviewDue > 0 ? C.red : C.green} />
      </div>

      <div className="px-4 lg:px-8 mb-5">
        <SectionHeading icon={SlidersHorizontal} hint="Find an exception by system, owner, condition, or lifecycle state">Register Filters</SectionHeading>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 min-w-72" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <Search size={14} color={C.muted} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exceptions" className="bg-transparent outline-none text-sm w-full" style={{ color: C.ink }} />
          </div>
          <label className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <Filter size={13} color={C.muted} />
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="bg-transparent outline-none text-sm" style={{ color: C.ink }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <select value={systemId} onChange={(event) => setSystemId(event.target.value)} className="rounded-lg px-3 py-2 outline-none text-sm" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}>
            <option value="all">All systems</option>
            {systems.map(([id, system]) => <option key={id} value={id}>{system?.name ?? id}</option>)}
          </select>
        </div>
      </div>

      <div className="px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] gap-5 items-start">
        <div className="rounded-xl overflow-hidden max-lg:overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="grid px-4 py-2.5 text-[10px] uppercase tracking-wide font-semibold min-w-[460px]" style={{ gridTemplateColumns: "1fr 130px 100px 110px", color: C.muted, background: C.panel2 }}>
            <div>Exception</div><div>System</div><div>Status</div><div>Next review</div>
          </div>
          {filtered.map((exception) => {
            const isSelected = exception.id === selected?.id;
            const reviewMeta = REVIEW_META[exception.reviewStatus];
            return (
              <button
                key={exception.id}
                type="button"
                onClick={() => setSelectedId(exception.id)}
                className="w-full grid items-center text-left px-4 py-3.5 transition-colors min-w-[460px]"
                style={{ gridTemplateColumns: "1fr 130px 100px 110px", background: isSelected ? C.accentBg : "transparent", borderTop: `1px solid ${C.border}` }}
              >
                <div className="min-w-0 pr-4">
                  <div className="text-[10px] mb-0.5" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{exception.id}</div>
                  <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{exception.title}</div>
                  <div className="text-[11px] mt-0.5 capitalize" style={{ color: C.muted }}>{friendly(exception.condition)}</div>
                </div>
                <div className="text-xs pr-3" style={{ color: C.ink }}>{exception.system?.name ?? exception.systemId}</div>
                <div><StatusBadge status={exception.status} /></div>
                <div className="text-[11px]" style={{ color: reviewMeta.color }}>{exception.reviewDueAt}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center">
              <CheckCircle2 size={24} color={C.green} className="mx-auto mb-2" />
              <div className="text-sm font-semibold" style={{ color: C.ink }}>No exceptions match these filters</div>
              <div className="text-xs mt-1" style={{ color: C.muted }}>Adjust the search, status, or system filter.</div>
            </div>
          )}
        </div>

        {selected ? <ExceptionDetail exception={selected} /> : (
          <div className="rounded-xl p-6 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <Clock3 size={22} color={C.muted} className="mx-auto mb-2" />
            <div className="text-sm" style={{ color: C.muted }}>Select an exception to review its governance record.</div>
          </div>
        )}
      </div>

      {EXCEPTION_SUMMARY.expired > 0 && (
        <div className="mx-4 lg:mx-8 mt-5 rounded-lg p-3 flex items-start gap-2 text-xs" style={{ background: C.redBg, color: C.red }}>
          <AlertTriangle size={14} className="shrink-0" /> Expired exceptions require renewal, revocation, or closure; they no longer excuse the underlying condition.
        </div>
      )}
    </div>
  );
}
