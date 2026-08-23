// Who is signed in.
//
// Module-level state plus a subscribe(), matching how the engine publishes
// itself (engine/index.ts + useLiveEngine.ts). The app has no React Context and
// this is not the place to introduce one: gates.ts and the write surfaces read
// the session outside render as often as inside it.
//
// Only the user's id is persisted. Roles are looked up from the roster on every
// read, so editing sessionStorage by hand can at most impersonate someone who
// already exists — it cannot mint a role. That is the same property a signed
// token gives, arrived at the cheap way.
//
// THIS FILE IS THE IDENTITY-PROVIDER SEAM. When Keycloak is wired up, signIn()
// becomes an authorization-code + PKCE redirect, currentUser() reads claims off
// the ID token, and roles come from realm roles instead of roster.yaml. Nothing
// below this file's exports changes: gates.ts and every call site stay as they
// are. Keep it that way — no other module may read the session storage key or
// the roster directly.
import { isActive } from "./roster";
import { findUserById, subscribeToRoster } from "./rosterStore";
import type { User } from "./roster";

// sessionStorage, not localStorage: closing the tab signs you out, which is what
// the fake `grc-authenticated` flag this replaces already did.
const SESSION_STORAGE_KEY = "grc-session";

const listeners = new Set<() => void>();

let signedInId: string | null = readStoredId();

function readStoredId(): string | null {
  try {
    const id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    // A stored id nobody on the roster answers to is not a session.
    return id && findUserById(id) ? id : null;
  } catch {
    return null;
  }
}

// An admin deactivating someone has to take effect on that person, not only in
// the table they are looking at. currentUser() already re-reads the roster on
// every call, so all this has to do is make the session re-publish when the
// roster changes — the deactivated user's next render finds no user and lands
// back on the login screen.
subscribeToRoster(notify);

/**
 * The signed-in user, or null. Returns the roster's own object, so the
 * reference is stable between calls and safe as a useSyncExternalStore snapshot.
 */
export function currentUser(): User | null {
  if (!signedInId) return null;
  const user = findUserById(signedInId);
  // A deactivated account is not a session. Checked here rather than at sign-in
  // so that deactivating someone who is already signed in ends their session
  // too, instead of waiting for them to come back.
  return user && isActive(user) ? user : null;
}

export function signIn(user: User): void {
  signedInId = user.id;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, user.id);
  } catch {
    // A blocked storage write costs persistence across a reload, not the session.
  }
  notify();
}

export function signOut(): void {
  signedInId = null;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Same: the in-memory session is already cleared.
  }
  notify();
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}
