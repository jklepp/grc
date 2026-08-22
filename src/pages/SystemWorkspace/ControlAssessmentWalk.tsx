import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Wrench } from "lucide-react";
import { C } from "../../theme";
import { COMPLIANCE_LABELS } from "../../engine";
import { useLiveEngine } from "../../engine/useLiveEngine";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, Callout, CompletionScreen, HeaderStat, ProgressBar, StatTile, TX, WizardBanner, WizardChrome,
  WizardFooter, WizardHeader, WizardOutcomePane, WZ,
} from "../../components/wizard/WizardUI";
import { ControlEvaluationPanel } from "./ControlEvaluationPanel";
import { keyControlAssessmentQueue } from "./recordAssessment";
import type { ComplianceRating } from "../../graph/nodes/taxonomy";
import type { ControlId, SystemId } from "../../graph/ids";
import type { ControlMatrixRow } from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// What the walk holds on screen between one control and the next. The panel is
// keyed on the control id and rebuilt from scratch each time, so an in-panel
// transition cannot survive the swap — the hold has to live out here, where it
// also gets to say what was recorded and what is coming.
interface Advancing {
  controlId: string;
  controlName: string;
  domain: string;
  rating: ComplianceRating;
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
  const [advancing, setAdvancing] = useState<Advancing | null>(null);

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
    setReviewer(liveEngine.graph.assessmentScopeBySystem[systemId]?.assessor ?? "");
    setNotImplementedCount(0);
    setSkippedIds(new Set());
    setAdvancing(null);
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
          <WizardBanner icon={ClipboardCheck} title="Control Assessment Wizard" />
          <WizardHeader
            icon={ClipboardCheck}
            title="Control Assessment"
            description="Every applicable key control on this boundary, worked one at a time and signed by the assessor of record."
            aside={<HeaderStat label="Assessed" value={`${decidedCount} of ${initialTotal}`} />}
            onClose={<ModalCloseButton onClose={onClose} />}
          />
          <WizardOutcomePane>
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
          </WizardOutcomePane>
          <WizardFooter
            position={`${decidedCount} of ${initialTotal} assessed`}
            close={<Button onClick={onClose}>Close</Button>}
            primary={notImplementedCount > 0 && onGoToRemediation
              ? (
                <Button
                  variant="primary"
                  icon={Wrench}
                  iconRight={ArrowRight}
                  onClick={() => { onClose(); onGoToRemediation(); }}
                >
                  Continue to Remediation &middot; {notImplementedCount}
                </Button>
              )
              : undefined}
          />
        </WizardChrome>
      </Modal>
    );
  }

  // The first frame after opening renders before the snapshot effect has run
  // (empty domain order, no active domain) — show nothing rather than
  // flashing the completion screen.
  if (!current) return null;

  if (advancing) {
    const next = current.controlId === advancing.controlId ? null : current;
    return (
      <Modal open onClose={onClose} width={1180} height={840}>
        <WizardChrome>
          <WizardBanner icon={ClipboardCheck} title="Control Assessment Wizard" />
          <WizardHeader
            icon={ClipboardCheck}
            title="Control Assessment"
            description="One control recorded. Read what was written, then carry on to the next."
            aside={<HeaderStat label="Assessed" value={`${decidedCount} of ${initialTotal}`} />}
            onClose={<ModalCloseButton onClose={onClose} />}
          />
          <WizardOutcomePane center>
            <div className="w-full max-w-2xl flex flex-col gap-5">
              <Callout tone="success" title={`${advancing.controlId} recorded — Implemented ${advancing.rating} · ${COMPLIANCE_LABELS[advancing.rating]}.`}>
                {advancing.controlName}
              </Callout>
              <div className="flex flex-col gap-2">
                <div className={TX.label} style={{ color: C.muted }}>Next</div>
                <div className={TX.stepTitle} style={{ color: C.ink, fontFamily: WZ.serif }}>
                  {next ? `${next.control.id} · ${next.control.name}` : "Wrapping up this assessment"}
                </div>
                {next && (
                  <div className={TX.help} style={{ color: C.muted }}>{next.control.domain}</div>
                )}
              </div>
              <ProgressBar value={decidedCount} total={initialTotal} label="Key controls assessed" />
              <div className={TX.help} style={{ color: C.muted }}>
                {decidedCount} of {initialTotal} assessed
              </div>
            </div>
          </WizardOutcomePane>
          <WizardFooter
            position={`${activeDomain} · ${remainingByDomain[activeDomain]?.length ?? 0} left`}
            close={<Button onClick={onClose}>Close</Button>}
            primary={(
              <Button variant="primary" iconRight={ArrowRight} onClick={() => setAdvancing(null)}>
                Continue
              </Button>
            )}
          />
        </WizardChrome>
      </Modal>
    );
  }

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
          if (!continueWalk) {
            onClose();
            return;
          }
          // Hold the confirmation before the queue swaps the panel out from
          // under the operator, until they say to move on — a timed
          // auto-advance either forced the operator to skim, or sat there
          // uselessly for anyone reading it slowly.
          setAdvancing({
            controlId: current.control.id,
            controlName: current.control.name,
            domain: current.control.domain,
            rating,
          });
        },
        onSkip: () => setSkippedIds((prev) => new Set(prev).add(current.controlId)),
      }}
    />
  );
}
