// Resilience — backup configuration and the DR tests that actually prove it
// works. Having a backup job that's green every night and having proven a
// restore inside the promised RPO/RTO are two different claims; this file
// carries both, deliberately kept apart.
import type { SystemId } from "../ids";

export interface BackupConfig {
  systemId: SystemId;
  enabled: boolean;
  coveragePct: number;
  immutable: boolean;
  crossRegion: boolean;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
}

export interface DrTest {
  id: string;
  systemId: SystemId;
  conductedAt: string;
  cadenceDays: number;
  scope: string;
  restoreSuccessful: boolean;
  actualRpoMinutes: number;
  actualRtoMinutes: number;
  // Required-reason pattern: a failed restore has to say what went wrong, or
  // "the test failed" is a fact with no argument behind it.
  issues?: string;
}
