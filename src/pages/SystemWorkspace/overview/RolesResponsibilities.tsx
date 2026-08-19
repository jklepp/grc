import React from "react";
import { Users2 } from "lucide-react";
import { C } from "../../../theme";
import { Panel } from "../shared/Panel";
import { SectionHeader } from "../shared/SectionHeader";
import type { WorkspaceSystem } from "../types";

export function RolesResponsibilities({ system }: { system: WorkspaceSystem }) {
  return (
    <Panel>
      <SectionHeader
        icon={Users2}
        title="Roles & Responsibilities"
        description="Accountability for operating, owning, and assuring this system."
      />
      {system.roles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {system.roles.map((role, index) => (
            <div key={`${role.role}-${index}`} className="flex items-center justify-between gap-4 py-2.5" style={{ borderTop: index > 1 ? `1px solid ${C.border}` : "none" }}>
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{role.role}</div>
              <div className="text-sm text-right" style={{ color: C.muted }}>{role.assignment}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm" style={{ color: C.muted }}>No system roles are assigned.</div>
      )}
    </Panel>
  );
}
