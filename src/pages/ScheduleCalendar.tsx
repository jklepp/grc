// The Governance Schedule as a calendar, a month or a year at a time — every
// cadence on one timeline, where the table splits them into tabs. Layout
// follows Homeviz's Calendar: a grid that shows where the work bunches up,
// and under it a list of only the days with work, which says what. Below
// `lg` the seven-column grid is unreadable, so the list is the whole view.
//
// Colour is status (the same STATUS_META the table uses), never activity
// type: nine types is too many hues, and the type is always printed in words.
// Each instance sits on its due date; a completed one says when it was done.
// Picking an activity opens its row in the table, which carries the controls,
// SOP, and framework detail an auditor needs. Compliance milestones (ISO 27001
// and SOC 2 cycles, vendor report expiries — complianceMilestones.ts) have no table row,
// so they carry a shield mark and print their note in full instead.
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Info, ShieldCheck } from "lucide-react";
import { C } from "../theme";
import {
  STATUS_META, ACTIVITY_FIRST_YEAR, ACTIVITY_LAST_YEAR, parseLocalDate,
} from "../data/scheduledActivities";
import type { ScheduleCalendarEntry } from "../data/scheduledActivities";
import { activityColor } from "./scheduleView";
import {
  MONTH_NAMES, WEEKDAYS, monthGrid, monthLabel, monthsIn, parseMonth, shiftMonth, todayIso, weekdayOf,
} from "../utils/calendarGrid";
import type { GridDay } from "../utils/calendarGrid";

// Entries listed per month block in the year view before the rest are summarised.
const SHOWN_PER_MONTH = 6;
// Entries drawn per day cell in the month grid.
const SHOWN_PER_DAY = 3;

// The span the calendar pages through: every year that has anything on it.
interface YearRange { first: number; last: number }

function yearRangeOf(entries: ScheduleCalendarEntry[]): YearRange {
  const years = entries.map((e) => Number(e.dueDate.slice(0, 4)));
  return { first: Math.min(...years), last: Math.max(...years) };
}

const dayAnchor = (date: string) => `schedule-day-${date}`;

function entriesOn(entries: ScheduleCalendarEntry[], date: string): ScheduleCalendarEntry[] {
  return entries.filter((e) => e.dueDate === date);
}

// A month ("2026-03") or a whole year ("2026-").
function entriesIn(entries: ScheduleCalendarEntry[], prefix: string): ScheduleCalendarEntry[] {
  return entries.filter((e) => e.dueDate.startsWith(prefix));
}

function countsOf(entries: ScheduleCalendarEntry[]) {
  const done = entries.filter((e) => e.status === "completed").length;
  return { open: entries.length - done, done, overdue: entries.filter((e) => e.status === "overdue").length };
}

function countsLabel(entries: ScheduleCalendarEntry[]): string {
  const { open, done } = countsOf(entries);
  if (open === 0 && done === 0) return "Nothing due";
  return [open > 0 ? `${open} open` : null, done > 0 ? `${done} done` : null].filter(Boolean).join(" · ");
}

function shortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The words beside an entry: what it is, when it was done, what state it's in.
function entryDetail(e: ScheduleCalendarEntry): string {
  const state = e.completedAt ? `Done ${shortDate(e.completedAt)}` : STATUS_META[e.status].label;
  return `${e.type} · ${e.cadence} · ${e.owner} · ${state}`;
}

function entryTooltip(e: ScheduleCalendarEntry): string {
  return `${e.title} — ${entryDetail(e)}${e.note ? `\n${e.note}` : ""}`;
}

