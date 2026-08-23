import { useSyncExternalStore } from "react";
import { currentUser, subscribeToSession } from "./session";
import type { User } from "./roster";

/** The signed-in user, or null. Mirrors engine/useLiveEngine.ts. */
export function useUser(): User | null {
  return useSyncExternalStore(subscribeToSession, currentUser, currentUser);
}

/**
 * The signed-in user, for the surfaces that only render behind the login gate
 * — which is every page. Throws rather than returning null for the same reason
 * getLiveEngine() does: a null user there is a broken boot sequence, not a state
 * worth branching on in every caller.
 */
export function useSignedInUser(): User {
  const user = useUser();
  if (!user) throw new Error("useSignedInUser() called outside the signed-in app — see src/Boot.tsx");
  return user;
}
