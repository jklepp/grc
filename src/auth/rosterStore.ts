// The roster as the app actually sees it: what roster.ts authored, plus what an
// admin has changed on the Users settings page.
//
// Same shape as the runtime facts the Add System wizard writes
// (engine/runtimeFactsStore.ts): an authored source, a localStorage overlay,
// and a merge. The reason is the same too — roster.ts is a TypeScript module, so
// the browser cannot write to it, and a settings page that edits people needs
// somewhere to put the edits.
//
// WHAT THIS COSTS. Until now roles lived only in the authored module, so editing
// sessionStorage by hand could impersonate someone who exists but could not mint
// a role. With roles in localStorage that property is gone: anyone who can open
// devtools can make themselves an admin. It changes little in practice — the
// data was already in their browser and browser-side authorization was already
// advisory — but it is a real thing traded away, and it comes back the day an
// identity provider signs the roles instead.
//
// WHEN AN IDENTITY PROVIDER ARRIVES: adding and removing people moves there, and
// so does role assignment. What stays is the Org claim — Keycloak has no idea
// which ACME person is accountable for what — so this file shrinks to that
// mapping rather than disappearing.
import { AUTHORED_ROSTER, isActive } from "./roster";
import type { User } from "./roster";

const ROSTER_STORAGE_KEY = "grc-runtime-roster";

/**
 * The overlay. Rows are keyed by id and replace an authored row wholesale, the
 * way a runtime system replaces the authored one it was cloned from; a row with
 * an id no authored user has is a person added here.
 */
export interface RuntimeRoster {
  users: User[];
}

const listeners = new Set<() => void>();

let overlay: RuntimeRoster = load();
let merged: readonly User[] = merge(overlay);

function emptyOverlay(): RuntimeRoster {
  return { users: [] };
}

function load(): RuntimeRoster {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<RuntimeRoster>;
    // Defensive in the same way loadRuntimeFacts is: a malformed blob costs the
    // edits, never the app. Everyone can still sign in against the authored rows.
    if (!parsed || !Array.isArray(parsed.users)) return emptyOverlay();
    return { users: parsed.users.filter((u): u is User => Boolean(u && typeof u.id === "string")) };
  } catch {
    return emptyOverlay();
  }
}

function save(next: RuntimeRoster): void {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A blocked write costs persistence across a reload, not the change.
  }
}

// Authored order is preserved so the table does not reshuffle when a row is
// edited; people added here land at the end, in the order they were added.
function merge(source: RuntimeRoster): readonly User[] {
  const edits = new Map(source.users.map((u) => [u.id, u]));
  const authored = AUTHORED_ROSTER.map((u) => edits.get(u.id) ?? u);
  const authoredIds = new Set(AUTHORED_ROSTER.map((u) => u.id));
  const added = source.users.filter((u) => !authoredIds.has(u.id));
  return [...authored, ...added];
}

function publish(next: RuntimeRoster): void {
  overlay = next;
  merged = merge(next);
  save(next);
  for (const listener of listeners) listener();
}

/** Everyone on the roster, active or not. Stable between calls. */
export function currentRoster(): readonly User[] {
  return merged;
}

export function subscribeToRoster(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function findUserById(id: string): User | undefined {
  return merged.find((u) => u.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  const wanted = email.trim().toLowerCase();
  return merged.find((u) => u.email.toLowerCase() === wanted);
}

/** Only people who could sign in — what a picker of assessors should offer. */
export function activeRoster(): readonly User[] {
  return merged.filter(isActive);
}

/** True when this row came from the settings page rather than roster.ts. */
export function isRuntimeUser(id: string): boolean {
  return !AUTHORED_ROSTER.some((u) => u.id === id);
}

/** True when anything has been changed on top of the authored roster. */
export function hasRosterEdits(): boolean {
  return overlay.users.length > 0;
}

// ---- Mutations ----------------------------------------------------------------
// Each publishes, so every useRoster() subscriber re-renders — including the
// signed-in user's own session, which is how deactivating someone signs them out.

/** Add a person, or replace one wholesale. */
export function upsertUser(user: User): void {
  const users = overlay.users.some((u) => u.id === user.id)
    ? overlay.users.map((u) => (u.id === user.id ? user : u))
    : [...overlay.users, user];
  publish({ users });
}

/**
 * Drop a person added here. Authored users cannot be removed this way — the
 * settings page offers them deactivation instead, because roster.ts would put
 * them straight back on the next load and because a name that signed records
 * should stay legible.
 */
export function removeRuntimeUser(id: string): void {
  if (!isRuntimeUser(id)) return;
  publish({ users: overlay.users.filter((u) => u.id !== id) });
}

/** Throw away every local edit and go back to the authored roster. */
export function restoreAuthoredRoster(): void {
  publish(emptyOverlay());
}

/** Generated for someone added here, in a namespace authored ids never use. */
export function nextRuntimeUserId(): string {
  let n = 1;
  while (merged.some((u) => u.id === `u-local-${n}`)) n += 1;
  return `u-local-${n}`;
}
