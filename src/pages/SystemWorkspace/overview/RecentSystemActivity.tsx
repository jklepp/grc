import React, { useMemo } from "react";
import { Clock } from "lucide-react";
import { C } from "../../../theme";
import { Panel } from "../shared/Panel";
import { SectionHeader } from "../shared/SectionHeader";
import { recentActivityForSystem } from "./recentActivity";
import type { RecentActivityInput } from "./recentActivity";

const DOMAIN_COLOR: Record<string, string> = {
  Identity: C.accent,
  Resilience: C.green,
  "Security Testing": C.amber,
  "Incident Response": C.red,
  "Vendor Assurance": C.muted,
};

export function RecentSystemActivity({ identity, resilience, secTests, ir, vendors }: RecentActivityInput) {
  const events = useMemo(
    () => recentActivityForSystem({ identity, resilience, secTests, ir, vendors }),
    [identity, resilience, secTests, ir, vendors]
  );

  return (
    <Panel>
        <SectionHeader
          icon={Clock}
          title="Recent Activity"
          description="The latest identity, recovery, testing, incident-response, and vendor-assurance events."
        />
        {events.length === 0 ? (
          <div className="text-sm" style={{ color: C.muted }}>No recent activity on record for this system.</div>
        ) : (
          <div className="space-y-2.5">
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 w-28 text-center"
                  style={{ color: DOMAIN_COLOR[e.domain] ?? C.muted, background: C.panel2 }}
                >
                  {e.domain}
                </span>
                <div className="min-w-0">
                  <span className="text-sm" style={{ color: C.ink }}>{e.label}</span>
                  <span className="text-xs ml-2" style={{ color: C.muted }}>{e.detail}</span>
                </div>
                <span className="text-[11px] ml-auto shrink-0" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{e.ts}</span>
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}
