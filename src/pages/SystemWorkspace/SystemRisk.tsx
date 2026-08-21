import React from "react";
import { TrendingUp } from "lucide-react";
import { C } from "../../theme";
import { SectionHeader } from "./shared/SectionHeader";
import type { TopRisk } from "./types";

// What could go wrong, how exposed are we, and what are we doing about it?
// Open findings/CAPs derived from these risks live on the Findings tab.
export function SystemRisk({ topRisks }: { topRisks: TopRisk[] }) {
  return (
    <div className="px-8 pb-10 space-y-8">
      <div>
        <SectionHeader
          icon={TrendingUp}
          title="Top Risk Scenarios"
          description="The system's highest residual risks, their control assurance, ownership, and position against appetite."
        />
        <div className="space-y-2">
          {topRisks.map((r) => (
            <div key={r.id} className="rounded-lg p-4 flex items-center justify-between gap-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.ink }}>{r.scenario}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{r.domain} · Owner: {r.owner}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-xs">
                <span style={{ color: r.residual.severity === "Severe" ? C.red : C.muted }}>Residual: {r.residual.severity} / {r.residual.likelihood}</span>
                <span style={{ color: C.muted }}>Control assurance: {r.assurance.pct ?? "—"}</span>
                <span className={r.appetiteRatio > 1 ? "font-semibold" : ""} style={{ color: r.appetiteRatio > 1 ? C.red : C.green }}>
                  {r.appetiteRatio}x appetite
                </span>
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <div className="text-sm" style={{ color: C.muted }}>No risk scenarios map to this system's assets.</div>}
        </div>
      </div>
    </div>
  );
}
