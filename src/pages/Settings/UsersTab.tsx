// Who can sign in, what they hold, and when anyone last checked.
//
// The access-review half of this page is not decoration. ACME ASSURE asks every
// other system to recertify privileged access on a cycle — SOP-04 is that
// procedure, and identity.ts models the answer as a population with a review
// date. A tool that says so and cannot answer the question about its own
// operators is making an argument it does not accept. So the same two facts are
// kept here: who holds elevated access, and when it was last confirmed.
//
// WHAT IS TEMPORARY. Adding and deactivating people belongs to an identity
// provider, and moves there when one is connected. The Org claim does not — a
// directory has no idea which ACME person is accountable for what — so that
// column is the part of this page with a long life. The banner says as much
// rather than leaving it to be discovered.
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, RotateCcw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { C } from "../../theme";
import { ORGS } from "../../engine";
import {
  Button, Callout, EmptyState, InlineHint, RemoveButton, Section, StatTile, StatusPill, TX, Well,
} from "../../components/wizard/WizardUI";
import { ROLES, ROLE_LABELS, initialsOf, isActive } from "../../auth/roster";
import type { User } from "../../auth/roster";
import { useRoster } from "../../auth/useRoster";
import {
  hasRosterEdits, isRuntimeUser, nextRuntimeUserId, removeRuntimeUser,
  restoreAuthoredRoster, upsertUser,
} from "../../auth/rosterStore";
import { validateRoster } from "../../auth/validateRoster";
import { UserEditorModal } from "./UserEditor";
import type { OrgId } from "../../graph/ids";

// How long an account's access stands before it needs looking at again. The
// same 90 days the procedure library's quarterly access review runs on, so the
// two do not tell the reader different things about the same cycle.
const RECERTIFY_DAYS = 90;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Never reviewed, or reviewed longer ago than the cycle allows. */
function isStale(user: User): boolean {
  return !user.recertifiedAt || daysSince(user.recertifiedAt) > RECERTIFY_DAYS;
}

export function UsersTab({ signedInId }: { signedInId: string }) {
  const roster = useRoster();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  // Only people are claimable: a login answers for a named individual, never for
  // a team or a business unit. The same rule validateRoster enforces, applied
  // here by simply not offering the others.
  const people = useMemo(
    () => ORGS.filter((org) => org.kind === "person").map((org) => ({ id: org.id as OrgId, name: org.name })),
    []
  );
  const orgs = useMemo(() => ORGS.map((org) => ({ id: org.id as string, kind: org.kind as string })), []);

  const problems = useMemo(() => validateRoster(roster, orgs), [roster, orgs]);
  const setProblems = problems.filter((p) => p.userId === null);

  const active = roster.filter(isActive);
  const admins = active.filter((u) => u.roles.includes(ROLES.ADMIN));
  const staleCount = active.filter(isStale).length;

  const editing = editingId ? roster.find((u) => u.id === editingId) : undefined;
  const removing = pendingRemove ? roster.find((u) => u.id === pendingRemove) : undefined;

  function recertify(user: User) {
    upsertUser({ ...user, recertifiedAt: today() });
  }

  function recertifyAll() {
    const stamp = today();
    active.filter(isStale).forEach((user) => upsertUser({ ...user, recertifiedAt: stamp }));
  }

  function setActive(user: User, next: boolean) {
    upsertUser({ ...user, active: next });
  }

  return (
    <div className="px-4 lg:px-8 pb-8 flex flex-col gap-6">
      {setProblems.length > 0 && (
        <Callout tone="warning" title="The roster has a problem.">
          {setProblems.map((p, i) => <div key={i}>{p.message}</div>)}
        </Callout>
      )}

      <Section
        icon={ShieldCheck}
        title="Access review"
        description="The same question this app asks of every other system: who holds elevated access here, and when did somebody last confirm they should."
        aside={
          staleCount > 0
            ? <Button size="sm" icon={Check} onClick={recertifyAll}>Recertify {staleCount}</Button>
            : undefined
        }
      >
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          <StatTile label="Can sign in" value={active.length} hint={`${roster.length - active.length} deactivated`} />
          <StatTile label="Hold Admin" value={admins.length} hint="Unrestricted, including this page" />
          <StatTile label="Awaiting review" value={staleCount} hint={`Never checked, or over ${RECERTIFY_DAYS} days`} />
          <StatTile label="Claim a person" value={active.filter((u) => u.orgId).length} hint="Resolvable to the Org register" />
        </div>
        {staleCount > 0 && (
          <div className="mt-3">
            <InlineHint tone="warning">
              {staleCount === active.length
                ? "No account here has ever been recertified."
                : `${staleCount} of ${active.length} accounts are past their review date.`}
            </InlineHint>
          </div>
        )}
      </Section>

      <Section
        icon={UserPlus}
        title="People"
        description="Adding and deactivating accounts moves to the identity provider once one is connected. Who each login is accountable for does not — a directory has no view of ACME's Org register — so that column outlives the rest of this page."
        aside={
          <div className="flex items-center gap-2">
            {hasRosterEdits() && (
              <Button size="sm" icon={RotateCcw} onClick={restoreAuthoredRoster}>Restore authored roster</Button>
            )}
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add user</Button>
          </div>
        }
      >
        {roster.length === 0 ? (
          <EmptyState>Nobody on the roster.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {roster.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === signedInId}
                claimedName={people.find((p) => p.id === user.orgId)?.name}
                problems={problems.filter((p) => p.userId === user.id).map((p) => p.message)}
                onEdit={() => setEditingId(user.id)}
                onRecertify={() => recertify(user)}
                onToggleActive={() => setActive(user, !isActive(user))}
                onRemove={isRuntimeUser(user.id) ? () => setPendingRemove(user.id) : undefined}
              />
            ))}
          </div>
        )}
      </Section>

      {(adding || editing) && (
        <UserEditorModal
          key={editing?.id ?? "new"}
          initial={editing}
          newId={nextRuntimeUserId()}
          roster={roster}
          people={people}
          orgs={orgs}
          isSelf={editing?.id === signedInId}
          onCancel={() => { setAdding(false); setEditingId(null); }}
          onSubmit={(user) => {
            upsertUser(user);
            setAdding(false);
            setEditingId(null);
          }}
        />
      )}

      {removing && (
        <Well className="flex items-start gap-3" style={{ borderColor: C.red }}>
          <AlertTriangle size={16} color={C.red} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <div className={TX.body} style={{ color: C.ink }}>
              Remove <b>{removing.name}</b>? Anything they already signed keeps their name on it — the record stays,
              the login goes.
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setPendingRemove(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                onClick={() => { removeRuntimeUser(removing.id); setPendingRemove(null); }}
              >
                Remove user
              </Button>
            </div>
          </div>
        </Well>
      )}
    </div>
  );
}

