// One user's row, as a form.
//
// Rail-less and modal, the same shape as FindingEditor's modal (CONTRACT 4.10):
// there are no steps to walk, so there is no rail to head, and the flow name
// rides the eyebrow instead of inventing a "1 of 1".
//
// The form does not carry its own rules. It applies the draft to the roster,
// runs validateRoster over the result, and reports what comes back — the same
// function scripts/check-roster.mjs runs at build time. A rule can therefore
// never exist in one of those places and not the other, which is the failure
// mode a settings page editing an authored file invites.
import { useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import Modal, { ModalCloseButton } from "../../components/Modal";
import {
  Button, Callout, ChoiceChip, Field, FieldGrid, InlineHint, Select, TextInput,
  WizardBody, WizardChrome, WizardFooter, WizardHeader, WizardPane, TX,
} from "../../components/wizard/WizardUI";
import { C } from "../../theme";
import { ROLE_LABELS, ROLES } from "../../auth/roster";
import type { Role, User } from "../../auth/roster";
import { ALL_ROLES, validateRoster } from "../../auth/validateRoster";
import type { OrgLike } from "../../auth/validateRoster";
import type { OrgId } from "../../graph/ids";

// What each role is FOR, one line, shown while it is being chosen. Someone
// assigning a role should not have to leave the form to find out what it grants.
const ROLE_BLURB: Record<Role, string> = {
  admin: "Everything, including deleting systems and managing this page.",
  assessor: "Grades controls, decides scope, raises findings, adds systems.",
  owner: "Edits and answers for the systems the person they claim is accountable for.",
  auditor: "Reads everything. Writes nothing, anywhere.",
};

export interface UserEditorProps {
  /** The user being edited, or undefined when adding one. */
  initial?: User;
  /** The id a new user will be given. */
  newId: string;
  /** The whole roster, so the draft can be validated in context. */
  roster: readonly User[];
  /** Org people a user may claim. */
  people: readonly { id: OrgId; name: string }[];
  orgs: readonly OrgLike[];
  /** True when the editor is open on the signed-in user's own row. */
  isSelf: boolean;
  onCancel: () => void;
  onSubmit: (user: User) => void;
}

export function UserEditorModal({ initial, newId, roster, people, orgs, isSelf, onCancel, onSubmit }: UserEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roles, setRoles] = useState<Role[]>(initial?.roles ?? []);
  const [orgId, setOrgId] = useState<string>(initial?.orgId ?? "");

  const draft: User = useMemo(() => ({
    ...initial,
    id: initial?.id ?? newId,
    name: name.trim(),
    email: email.trim(),
    roles,
    ...(orgId ? { orgId: orgId as OrgId } : {}),
  }), [initial, newId, name, email, roles, orgId]);

  // Validate the roster this save would produce, not the row on its own —
  // duplicate emails and two people claiming one org are only visible in context.
  const problems = useMemo(() => {
    const next = roster.some((u) => u.id === draft.id)
      ? roster.map((u) => (u.id === draft.id ? draft : u))
      : [...roster, draft];
    return validateRoster(next, orgs).filter((p) => p.userId === draft.id || p.userId === null);
  }, [roster, draft, orgs]);

  // An admin who removes their own Admin role loses this page mid-edit and has
  // to find someone else to give it back. Blocked rather than confirmed: there
  // is no version of this that ends well by accident.
  const selfDemotion = isSelf && (initial?.roles.includes(ROLES.ADMIN) ?? false) && !roles.includes(ROLES.ADMIN);
  const blocker = selfDemotion
    ? "You cannot remove your own Admin role. Another admin can do it for you."
    : problems[0]?.message ?? null;

  function toggleRole(role: Role) {
    setRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));
  }

  const fieldError = (field: string) =>
    problems.find((p) => p.field === field && p.userId === draft.id)?.message ?? null;

  return (
    <Modal open onClose={onCancel} width={720} height={660}>
      <WizardChrome>
        <WizardHeader
          icon={UserCog}
          eyebrow={["User", initial?.id].filter(Boolean).join(" · ")}
          title={initial ? initial.name || "Edit user" : "Add user"}
          onClose={<ModalCloseButton onClose={onCancel} />}
        />
        <WizardBody single>
          <WizardPane>
            {problems.some((p) => p.userId === null) && (
              <Callout tone="warning" title="This change would leave the roster inconsistent.">
                {problems.filter((p) => p.userId === null).map((p, i) => <div key={i}>{p.message}</div>)}
              </Callout>
            )}

            <FieldGrid cols={2}>
              <Field label="Name" note="Signs every record this person writes." error={fieldError("name")}>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. J. Ortiz" />
              </Field>
              <Field label="Email" note="What they sign in with." error={fieldError("email")}>
                <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@acme.example" />
              </Field>

              <Field label="Roles" span2 error={fieldError("roles")}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((role) => (
                      <ChoiceChip
                        key={role}
                        selected={roles.includes(role)}
                        ariaLabel={ROLE_LABELS[role]}
                        onClick={() => toggleRole(role)}
                      >
                        <span className="normal-case">{ROLE_LABELS[role]}</span>
                      </ChoiceChip>
                    ))}
                  </div>
                  {roles.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {roles.map((role) => (
                        <div key={role} className={TX.help} style={{ color: C.muted }}>
                          <b style={{ color: C.ink }}>{ROLE_LABELS[role]}</b> — {ROLE_BLURB[role]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              <Field
                label="Accountable as"
                span2
                note="The person in the Org register this login answers for. It decides which systems and findings a System Owner owns; an assessor or auditor needs none."
                error={fieldError("orgId")}
              >
                <Select value={orgId} aria-label="Accountable as" onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">Nobody — claims no accountability</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            </FieldGrid>
          </WizardPane>
        </WizardBody>
        <WizardFooter
          position={initial ? "Changes apply the moment they are saved" : "A new login for this prototype"}
          hint={blocker ? <InlineHint tone="warning">{blocker}</InlineHint> : undefined}
          close={<Button onClick={onCancel}>Cancel</Button>}
          primary={(
            <Button variant="primary" disabled={Boolean(blocker)} onClick={() => onSubmit(draft)}>
              {initial ? "Save user" : "Add user"}
            </Button>
          )}
        />
      </WizardChrome>
    </Modal>
  );
}
