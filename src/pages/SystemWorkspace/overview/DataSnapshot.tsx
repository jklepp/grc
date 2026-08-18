import React from "react";
import { Database, ArrowRight } from "lucide-react";
import { C, CLASS_ORDER } from "../../../theme";
import { SectionHeading } from "../../../components/Headings";
import { DataTypeCard } from "../../../components/SystemBadges";
import type { WorkspaceDataType } from "../types";
import type { SystemWorkspaceTab } from "../tabs";

export function DataSnapshot({ dataTypes, onNavigate }: { dataTypes: WorkspaceDataType[]; onNavigate: (tab: SystemWorkspaceTab) => void }) {
  const top = [...dataTypes]
    .sort((a, b) => CLASS_ORDER.indexOf(b.sensitivity) - CLASS_ORDER.indexOf(a.sensitivity))
    .slice(0, 4);

  return (
    <div>
      <SectionHeading
        icon={Database}
        right={
          <button onClick={() => onNavigate("data")} className="flex items-center gap-1 text-xs font-medium" style={{ color: C.accent }}>
            View Data tab <ArrowRight size={12} />
          </button>
        }
      >
        Sensitive Data
      </SectionHeading>
      {top.length === 0 ? (
        <div className="text-sm" style={{ color: C.muted }}>No data types mapped to this system's assets.</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {top.map((t) => (
            <button key={t.id} onClick={() => onNavigate("data")} className="text-left">
              <DataTypeCard dataType={t} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
