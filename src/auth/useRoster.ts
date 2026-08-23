import { useSyncExternalStore } from "react";
import { currentRoster, subscribeToRoster } from "./rosterStore";
import type { User } from "./roster";

/** The roster as edited. Mirrors engine/useLiveEngine.ts. */
export function useRoster(): readonly User[] {
  return useSyncExternalStore(subscribeToRoster, currentRoster, currentRoster);
}