function UserRow({
  user, isSelf, claimedName, problems, onEdit, onRecertify, onToggleActive, onRemove,
}: {
  user: User;
  isSelf: boolean;
  claimedName?: string;
  problems: string[];
  onEdit: () => void;
  onRecertify: () => void;
  onToggleActive: () => void;
  onRemove?: () => void;
}) {
  const activeNow = isActive(user);
  const stale = isStale(user);

  return (
    <Well className="flex items-center gap-3 flex-wrap" style={{ opacity: activeNow ? 1 : 0.6 }}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
        style={{ background: C.accentBg, color: C.ink, border: `1px solid ${C.border}` }}
      >
        {initialsOf(user)}
      </div>

      <div className="min-w-0 flex-1" style={{ minWidth: 180 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: C.ink }}>{user.name || "Unnamed"}</span>
          {isSelf && <StatusPill tone="info">You</StatusPill>}
          {!activeNow && <StatusPill tone="neutral">Deactivated</StatusPill>}
          {isRuntimeUser(user.id) && <StatusPill tone="neutral">Added here</StatusPill>}
        </div>
        <div className={TX.help} style={{ color: C.muted }}>{user.email}</div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" style={{ minWidth: 200 }}>
        {user.roles.length === 0
          ? <StatusPill tone="warning">No role</StatusPill>
          : user.roles.map((role) => (
            <StatusPill key={role} tone={role === ROLES.ADMIN ? "warning" : "neutral"}>
              {ROLE_LABELS[role]}
            </StatusPill>
          ))}
      </div>

      <div style={{ minWidth: 150 }}>
        <div className={TX.help} style={{ color: C.muted }}>Accountable as</div>
        <div className={TX.body} style={{ color: claimedName ? C.ink : C.muted }}>
          {claimedName ?? "—"}
        </div>
      </div>

      <div style={{ minWidth: 130 }}>
        <div className={TX.help} style={{ color: C.muted }}>Access reviewed</div>
        <div className={TX.body} style={{ color: stale ? C.amber : C.ink }}>
          {user.recertifiedAt ?? "never"}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {activeNow && stale && <Button size="sm" icon={Check} onClick={onRecertify}>Recertify</Button>}
        <Button size="sm" onClick={onEdit}>Edit</Button>
        {/* Deactivating yourself locks you out of the page you are standing on,
            so it is not offered. Everything else about your own row is fair game. */}
        {!isSelf && (
          <Button size="sm" onClick={onToggleActive}>{activeNow ? "Deactivate" : "Reactivate"}</Button>
        )}
        {onRemove && !isSelf && <RemoveButton label={`Remove ${user.name}`} onClick={onRemove} />}
      </div>

      {problems.length > 0 && (
        <div className="w-full">
          <InlineHint tone="warning">{problems[0]}</InlineHint>
        </div>
      )}
    </Well>
  );
}