// The look shared by chips, lines, and rows. Status sets the symbol and the
// bar; completed work stays, quieter; overdue work gets a tinted background.
// Compliance milestones are drawn in the accent instead — tinted fill, accent
// border and bar — so a renewal date never reads as one more routine review.
// Status still shows on them: an overdue milestone keeps the overdue bar and
// symbol, and a completed one fades like any other.
function entryLook(e: ScheduleCalendarEntry) {
  const meta = STATUS_META[e.status];
  const color = activityColor(meta.color);
  const done = e.status === "completed";
  const overdue = e.status === "overdue";
  if (e.kind === "milestone") {
    return {
      symbol: meta.symbol,
      color,
      done,
      bar: done ? `${C.accent}66` : overdue ? color : C.accent,
      background: done ? "transparent" : `${C.accent}33`,
      rowBackground: done ? "transparent" : `${C.accent}26`,
      border: done ? `${C.accent}40` : C.accent,
      text: done ? C.muted : C.ink,
      weight: done ? 400 : 600,
    };
  }
  return {
    symbol: meta.symbol,
    color,
    done,
    bar: done ? C.border : color,
    background: overdue ? C.redBg : done ? "transparent" : C.panel2,
    rowBackground: overdue ? C.redBg : done ? "transparent" : C.panel,
    border: overdue ? "transparent" : C.border,
    text: done ? C.muted : C.ink,
    weight: undefined as number | undefined,
  };
}

// ---- Shared chrome ------------------------------------------------------

function NavButton({ onClick, disabled, title, children }: {
  onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="rounded-full p-2 inline-flex transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.ink }}
    >
      {children}
    </button>
  );
}

function Pill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
      style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.muted }}
    >
      {children}
    </button>
  );
}

function CalendarNav({ label, icon: Icon, summary, onPrev, onNext, prevDisabled, nextDisabled, prevTitle, nextTitle, children }: {
  label: string; icon: typeof CalendarDays; summary: string;
  onPrev: () => void; onNext: () => void; prevDisabled: boolean; nextDisabled: boolean;
  prevTitle: string; nextTitle: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <NavButton onClick={onPrev} disabled={prevDisabled} title={prevTitle}><ChevronLeft size={16} /></NavButton>
      <span
        className="rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 justify-center min-w-[10rem]"
        style={{ border: `1px solid ${C.border}`, background: C.panel, color: C.ink }}
      >
        <Icon size={14} color={C.muted} /> {label}
      </span>
      <NavButton onClick={onNext} disabled={nextDisabled} title={nextTitle}><ChevronRight size={16} /></NavButton>
      <span className="text-xs ml-1" style={{ color: C.muted }}>{summary}</span>
      <span className="ml-auto flex items-center gap-2">{children}</span>
    </div>
  );
}

// Marks a compliance milestone wherever an entry is drawn.
function MilestoneMark({ size = 11 }: { size?: number }) {
  return <ShieldCheck size={size} color={C.accent} className="shrink-0" aria-label="Compliance milestone" />;
}

// A row in the day lists: colour bar, title, the words. An activity links to
// its table row; a milestone has no row, so it prints its note instead.
function EntryRow({ entry, onOpen }: { entry: ScheduleCalendarEntry; onOpen: (e: ScheduleCalendarEntry) => void }) {
  const look = entryLook(entry);
  const milestone = entry.kind === "milestone";
  const body = (
    <>
      <span className="w-1 self-stretch min-h-8 rounded-full shrink-0" style={{ background: look.bar }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: look.text }}>
          {milestone && <MilestoneMark size={13} />}
          {entry.title}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: C.muted }}>{entryDetail(entry)}</span>
        {milestone && entry.note && (
          <span className="block text-xs mt-1 leading-relaxed" style={{ color: C.ink }}>{entry.note}</span>
        )}
      </span>
      <span className="text-sm font-bold shrink-0" style={{ color: look.color }}>{look.symbol}</span>
      {!milestone && <ChevronRight size={14} color={C.muted} className="shrink-0" />}
    </>
  );
  const className = "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors";
  const style = { background: look.rowBackground, border: `1px solid ${look.border}` };
  if (milestone) return <div className={className} style={style}>{body}</div>;
  return (
    <button onClick={() => onOpen(entry)} title={entry.note || "Open in the table"} className={className} style={style}>
      {body}
    </button>
  );
}

