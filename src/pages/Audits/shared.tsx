import React from "react";
import { C } from "../../theme";
import { commitRuntimeFacts } from "../../engine";
import { loadRuntimeFacts } from "../../engine/runtimeFactsStore";
import type { RuntimeFacts } from "../../engine/liveGraph";
import { AUDITOR_RESULT_META, type AuditorResult } from "../../graph/nodes/engagements";
import { CONTROL_RECORD_STATUS_META, type ControlRecordStatus } from "../../graph/nodes/controlRecords";

/** Apply one change to the runtime facts and publish it. Returns the problems if the change was refused. */
export function commit(mutate: (runtime: RuntimeFacts) => RuntimeFacts): string[] {
  const result = commitRuntimeFacts(mutate(loadRuntimeFacts()));
  return result.engine ? [] : result.problems;
}

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

// Read at call time, never captured at module load: applyTheme() swaps C's
// values in place, so a map built once would keep the theme the app booted in.
export function colorFor(key: string): { color: string; bg: string } {
  switch (key) {
    case "green": return { color: C.green, bg: C.greenBg };
    case "amber": return { color: C.amber, bg: C.amberBg };
    case "red": return { color: C.red, bg: C.redBg };
    case "accent": return { color: C.accent, bg: C.accentBg };
    default: return { color: C.muted, bg: C.panel2 };
  }
}

export function Pill({ color = "muted", children, title }: { color?: string; children: React.ReactNode; title?: string }) {
  const c = colorFor(color);
  return (
    <span title={title} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap" style={{ color: c.color, background: c.bg }}>
      {children}
    </span>
  );
}

export function ResultPill({ result }: { result: AuditorResult }) {
  const m = AUDITOR_RESULT_META[result];
  return <Pill color={m.color}>{m.label}</Pill>;
}

export function RecordStatusPill({ status }: { status: ControlRecordStatus | null }) {
  if (!status) return <Pill>Not recorded</Pill>;
  const m = CONTROL_RECORD_STATUS_META[status];
  return <Pill color={m.color}>{m.label}</Pill>;
}

// Where a row's answer comes from, in the app's words.
export const SOURCE_LABELS: Record<string, string> = {
  system: "System-specific",
  hybrid: "Hybrid",
  common: "Common",
  "enterprise-attestation": "Enterprise program",
  provider: "Provider",
  prisma: "Cyber Assurance",
  none: "System-specific",
};

export const RESULT_ORDER: AuditorResult[] = ["not-assessed", "not-in-place", "partial", "in-place"];
export function resultBarColor(result: AuditorResult): string {
  return result === "not-in-place" ? C.red : result === "partial" ? C.amber : result === "in-place" ? C.green : C.na;
}

/** A stacked bar of auditor results — the control tracker. */
export function TrackerBar({ counts }: { counts: Record<AuditorResult, number> }) {
  const total = RESULT_ORDER.reduce((n, r) => n + counts[r], 0) || 1;
  return (
    <div>
      <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: C.panel2 }}>
        {RESULT_ORDER.map((r) => counts[r] > 0 && (
          <div key={r} style={{ width: `${(counts[r] / total) * 100}%`, background: resultBarColor(r) }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
        {RESULT_ORDER.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: resultBarColor(r) }} />
            {AUDITOR_RESULT_META[r].label}: <span style={{ color: C.ink }}>{counts[r]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The control domains present in a set of rows, as the Common Controls page
 * groups them: domain name, the control-id prefixes it holds, and a count.
 */
export function domainOptions(controls: readonly { id: string; domain: string }[]) {
  const by = new Map<string, { prefixes: Set<string>; count: number }>();
  controls.forEach((c) => {
    const d = by.get(c.domain) ?? { prefixes: new Set<string>(), count: 0 };
    d.prefixes.add(c.id.split("-")[0]);
    d.count++;
    by.set(c.domain, d);
  });
  return [...by.entries()]
    .map(([name, d]) => ({ name, prefixes: [...d.prefixes].sort().join("/"), count: d.count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
