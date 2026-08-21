import React, { useState } from "react";
import { FileDown } from "lucide-react";
import { C } from "../../theme";
import { PrismaLadder } from "./overview/PrismaLadder";
import { AssessmentReadiness } from "./overview/AssessmentReadiness";
import { AttentionRequired } from "./overview/AttentionRequired";
import { SystemSnapshot } from "./overview/SystemSnapshot";
import { RecentSystemActivity } from "./overview/RecentSystemActivity";
import { RolesResponsibilities } from "./overview/RolesResponsibilities";
import { Panel } from "./shared/Panel";
import { SectionHeader } from "./shared/SectionHeader";
import { ASSESSMENT_SELECTION, DEFAULT_SELECTION } from "./SystemControls";
import type { ControlSelection } from "./SystemControls";
import type {
  ApplicabilitySummary, CockpitSummary, ControlMatrixRow, ExposurePosture, IdentityPosture, IncidentResponsePosture,
  ResiliencePosture, SecurityTestingPosture, VendorPosture, WorkspaceDataType, WorkspaceSystem,
} from "./types";
import type { SystemWorkspaceTab } from "./tabs";
import type { ReviewWave } from "../../engine/review";

interface SystemOverviewProps {
  system: WorkspaceSystem;
  cockpit: CockpitSummary;
  compliance: number | null;
  statusCounts: Record<ControlMatrixRow["status"], number>;
  applicabilitySummary: ApplicabilitySummary;
  identity: IdentityPosture;
  exposure: ExposurePosture;
  resilience: ResiliencePosture;
  secTests: SecurityTestingPosture;
  ir: IncidentResponsePosture;
  vendors: VendorPosture;
  dataTypes: WorkspaceDataType[];
  onNavigate: (tab: SystemWorkspaceTab) => void;
  onOpenScopeReview: (wave: ReviewWave) => void;
  onSelectControlsGroup: (selection: ControlSelection) => void;
  onStartAssessment?: () => void;
  onGenerateIsoReport: () => Promise<void>;
}

export function SystemOverview(props: SystemOverviewProps) {
  const {
    system, cockpit, compliance, statusCounts, applicabilitySummary, identity, exposure, resilience, secTests, ir,
    vendors, dataTypes, onNavigate, onOpenScopeReview, onSelectControlsGroup, onStartAssessment, onGenerateIsoReport,
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
          statusCounts={statusCounts}
          applicabilitySummary={applicabilitySummary}
          onScopeClick={() => onOpenScopeReview("not-applicable")}
          onAssessClick={onStartAssessment ?? (() => onSelectControlsGroup(ASSESSMENT_SELECTION))}
          onRemediateClick={() => onSelectControlsGroup(DEFAULT_SELECTION)}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-5">
        <SystemSnapshot system={system} exposure={exposure} dataTypes={dataTypes} />
        <AttentionRequired cockpit={cockpit} onNavigate={onNavigate} />
      </div>

      <RolesResponsibilities system={system} />

      <RecentSystemActivity identity={identity} resilience={resilience} secTests={secTests} ir={ir} vendors={vendors} />

      <Panel>
        <SectionHeader
          icon={FileDown}
          title="ISO/IEC 27001 Assurance Report"
          description="Export this system's scope, assets, risk, control implementation, evidence posture, findings, and supplemental assurance as a review-ready PDF."
          aside={(
            <button
              type="button"
              onClick={() => void generateReport()}
              disabled={generatingReport}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-wait disabled:opacity-60"
              style={{ background: C.accentStrong }}
            >
              {generatingReport ? "Generating report..." : "Generate ISO/IEC 27001:2022 System Assurance & Control Implementation Report"}
            </button>
          )}
        />
        <div className="text-[11px] leading-relaxed -mt-1" style={{ color: C.muted }}>
          Supports readiness and assurance review; it is not an ISO certificate or a complete organizational Statement of Applicability.
        </div>
      </Panel>
    </div>
  );
}
