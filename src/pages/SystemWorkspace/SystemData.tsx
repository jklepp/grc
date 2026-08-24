import React from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Database, DatabaseBackup, ListTree, TriangleAlert } from "lucide-react";
import { C } from "../../theme";
import { ClassificationTag } from "../../components/SystemBadges";
import { Panel } from "./shared/Panel";
import { IdentificationField } from "./shared/IdentificationField";
import { SectionHeader } from "./shared/SectionHeader";
import type { FlowLayout } from "../../utils/flowDiagramLayout";
import type { ResiliencePosture, WorkspaceDataType, WorkspaceSystem } from "./types";

type BackupRecoveryEntries = FlowLayout["backupRecovery"];

interface SystemDataProps {
  system: WorkspaceSystem;
  dataTypes: WorkspaceDataType[];
  resilience: ResiliencePosture;
  backupRecovery: BackupRecoveryEntries;
}

function RecoveryMetric({ label, value, detail, healthy = true }: { label: string; value: ReactNode; detail: string; healthy?: boolean }) {
  return (
    <div className="rounded-lg p-3.5" style={{ background: healthy ? C.panel2 : C.amberBg }}>
      <div className="text-[10px] uppercase tracking-wide font-medium" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: healthy ? C.ink : C.amber }}>{value}</div>
      <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.muted }}>{detail}</div>
    </div>
  );
}

// One data type as a row, not a boxed tile — name/classification on the
// first line, description underneath, regulatory flags trailing as plain
// text instead of pill badges. A bottom border separates rows instead of
// each one carrying its own card border, so a list of many data types reads
// as one table rather than a wall of tiles.
function DataTypeRow({ dataType, last }: { dataType: WorkspaceDataType; last: boolean }) {
  return (
    <div className="py-3" style={{ borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{dataType.name}</span>
        <ClassificationTag level={dataType.sensitivity} />
      </div>
      {dataType.description && (
        <div className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{dataType.description}</div>
      )}
      <div className="text-[11px] mt-1" style={{ color: C.muted }}>
        {dataType.regulatoryFlags.length > 0 ? dataType.regulatoryFlags.join(" · ") : "No regulated-data category"}
      </div>
    </div>
  );
}

// What sensitive information does this system handle, and where does it go?
// Classification/volume/retention live here; movement/topology lives in
// Architecture — no overlap between the two tabs.
export function SystemData({ system, dataTypes, resilience, backupRecovery }: SystemDataProps) {
  const midpoint = Math.ceil(dataTypes.length / 2);
  const dataTypeColumns = [dataTypes.slice(0, midpoint), dataTypes.slice(midpoint)];
  const backup = resilience.backup;
  const lastTest = resilience.lastDrTest;
  const recoveryVerified = Boolean(lastTest?.restoreSuccessful && resilience.targetsMetLastTest && !resilience.overdue);

  return (
    <div className="px-4 lg:px-8 pb-10 space-y-8">
      <Panel>
        <SectionHeader icon={Database} title="Data Profile" description="Population, geographic, and lifecycle characteristics for this system's data." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <IdentificationField label="Data Subjects" value={system.dataProfile.subjects.join(", ")} />
          <IdentificationField label="Approx. Records" value={system.dataProfile.approxRecords.toLocaleString()} />
          <IdentificationField label="Residency" value={system.dataProfile.residency.join(", ")} />
          <IdentificationField label="Retention" value={system.dataProfile.retention} />
        </div>
      </Panel>
      <Panel>
        <SectionHeader
          icon={ListTree}
          title="Data Types Processed"
          description="Information this system receives, stores, or transmits."
          aside={<span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: C.accentBg, color: C.accent }}>{dataTypes.length} type{dataTypes.length === 1 ? "" : "s"}</span>}
        />
        {dataTypes.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2">
            {dataTypeColumns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className={columnIndex === 0 ? "xl:pr-5 xl:border-r" : "xl:pl-5"}
                style={{ borderColor: C.border }}
              >
                {column.map((dataType, index) => (
                  <DataTypeRow key={dataType.id} dataType={dataType} last={columnIndex === dataTypeColumns.length - 1 && index === column.length - 1} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: C.muted }}>No data types mapped to this system's assets.</div>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          icon={DatabaseBackup}
          title="Backup & Recovery"
          description="How durable system data is protected and how quickly it can be restored."
          aside={<span
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: recoveryVerified ? C.green : C.amber, background: recoveryVerified ? C.greenBg : C.amberBg }}
          >
            {recoveryVerified ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />}
            {recoveryVerified ? "Recovery verified" : "Review needed"}
          </span>}
        />

        {backup ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <RecoveryMetric
                label="Backup Coverage"
                value={`${backup.coveragePct}%`}
                detail={backup.enabled ? "Backups enabled" : "Backups disabled"}
                healthy={backup.enabled && backup.coveragePct === 100}
              />
              <RecoveryMetric
                label="Recovery Copies"
                value={backup.immutable ? "Immutable" : "Mutable"}
                detail={backup.crossRegion ? "Cross-region copy enabled" : "Single-region only"}
                healthy={backup.immutable && backup.crossRegion}
              />
              <RecoveryMetric
                label="RPO Target"
                value={`${backup.rpoTargetMinutes}m`}
                detail="Maximum acceptable data loss"
              />
              <RecoveryMetric
                label="RTO Target"
                value={`${backup.rtoTargetMinutes}m`}
                detail="Maximum acceptable recovery time"
              />
            </div>

            {backupRecovery.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="text-[10px] uppercase tracking-wide font-medium mb-2" style={{ color: C.muted }}>Protected Recovery Stores</div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {backupRecovery.map(({ asset, backedUpFrom }) => (
                    <div key={asset.id} className="rounded-lg px-3.5 py-3" style={{ background: C.panel2 }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: C.accent, background: C.accentBg }}>{asset.code}</span>
                        <span className="text-sm font-semibold" style={{ color: C.ink }}>{asset.name}</span>
                      </div>
                      <div className="text-[11px] mt-1.5" style={{ color: C.muted }}>
                        {backedUpFrom.length > 0 ? `Protects ${backedUpFrom.map((source) => source.name).join(" · ")}` : "No protected source assets mapped"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide font-medium" style={{ color: C.muted }}>Latest Recovery Validation</div>
                  {lastTest ? (
                    <>
                      <div className="text-sm font-semibold mt-1" style={{ color: C.ink }}>{lastTest.conductedAt} · {lastTest.scope}</div>
                      <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                        Actual RPO {lastTest.actualRpoMinutes}m · Actual RTO {lastTest.actualRtoMinutes}m · Next due {lastTest.cadence.dueAt ?? "not scheduled"}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm mt-1" style={{ color: C.muted }}>No recovery test is on record.</div>
                  )}
                </div>
                {lastTest && (
                  <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ color: resilience.targetsMetLastTest ? C.green : C.red, background: resilience.targetsMetLastTest ? C.greenBg : C.redBg }}>
                    {resilience.targetsMetLastTest ? "Targets met" : "Targets missed"}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg p-4 text-sm" style={{ color: C.muted, background: C.panel2 }}>No backup configuration is on record for this system.</div>
        )}
      </Panel>
    </div>
  );
}
