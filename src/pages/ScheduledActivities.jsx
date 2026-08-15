import React, { useState } from "react";
import { CalendarClock, Layers, Info } from "lucide-react";
import { C } from "../theme";
import { PageHeader, SectionHeading } from "../components/Headings";
import {
  FREQUENCIES, PERIODS_PER_YEAR, PERIOD_LABELS, ACTIVITY_TYPES, STATUS_META, CURRENT_YEAR,
  activitiesForFrequency, currentPeriod, statusCountsForPeriod, parseLocalDate,
} from "../data/scheduledActivities";
import { STANDARD_ABBR } from "../data/policies";

function formatShortDate(iso) {
  return parseLocalDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusCell({ instance }) {
  if (!instance) {
    return <div className="rounded-lg px-2.5 py-2 text-center text-[10px]" style={{ color: C.muted }}>—</div>;
  }
  const meta = STATUS_META[instance.status];
  const color = C[meta.color];
  const dateLabel = instance.completedAt
    ? formatShortDate(instance.completedAt)
    : instance.status === "in_progress"
    ? "In progress"
    : `Due ${formatShortDate(instance.dueDate)}`;
  return (
    <div
      className="rounded-lg px-2 py-2 text-center"
      style={{ background: `${color}1F`, border: `1px solid ${color}40` }}
      title={instance.note || meta.label}
    >
      <div className="text-sm font-bold leading-none" style={{ color }}>{meta.symbol}</div>
      <div className="text-[9px] mt-1 leading-tight" style={{ color }}>{dateLabel}</div>
    </div>
  );
}

const SCOPE_NOTE = {
  Monthly: "Monthly is currently a single real activity — SOP-05's Critical-tier risk review — not a placeholder table waiting to be filled. Its High-tier sibling is quarterly and Medium/Low is annual.",
  Quarterly: "Access recertification, vulnerability scanning, physical access review, monitoring signal review, and the High-tier slice of risk review — everything on a real quarterly cadence.",
  Annual: "Penetration testing, IR plan testing, Tier 1 restore testing, security awareness training, and critical-vendor reassessment. Standard-tier vendor reassessment (every 2 years) and standard access recertification (semi-annual) don't fit any of these three tabs — they're not shown anywhere yet.",
};

export default function ScheduledActivities({ onNavigate }) {
  const [frequency, setFrequency] = useState("Quarterly");

  const items = activitiesForFrequency(frequency);
  const periodCount = PERIODS_PER_YEAR[frequency];
  const periodLabels = PERIOD_LABELS[frequency];
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  const current = currentPeriod(frequency);
  const counts = statusCountsForPeriod(frequency, current);
  const activityColWidth = frequency === "Monthly" ? 26 : frequency === "Annual" ? 46 : 38;
  const ownerColWidth = frequency === "Monthly" ? 10 : 14;
  const periodColWidth = (100 - activityColWidth - ownerColWidth) / periodCount;

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={CalendarClock}
        title="Governance Schedule"
        tagline="Control Timeliness"
        description="Every control that runs on a fixed cadence, grouped by activity type and tracked against its real due date."
        descriptionClassName="max-w-none whitespace-nowrap"
      />

      <div className="px-8 pb-5">
        <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: frequency === f ? C.accent : "transparent", color: frequency === f ? "#fff" : C.muted }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 pb-5">
        <div className="rounded-xl p-4 flex items-center gap-2 flex-wrap" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md" style={{ background: C.panel2 }}>
              <span style={{ color: C[meta.color], fontWeight: 700 }}>{meta.symbol}</span>
              <span style={{ color: C.ink }}>{meta.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pb-6">
        <div className="text-xs uppercase tracking-wide mb-2 font-medium" style={{ color: C.muted }}>
          {frequency === "Annual" ? `FY ${CURRENT_YEAR}` : `${periodLabels[current - 1]} ${CURRENT_YEAR}`} — current {frequency.toLowerCase()} period at a glance
        </div>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className="rounded-xl p-4 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="text-3xl font-semibold" style={{ color: C[meta.color], fontFamily: "'Source Serif 4', serif" }}>{counts[key]}</div>
              <div className="text-[11px] mt-1" style={{ color: C.muted }}>{meta.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pb-6">
        <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg p-3" style={{ background: C.accentBg, color: C.ink }}>
          <Info size={13} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
          <span>{SCOPE_NOTE[frequency]}</span>
        </div>
      </div>

      <div className="px-8 pb-12 space-y-6">
        {ACTIVITY_TYPES.map((type) => {
          const typeItems = items.filter((a) => a.type === type);
          if (typeItems.length === 0) return null;
          return (
            <div key={type}>
              <SectionHeading icon={Layers}>{type}</SectionHeading>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.panel }}>
                {/* table-layout: fixed + an identical <colgroup> in every
                    section's table (for the current frequency) is what keeps
                    the period columns aligned down the page — without it,
                    each <table> sizes its own columns from its own content,
                    so a longer activity description in one section shifts
                    that section's columns out of line with every other
                    section's. */}
                <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: `${activityColWidth}%` }} />
                    <col style={{ width: `${ownerColWidth}%` }} />
                    {periods.map((p) => <col key={p} style={{ width: `${periodColWidth}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background: C.panel2 }}>
                      <th className="text-left text-[10px] uppercase tracking-wide px-3 py-2 font-medium" style={{ color: C.muted }}>Activity</th>
                      <th className="text-left text-[10px] uppercase tracking-wide px-3 py-2 font-medium" style={{ color: C.muted }}>Owner</th>
                      {periods.map((p) => (
                        <th
                          key={p}
                          className="text-center text-[10px] uppercase tracking-wide px-1 py-2 font-medium"
                          style={{ color: p === current ? C.accent : C.muted }}
                        >
                          {periodLabels[p - 1]}{frequency !== "Monthly" ? ` ${CURRENT_YEAR}` : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {typeItems.map((a) => (
                      <tr key={a.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td className="px-3 py-3 align-top">
                          <div className="text-sm font-semibold" style={{ color: C.ink }}>{a.title}</div>
                          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{a.description}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {a.controls.map((id) => (
                              <span key={id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.panel2, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                                {id}
                              </span>
                            ))}
                            <button
                              onClick={() => onNavigate && onNavigate("procedure-library")}
                              className="text-[11px] font-medium"
                              style={{ color: C.accent }}
                            >
                              {a.procedureCode} · {a.procedureTitle}
                            </button>
                          </div>
                          {a.standards.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {a.standards.map((std) => (
                                <span
                                  key={std}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: C.greenBg, color: C.green }}
                                  title={`${std}: ${a.frameworkClauses[std].join(", ")}`}
                                >
                                  {STANDARD_ABBR[std]}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-xs" style={{ color: C.muted }}>{a.owner}</td>
                        {periods.map((p) => (
                          <td key={p} className="px-1.5 py-2 align-top">
                            <StatusCell instance={a.instances.find((i) => i.period === p)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg p-3" style={{ background: C.panel2, color: C.muted }}>
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            Past-period completion dates are seed data (this app has no real historical completion log yet); every
            status badge itself is computed live from each item's real due date against today, never hand-typed.
          </span>
        </div>
      </div>
    </div>
  );
}
