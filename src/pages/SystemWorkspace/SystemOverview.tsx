import React, { useState } from "react";
import { FileDown } from "lucide-react";
import { C } from "../../theme";
import { PrismaLadder } from "./overview/PrismaLadder";
import { AssessmentReadiness } from "./overview/AssessmentReadiness";
import { Panel } from "./shared/Panel";
import type { CockpitSummary, WorkspaceSystem } from "./types";
import type { FormalAssessmentStatus } from "../../engine/review";
import type { AssuranceStageId } from "./AssuranceWorkflow";

interface SystemOverviewProps {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  compliance: number | null;
  onOpenAssurance: (stage: AssuranceStageId) => void;
  onGenerateIsoReport: () => Promise<void>;
  formalAssessment: FormalAssessmentStatus;
}

export function SystemOverview(props: SystemOverviewProps) {
  const {
    system, cockpit, compliance, onOpenAssurance, onGenerateIsoReport,
    formalAssessment,
  } = props;
  const [generatingReport, setGeneratingReport] = useState(false);

  async function generateReport() {
    setGeneratingReport(true);
    try {
      await onGenerateIsoReport();
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div className="px-8 pb-10 space-y-8">
      <Panel>
        <PrismaLadder system={system} compliance={compliance} assurance={cockpit.assurance} />
      </Panel>

      <Panel>
        <AssessmentReadiness
          formalAssessment={formalAssessment}
          onScopeClick={() => onOpenAssurance("scope")}
          onAssessClick={() => onOpenAssurance("assess")}
          onGapsClick={() => onOpenAssurance("findings")}
          onRemediateClick={() => onOpenAssurance("remediate")}
        />
      </Panel>

      <Panel className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileDown size={15} className="shrink-0" color={C.muted} />
          <span className="text-xs" style={{ color: C.muted }}>ISO/IEC 27001 Assurance Report</span>
        </div>
        <button
          type="button"
          onClick={() => void generateReport()}
          disabled={generatingReport}
          className="rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-wait disabled:opacity-60 shrink-0"
          style={{ background: C.accentStrong }}
        >
          {generatingReport ? "Generating report..." : "Generate Report"}
        </button>
      </Panel>
    </div>
  );
}
