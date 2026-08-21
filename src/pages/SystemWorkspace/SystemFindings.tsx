import React, { useMemo } from "react";
import { ListTodo } from "lucide-react";
import { C } from "../../theme";
import { POAMRow } from "./shared/POAMRow";
import { SectionHeader } from "./shared/SectionHeader";
import type { EngineFinding } from "../../engine/findings";

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// System-wide open gaps and corrective action plans (CAPs) — promoted out of
// the Risk tab so findings get their own primary surface next to Controls,
// where they're created. Sorted overdue-first, then by severity, so the
// items most worth acting on lead the list without a filter UI (v1 scope).
export function SystemFindings({ findings }: { findings: EngineFinding[] }) {
  const sorted = useMemo(() => {
    return [...findings].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const rankA = a.severity ? SEVERITY_RANK[a.severity] ?? 99 : 99;
      const rankB = b.severity ? SEVERITY_RANK[b.severity] ?? 99 : 99;
      return rankA - rankB;
    });
  }, [findings]);

  const openCount = findings.filter((f) => f.open).length;
  const overdueCount = findings.filter((f) => f.overdue).length;

  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeader
          icon={ListTodo}
          title="Findings & CAPs"
          description="Every control gap not yet fully implemented, with its corrective action plan, responsible resource, and target date — pulled from ACME's live remediation tracker, not a static appendix."
          aside={(
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.muted }}>{openCount} open</span>
              {overdueCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redBg, color: C.red }}>{overdueCount} overdue</span>
              )}
            </div>
          )}
        />
        {sorted.length === 0 ? (
          <div className="text-sm p-4 rounded-lg" style={{ background: C.greenBg, color: C.green }}>
            No open findings — every tracked control on this system is fully implemented.
          </div>
        ) : (
          sorted.map((item) => <POAMRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
