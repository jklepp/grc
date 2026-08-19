import type { Graph } from "../graph/types";
import type { SystemId } from "../graph/ids";
import type { EngineContext } from "./context";

export const EXCEPTION_LIFECYCLE_STATUSES = ["active", "expiring", "expired"] as const;
export type ExceptionLifecycleStatus = (typeof EXCEPTION_LIFECYCLE_STATUSES)[number];

export const EXCEPTION_REVIEW_STATUSES = ["current", "due-soon", "overdue"] as const;
export type ExceptionReviewStatus = (typeof EXCEPTION_REVIEW_STATUSES)[number];

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function addDays(date: string, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function createExceptions(graph: Graph, ctx: EngineContext) {
  const exceptionRegister = graph.exposureExceptions.map((exception) => {
    const expiration = exception.expiresAt ? new Date(exception.expiresAt) : null;
    const daysUntilExpiration = expiration ? daysBetween(ctx.now, expiration) : null;
    const status: ExceptionLifecycleStatus = daysUntilExpiration !== null && daysUntilExpiration < 0
      ? "expired"
      : daysUntilExpiration !== null && daysUntilExpiration <= 90
        ? "expiring"
        : "active";

    const reviewDue = addDays(exception.approvedAt, exception.reviewCadenceDays);
    const daysUntilReview = daysBetween(ctx.now, reviewDue);
    const reviewStatus: ExceptionReviewStatus = daysUntilReview < 0
      ? "overdue"
      : daysUntilReview <= 30
        ? "due-soon"
        : "current";

    return {
      ...exception,
      system: graph.systemById[exception.systemId],
      owner: graph.orgById[exception.ownerId],
      approver: graph.orgById[exception.approvedBy],
      affectedAssets: exception.affectedAssetIds.map((assetId) => graph.assetById[assetId]).filter(Boolean),
      controls: exception.controlIds.map((controlId) => graph.controlById[controlId]).filter(Boolean),
      status,
      daysUntilExpiration,
      reviewDueAt: reviewDue.toISOString().slice(0, 10),
      daysUntilReview,
      reviewStatus,
    };
  });

  const exceptionSummary = {
    total: exceptionRegister.length,
    active: exceptionRegister.filter((exception) => exception.status === "active").length,
    expiring: exceptionRegister.filter((exception) => exception.status === "expiring").length,
    expired: exceptionRegister.filter((exception) => exception.status === "expired").length,
    reviewDue: exceptionRegister.filter((exception) => exception.reviewStatus !== "current").length,
  };

  function exceptionsForSystem(systemId: SystemId) {
    return exceptionRegister.filter((exception) => exception.systemId === systemId);
  }

  return { exceptionRegister, exceptionSummary, exceptionsForSystem };
}

export type ExceptionsApi = ReturnType<typeof createExceptions>;
export type ManagedException = ExceptionsApi["exceptionRegister"][number];