// Weekday over day number, like a tear-off page; one line on a phone.
function DateMark({ date, isToday }: { date: string; isToday: boolean }) {
  return (
    <div className="flex items-baseline gap-2 lg:flex-col lg:items-start lg:gap-1 lg:pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        {WEEKDAYS[weekdayOf(date)]}
      </span>
      <span
        className="text-2xl leading-none inline-grid place-items-center"
        style={{
          fontFamily: "'Source Serif 4', serif",
          fontWeight: 600,
          ...(isToday
            ? { background: C.ink, color: C.bg, borderRadius: 9999, height: 36, minWidth: 36, padding: "0 6px" }
            : { color: C.ink }),
        }}
      >
        {Number(date.slice(8, 10))}
      </span>
    </div>
  );
}

// Days with work, in order: the date beside that day's rows. `entries` limits
// which of a day's entries are listed (the year view's Open/Completed tabs);
// `anchored` gives each day the id the month grid scrolls to.
function DayRows({ dates, entries, selected = null, anchored = false, onOpen }: {
  dates: string[]; entries: ScheduleCalendarEntry[]; selected?: string | null; anchored?: boolean;
  onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const today = todayIso();
  return (
    <ol className="space-y-1">
      {dates.map((date) => (
        <li
          key={date}
          id={anchored ? dayAnchor(date) : undefined}
          className="grid gap-2 rounded-xl px-3 py-3 scroll-mt-24 transition-colors lg:grid-cols-[4.5rem_1fr] lg:gap-4"
          style={{ background: date === selected ? C.accentBg : "transparent" }}
        >
          <DateMark date={date} isToday={date === today} />
          <ul className="space-y-2 min-w-0">
            {entries.filter((e) => e.dueDate === date).map((e) => (
              <li key={e.key}><EntryRow entry={e} onOpen={onOpen} /></li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function datesWithWork(entries: ScheduleCalendarEntry[]): string[] {
  return [...new Set(entries.map((e) => e.dueDate))];
}

// Recurring activities are only scheduled for some years; compliance
// milestones run further. A year outside the activities' span says so,
// rather than reading as a quiet year.
function ActivitiesCoverageNote({ year }: { year: number }) {
  if (year >= ACTIVITY_FIRST_YEAR && year <= ACTIVITY_LAST_YEAR) return null;
  const span = ACTIVITY_FIRST_YEAR === ACTIVITY_LAST_YEAR ? `${ACTIVITY_FIRST_YEAR}` : `${ACTIVITY_FIRST_YEAR}–${ACTIVITY_LAST_YEAR}`;
  return (
    <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg p-3 mb-4" style={{ background: C.accentBg, color: C.ink }}>
      <Info size={13} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
      <span>Recurring activities are scheduled for {span} only, so {year} shows compliance milestones alone.</span>
    </div>
  );
}

// ---- Month --------------------------------------------------------------

function Chip({ entry }: { entry: ScheduleCalendarEntry }) {
  const look = entryLook(entry);
  return (
    <span
      title={entryTooltip(entry)}
      className="flex items-center gap-1.5 rounded-md pl-1.5 pr-1 py-0.5 text-[11px] leading-tight"
      style={{ background: look.background, color: look.text, fontWeight: look.weight, boxShadow: entry.kind === "milestone" ? `inset 0 0 0 1px ${look.border}` : undefined }}
    >
      {look.done ? (
        <span className="text-[10px] font-bold shrink-0" style={{ color: look.color }}>{look.symbol}</span>
      ) : (
        <span className="h-3 w-[3px] rounded-full shrink-0" style={{ background: look.bar }} />
      )}
      {entry.kind === "milestone" && <MilestoneMark size={10} />}
      <span className="min-w-0 truncate">{entry.title}</span>
    </span>
  );
}

function DayCell({ day, entries, selected, onSelect }: {
  day: GridDay; entries: ScheduleCalendarEntry[]; selected: boolean; onSelect: () => void;
}) {
  const shown = entries.slice(0, SHOWN_PER_DAY);
  const hidden = entries.length - shown.length;
  return (
    <button
      onClick={onSelect}
      className="min-h-[104px] p-2 text-left align-top transition-colors min-w-0"
      style={{
        borderRight: day.weekday === 6 ? "none" : `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        background: selected ? C.accentBg : day.inMonth ? "transparent" : C.panel2,
        cursor: entries.length > 0 ? "pointer" : "default",
      }}
    >
      <span
        className="inline-grid place-items-center h-6 min-w-6 px-1 rounded-full text-xs font-semibold mb-1.5"
        style={
          day.isToday
            ? { background: C.ink, color: C.bg }
            : { color: day.inMonth ? C.ink : C.muted, opacity: day.inMonth ? 1 : 0.6 }
        }
      >
        {Number(day.date.slice(8, 10))}
      </span>
      <span className="block space-y-1">
        {shown.map((e) => <Chip key={e.key} entry={e} />)}
        {hidden > 0 && <span className="block text-[11px] pl-1" style={{ color: C.muted }}>{hidden} more</span>}
      </span>
    </button>
  );
}

function MonthView({ all, range, month, onMonthChange, onShowYear, onOpen }: {
  all: ScheduleCalendarEntry[]; range: YearRange;
  month: string; onMonthChange: (m: string) => void; onShowYear: () => void;
  onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [shownMonth, setShownMonth] = useState(month);
  // A new month clears the selected day.
  if (shownMonth !== month) {
    setShownMonth(month);
    setSelected(null);
  }

  const today = todayIso();
  const days = monthGrid(month, today);
  const monthEntries = entriesIn(all, month);
  const withWork = datesWithWork(monthEntries);
  const thisMonth = today.slice(0, 7);
  const firstMonth = `${range.first}-01`;
  const lastMonth = `${range.last}-12`;

  const pick = (day: GridDay) => {
    if (entriesOn(all, day.date).length === 0 || day.date === selected) return setSelected(null);
    setSelected(day.date);
    document.getElementById(dayAnchor(day.date))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <CalendarNav
        label={monthLabel(month)}
        icon={CalendarDays}
        summary={countsLabel(monthEntries)}
        onPrev={() => onMonthChange(shiftMonth(month, -1))}
        onNext={() => onMonthChange(shiftMonth(month, 1))}
        prevDisabled={month <= firstMonth}
        nextDisabled={month >= lastMonth}
        prevTitle="Previous month"
        nextTitle="Next month"
      >
        {month !== thisMonth && thisMonth >= firstMonth && thisMonth <= lastMonth && (
          <Pill onClick={() => onMonthChange(thisMonth)}>This month</Pill>
        )}
        <Pill onClick={onShowYear}><CalendarRange size={13} /> {parseMonth(month).year}</Pill>
      </CalendarNav>

      <ActivitiesCoverageNote year={parseMonth(month).year} />

      <div className="hidden lg:block rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.panel }}>
        <div className="grid grid-cols-7" style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              entries={entriesOn(all, day.date)}
              selected={day.date === selected}
              onSelect={() => pick(day)}
            />
          ))}
        </div>
      </div>

      <section className="mt-2 lg:mt-6">
        {withWork.length === 0 ? (
          <div className="rounded-xl text-center py-10 text-sm" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            Nothing on the schedule falls due in {monthLabel(month)}.
          </div>
        ) : (
          <>
            <h3 className="hidden lg:block text-xs uppercase tracking-wide font-medium mb-2 px-3" style={{ color: C.muted }}>By date</h3>
            <DayRows dates={withWork} entries={monthEntries} selected={selected} anchored onOpen={onOpen} />
          </>
        )}
      </section>
    </div>
  );
}

// ---- Year ---------------------------------------------------------------

function EntryLine({ entry, onOpen }: { entry: ScheduleCalendarEntry; onOpen: (e: ScheduleCalendarEntry) => void }) {
  const look = entryLook(entry);
  return (
    <button
      onClick={() => onOpen(entry)}
      title={entryTooltip(entry)}
      className="w-full flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[12px] leading-tight text-left"
      style={{ background: look.background, color: look.text, fontWeight: look.weight, boxShadow: entry.kind === "milestone" ? `inset 0 0 0 1px ${look.border}` : undefined }}
    >
      {look.done ? (
        <span className="text-[10px] font-bold shrink-0" style={{ color: look.color }}>{look.symbol}</span>
      ) : (
        <span className="h-3 w-[3px] rounded-full shrink-0" style={{ background: look.bar }} />
      )}
      {entry.kind === "milestone" && <MilestoneMark size={10} />}
      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
      <span className="ml-auto shrink-0 tabular-nums" style={{ color: C.muted }}>{Number(entry.dueDate.slice(8, 10))}</span>
    </button>
  );
}

function MonthBlock({ all, month, busiest, isThisMonth, onShowMonth, onOpen }: {
  all: ScheduleCalendarEntry[]; month: string; busiest: number; isThisMonth: boolean;
  onShowMonth: () => void; onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const entries = entriesIn(all, month);
  const shown = entries.slice(0, SHOWN_PER_MONTH);
  const hidden = entries.length - shown.length;
  const { overdue } = countsOf(entries);
  const empty = entries.length === 0;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: empty ? C.panel2 : C.panel,
        border: `1px solid ${isThisMonth ? C.accent : C.border}`,
      }}
    >
      <button
        onClick={onShowMonth}
        title="Open this month"
        className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: isThisMonth ? C.accent : C.ink }}>
          {MONTH_NAMES[parseMonth(month).month - 1]}
        </span>
        <span className="text-[11px] shrink-0" style={{ color: C.muted }}>{countsLabel(entries)}</span>
      </button>

      {/* Fullness relative to the busiest month; never the only signal (count above, names below). */}
      <div className="mx-4 h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${(entries.length / busiest) * 100}%`, background: overdue > 0 ? C.red : C.muted }}
        />
      </div>

      <ul className="px-3 py-3 space-y-1 flex-1">
        {shown.map((e) => <li key={e.key}><EntryLine entry={e} onOpen={onOpen} /></li>)}
        {hidden > 0 && (
          <li>
            <button onClick={onShowMonth} className="text-[11px] px-1.5" style={{ color: C.muted }}>
              {hidden} more in {MONTH_NAMES[parseMonth(month).month - 1]}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

// Every month with work, in full: the blocks above truncate, this does not.
// Open work runs oldest first (overdue at the top); completed runs newest first.
function MonthList({ all, year, onShowMonth, onOpen }: {
  all: ScheduleCalendarEntry[]; year: number; onShowMonth: (m: string) => void; onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const [tab, setTab] = useState<"open" | "done">("open");
  const yearEntries = entriesIn(all, `${year}-`);
  const { open, done } = countsOf(yearEntries);
  const listed = yearEntries.filter((e) => (tab === "open") === (e.status !== "completed"));
  const months = monthsIn(year).filter((m) => listed.some((e) => e.dueDate.startsWith(m)));
  if (tab === "done") months.reverse();
  const thisMonth = todayIso().slice(0, 7);

  return (
    <section className="mt-8">
      <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ background: C.panel2 }}>
        {([["open", `Open · ${open}`], ["done", `Completed · ${done}`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ background: tab === id ? C.ink : "transparent", color: tab === id ? C.bg : C.muted }}
          >
            {label}
          </button>
        ))}
      </div>
      {months.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: C.muted }}>
          {tab === "open" ? `No open work in ${year}.` : `Nothing completed in ${year} yet.`}
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {months.map((m) => {
            const monthListed = listed.filter((e) => e.dueDate.startsWith(m));
            const dates = datesWithWork(monthListed);
            if (tab === "done") dates.reverse();
            return (
              <section key={m} aria-label={monthLabel(m)}>
                <button
                  onClick={() => onShowMonth(m)}
                  title="Open this month"
                  className="w-full flex items-baseline gap-3 px-3 pb-1 text-left"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <span className="text-lg" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: m === thisMonth ? C.accent : C.ink }}>
                    {MONTH_NAMES[parseMonth(m).month - 1]}
                  </span>
                  <span className="text-xs" style={{ color: C.muted }}>{countsLabel(entriesIn(all, m))}</span>
                </button>
                <div className="mt-1">
                  <DayRows dates={dates} entries={monthListed} onOpen={onOpen} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function YearView({ all, range, month, onMonthChange, onShowMonth, onOpen }: {
  all: ScheduleCalendarEntry[]; range: YearRange; month: string; onMonthChange: (m: string) => void; onShowMonth: (m: string) => void;
  onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const { year } = parseMonth(month);
  const months = monthsIn(year);
  // The busiest month sets the fullness bar's scale.
  const busiest = Math.max(...months.map((m) => entriesIn(all, m).length), 1);
  const thisMonth = todayIso().slice(0, 7);
  const thisYear = Number(thisMonth.slice(0, 4));
  const yearEntries = entriesIn(all, `${year}-`);
  const inRange = thisYear >= range.first && thisYear <= range.last;
  // A milestone has no table row; from a month block it opens its month,
  // where the day list prints its note in full.
  const openLine = (e: ScheduleCalendarEntry) => (e.kind === "milestone" ? onShowMonth(e.dueDate.slice(0, 7)) : onOpen(e));

  return (
    <div>
      <CalendarNav
        label={String(year)}
        icon={CalendarRange}
        summary={countsLabel(yearEntries)}
        onPrev={() => onMonthChange(`${year - 1}-${month.slice(5)}`)}
        onNext={() => onMonthChange(`${year + 1}-${month.slice(5)}`)}
        prevDisabled={year <= range.first}
        nextDisabled={year >= range.last}
        prevTitle="Previous year"
        nextTitle="Next year"
      >
        {year !== thisYear && inRange && (
          <Pill onClick={() => onMonthChange(thisMonth)}>This year</Pill>
        )}
        {inRange && (
          <Pill onClick={() => onShowMonth(thisMonth)}><CalendarDays size={13} /> This month</Pill>
        )}
      </CalendarNav>

      <ActivitiesCoverageNote year={year} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((m) => (
          <MonthBlock
            key={m}
            all={all}
            month={m}
            busiest={busiest}
            isThisMonth={m === thisMonth}
            onShowMonth={() => onShowMonth(m)}
            onOpen={openLine}
          />
        ))}
      </div>

      <MonthList all={all} year={year} onShowMonth={onShowMonth} onOpen={onOpen} />
    </div>
  );
}

// ---- Entry point --------------------------------------------------------

export default function ScheduleCalendar({ entries, view, month, onViewChange, onMonthChange, onOpen }: {
  // Activities and compliance milestones together, in due-date order.
  entries: ScheduleCalendarEntry[];
  view: "month" | "year";
  month: string;
  onViewChange: (v: "month" | "year") => void;
  onMonthChange: (m: string) => void;
  onOpen: (e: ScheduleCalendarEntry) => void;
}) {
  const range = yearRangeOf(entries);
  if (view === "year") {
    return (
      <YearView
        all={entries}
        range={range}
        month={month}
        onMonthChange={onMonthChange}
        onShowMonth={(m) => { onMonthChange(m); onViewChange("month"); }}
        onOpen={onOpen}
      />
    );
  }
  return (
    <MonthView
      all={entries}
      range={range}
      month={month}
      onMonthChange={onMonthChange}
      onShowYear={() => onViewChange("year")}
      onOpen={onOpen}
    />
  );
}
