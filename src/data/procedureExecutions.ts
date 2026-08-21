// SOP execution records: real per-run history (not a flat completed/not-completed
// map) with per-step evidence, so a run of e.g. SOP-04 looks like an actual
// access-review cycle rather than a checklist. There's no backend yet, so state
// persists in localStorage only — shared here (rather than kept local to
// ProcedureLibrary) so any page can read the same records and compute the same
// reliability figure from them without a second, possibly-drifting definition of
// "clean run".
export type ExecutionStatus = "in_progress" | "complete";
export type ExecutionStepStatus = "pending" | "complete";

export interface StepEvidencePayload {
  summary?: number;
  pass?: boolean;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  values?: Record<string, string | number>;
  ids?: string[];
  actual?: number | null;
  expected?: number | null;
  note?: string;
}

export interface ExecutionStepRecord {
  status: ExecutionStepStatus;
  completedAt: string | null;
  completedBy?: string;
  evidence: StepEvidencePayload | null;
}

export interface ProcedureExecution {
  id: string;
  period: string;
  owner: string;
  startedAt: string;
  completedAt: string | null;
  status: ExecutionStatus;
  steps: ExecutionStepRecord[];
}

export type ExecutionsMap = Record<string, ProcedureExecution[]>;

export interface ProcedureReliability {
  totalRuns: number;
  completedRuns: number;
  cleanRuns: number;
  totalExceptions: number;
  reliabilityPct: number;
}

export const EXEC_STORAGE_KEY = "grc-procedure-executions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProcedureExecution(value: unknown): value is ProcedureExecution {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.period !== "string" ||
      typeof value.owner !== "string" || typeof value.startedAt !== "string" ||
      !(value.completedAt === null || typeof value.completedAt === "string") ||
      !(value.status === "in_progress" || value.status === "complete") || !Array.isArray(value.steps)) return false;
  return value.steps.every((step) => isRecord(step) &&
    (step.status === "pending" || step.status === "complete") &&
    (step.completedAt === null || typeof step.completedAt === "string") &&
    (step.evidence === null || isRecord(step.evidence)));
}

function isExecutionsMap(value: unknown): value is ExecutionsMap {
  return isRecord(value) && Object.values(value).every(
    (executions) => Array.isArray(executions) && executions.every(isProcedureExecution),
  );
}

export function loadExecutions(): ExecutionsMap {
  try {
    const raw = localStorage.getItem(EXEC_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isExecutionsMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// A run is "clean" if nothing it captured failed a built-in consistency check
// (a verify step that didn't match its expected value). Reliability is
// deliberately silent (null) with zero completed runs rather than showing a
// fake 100% or 0% — there's no empirical basis for a number yet.
export function computeReliability(executions: ProcedureExecution[]): ProcedureReliability | null {
  const completed = executions.filter((e) => e.status === "complete");
  if (completed.length === 0) return null;
  const exceptionsPerRun = completed.map((e) => e.steps.filter((s) => s.evidence && s.evidence.pass === false).length);
  const cleanRuns = exceptionsPerRun.filter((n) => n === 0).length;
  return {
    totalRuns: executions.length,
    completedRuns: completed.length,
    cleanRuns,
    totalExceptions: exceptionsPerRun.reduce((a, b) => a + b, 0),
    reliabilityPct: Math.round((100 * cleanRuns) / completed.length),
  };
}
