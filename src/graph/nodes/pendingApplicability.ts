// A control under active applicability review, on one system.
//
// applicability-exceptions.yaml records a decision already made: a rule
// matched, and someone decided it doesn't apply, with a stated reason. This is
// the state before that decision exists — the control's premise looks like it
// might hold, but nobody has resolved whether it does. Reporting it as
// Applicable would assert a scope commitment nobody made; reporting it as Not
// Applicable would assert the opposite call, equally unmade. It gets its own
// bucket instead.
import type { ControlId, SystemId } from "../ids";

export interface PendingApplicability {
  systemId: SystemId;
  controlId: ControlId;
  reason: string;
}
