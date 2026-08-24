import React from "react";
import { TrendingUp } from "lucide-react";
import { C } from "../../theme";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import type { TopRisk } from "./types";

// What could go wrong, how exposed are we, and what are we doing about it?
// Open findings/CAPs derived from these risks live on the Actions tab.
export function SystemRisk({ topRisks }: { topRisks: TopRisk[] }) {
  return (
    <div className="px-8 pb-10 space-y-8">
      <Panel>
        <SectionHeader
          icon={TrendingUp}
          title="Top Risk Scenarios"
          description="The system's highest residual risks, their control assurance, ownership, and position against appetite."
        />
        {topRisks.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>No risk scenarios map to this system's assets.</div>
        ) : topRisks.map((r, index) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-4 py-3"
            style={{ borderTop: index > 0 ? `1px solid ${C.border}` : "none" }}
          >
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
      </Panel>
    </div>
  );
}
