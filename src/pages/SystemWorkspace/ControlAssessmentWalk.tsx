import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Wrench } from "lucide-react";
import { C } from "../../theme";
import { useLiveEngine } from "../../engine/useLiveEngine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, CompletionScreen, StatTile, WizardChrome, WizardFooter,
} from "../../components/wizard/WizardUI";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import { keyControlAssessmentQueue } from "./recordAssessment";
import type { ControlId, SystemId } from "../../graph/ids";
import type { ControlMatrixRow } from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ControlAssessmentWalkProps {
  open: boolean;
  systemId: SystemId;
  onClose: () => void;
  // Wired up so the completion screen can hand off straight into the
  // Remediation queue when the walk surfaced a Not Implemented call.
  onGoToRemediation?: () => void;
}

// The key-control walk: applicable key controls grouped by domain, worked one
// at a time with auto-advance to the next domain with work left. This is only
// the orchestration — queue snapshot, active domain, reviewer, skip list,
// completion screen. The control itself renders in ControlEvaluationPanel
// (the same full panel a Controls-tab row click opens), passed the walk
// chrome via its `walk` prop, so there is exactly one assessment UI.
export function ControlAssessmentWalk({ open, systemId, onClose, onGoToRemediation }: ControlAssessmentWalkProps) {
  const liveEngine = useLiveEngine();
  const system = liveEngine.rollups.systemRollups.find((s) => s.id === systemId);
  const matrix = liveEngine.compliance.systemControlMatrix(systemId).map((row) => ({
    ...row,
    responsibility: liveEngine.compliance.responsibilityForControl(systemId, row.controlId),
  }));
  const systemAssets = liveEngine.graph.assetsBySystem[systemId] ?? [];
  const queue = keyControlAssessmentQueue(
    matrix,
    systemAssets,
    (assetId, ctrlId) => liveEngine.applicability.resolveApplicability(assetId, ctrlId).required,
  );

  const [domainOrder, setDomainOrder] = useState<string[]>([]);
  const [domainTotals, setDomainTotals] = useState<Record<string, number>>({});
  const [activeDomain, setActiveDomain] = useState("");
  const [initialTotal, setInitialTotal] = useState(0);
  const [reviewer, setReviewer] = useState("");
  const [notImplementedCount, setNotImplementedCount] = useState(0);
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<ControlId>>(new Set());

  // Skipped controls stay unassessed (and in the live queue) but leave the
  // walk's "remaining" view, so the walk can finish around them.
  const remainingByDomain = useMemo(() => {
    const groups: Record<string, ControlMatrixRow[]> = {};
    queue.forEach((row) => {
      if (!skippedIds.has(row.controlId)) (groups[row.control.domain] ??= []).push(row);
    });
    return groups;
  }, [queue, skippedIds]);

  // Reset to a clean slate every time the walk opens, snapshotting the
  // starting queue and its domain breakdown — the rail's totals and order
  // stay fixed for the session even as items leave "remaining" one by one.
  useEffect(() => {
    if (!open) return;
    setReviewer("");
    setNotImplementedCount(0);
    setSkippedIds(new Set());
    const totals: Record<string, number> = {};
    queue.forEach((row) => { totals[row.control.domain] = (totals[row.control.domain] ?? 0) + 1; });
    const order = Object.keys(totals).sort();
    setDomainTotals(totals);
    setDomainOrder(order);
    setInitialTotal(queue.length);
    setActiveDomain(order[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Once the active domain empties, move on to the next domain with work
  // left — wrapping back to earlier domains so finishing a later one the
  // operator jumped to doesn't strand undone work behind a false completion.
  useEffect(() => {
    if (!open) return;
    if ((remainingByDomain[activeDomain]?.length ?? 0) > 0) return;
    const idx = domainOrder.indexOf(activeDomain);
    const next = domainOrder.slice(idx + 1).find((d) => (remainingByDomain[d]?.length ?? 0) > 0)
      ?? domainOrder.find((d) => (remainingByDomain[d]?.length ?? 0) > 0);
    if (next && next !== activeDomain) setActiveDomain(next);
  }, [open, activeDomain, remainingByDomain, domainOrder]);

  if (!open || !system) return null;

  const current = remainingByDomain[activeDomain]?.[0] ?? null;
  const remainingTotal = Object.values(remainingByDomain).reduce((sum, rows) => sum + rows.length, 0);
  const decidedCount = Math.max(0, initialTotal - queue.length);
  const skippedCount = queue.filter((row) => skippedIds.has(row.controlId)).length;
  const complete = initialTotal > 0 && remainingTotal === 0;

  if (complete) {
    return (
      <Modal open onClose={onClose} width={880} height={620}>
        <WizardChrome>
          <div className="flex items-center justify-end px-6 pt-4">
            <ModalCloseButton onClose={onClose} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-8 flex flex-col" style={{ background: C.bg }}>
            <CompletionScreen
              title="Control assessment complete"
              description={skippedCount > 0
                ? `${decidedCount} of ${initialTotal} applicable key controls on this boundary now have a recorded fact; ${skippedCount} skipped for later.`
                : "Every applicable key control on this boundary now has a recorded fact behind its score."}
              tiles={domainOrder.length > 0 ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                  {domainOrder.map((domain) => (
                    <StatTile key={domain} label={domain} value={domainTotals[domain]} />
                  ))}
                </div>
              ) : undefined}
              signature={<>Reviewed by <b style={{ color: C.ink }}>{reviewer.trim() || "unnamed reviewer"}</b> &middot; completed {today()}</>}
            />
          </div>
          <WizardFooter position={`${decidedCount} of ${initialTotal} assessed`}>
            {notImplementedCount > 0 && onGoToRemediation && (
              <Button
                variant="primary"
                icon={Wrench}
                iconRight={ArrowRight}
                onClick={() => { onClose(); onGoToRemediation(); }}
              >
                Go to remediation &middot; {notImplementedCount} control{notImplementedCount === 1 ? "" : "s"}
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </WizardFooter>
        </WizardChrome>
      </Modal>
    );
  }

  // The first frame after opening renders before the snapshot effect has run
  // (empty domain order, no active domain) — show nothing rather than
  // flashing the completion screen.
  if (!current) return null;

  return (
    <ControlEvaluationPanel
      key={current.controlId}
      row={current}
      system={system}
      onClose={onClose}
      walk={{
        domains: domainOrder.map((domain) => ({
          domain,
          total: domainTotals[domain] ?? 0,
          remaining: remainingByDomain[domain]?.length ?? 0,
        })),
        activeDomain,
        onSelectDomain: setActiveDomain,
        decidedCount,
        initialTotal,
        reviewer,
        onReviewerChange: setReviewer,
        onRecorded: (rating, continueWalk) => {
          if (rating === 0) setNotImplementedCount((n) => n + 1);
          if (!continueWalk) onClose();
        },
        onSkip: () => setSkippedIds((prev) => new Set(prev).add(current.controlId)),
      }}
    />
  );
}
