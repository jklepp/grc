import React, { useState } from "react";
import { FileDown } from "lucide-react";
import { C } from "../../theme";
import { PrismaLadder } from "./overview/PrismaLadder";
import { AssessmentReadiness } from "./overview/AssessmentReadiness";
import { AttentionRequired } from "./overview/AttentionRequired";
import { SystemSnapshot } from "./overview/SystemSnapshot";
import { Panel } from "./shared/Panel";
import { ASSESSMENT_SELECTION, DEFAULT_SELECTION } from "./SystemControls";
import type { ControlSelection } from "./SystemControls";
import type {
  CockpitSummary, ExposurePosture, WorkspaceDataType, WorkspaceSystem,
} from "./types";
import type { SystemWorkspaceTab } from "./tabs";
import type { FormalAssessmentStatus, ReviewWave } from "../../engine/review";

interface SystemOverviewProps {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  compliance: number | null;
  exposure: ExposurePosture;
  dataTypes: WorkspaceDataType[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
  onOpenScopeReview: (wave: ReviewWave) => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
  onStartAssessment?: () => void;
  onGenerateIsoReport: () => Promise<void>;
  formalAssessment: FormalAssessmentStatus;
}

export function SystemOverview(props: SystemOverviewProps) {
  const {
    system, cockpit, compliance, exposure,
    dataTypes, onNavigate, onOpenScopeReview, onSelectControlsGroup,
    onStartAssessment, onGenerateIsoReport,
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
          onScopeClick={() => onOpenScopeReview("not-applicable")}
          onAssessClick={onStartAssessment ?? (() => onSelectControlsGroup(ASSESSMENT_SELECTION))}
          onGapsClick={() => onNavigate("findings")}
          onRemediateClick={() => onSelectControlsGroup(DEFAULT_SELECTION)}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-5">
        <SystemSnapshot system={system} exposure={exposure} dataTypes={dataTypes} />
        <AttentionRequired cockpit={cockpit} onNavigate={onNavigate} />
      </div>

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
