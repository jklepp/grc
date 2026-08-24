// Settings — administration of the app itself, rather than of anything it
// assesses. One tab today; the shell exists so the next one has somewhere to go
// instead of becoming a sixth top-level page.
//
// Gated whole rather than per-control: there is nothing on this page a
// non-admin has any business reading, which is different from every other
// surface in the app (an auditor reads everything and writes nothing). So this
// is the one place that refuses at the door.
import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader, TabBar } from "../../components/Headings";
import { Callout } from "../../components/wizard/WizardUI";
import { useSignedInUser } from "../../auth/useUser";
import { allows, canManageUsers, ROLE_CAPABILITIES } from "../../auth/gates";
import { ROLE_LABELS } from "../../auth/roster";
import { C } from "../../theme";
import { SETTINGS_TABS, isSettingsTab } from "./tabs";
import type { SettingsTab } from "./tabs";
import { UsersTab } from "./UsersTab";

export default function Settings({ initialTab }: { initialTab?: string }) {
  const user = useSignedInUser();
  const [tab, setTab] = useState<SettingsTab>(isSettingsTab(initialTab) ? initialTab : "users");

  if (!allows(canManageUsers(user))) {
    return (
      <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
        <PageHeader icon={SettingsIcon} title="Settings" />
        <div className="px-4 lg:px-8 pb-8">
          <Callout tone="warning" title="Settings is for admins.">
            <p>
              You are signed in as {user.name} ({user.roles.map((r) => ROLE_LABELS[r]).join(", ")}). Managing who can
              sign in, and what they hold, needs the Admin role.
            </p>
          </Callout>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Administration of ACME ASSURE itself — who can sign in, and what each of them may do."
      />
      <TabBar tabs={SETTINGS_TABS} active={tab} onChange={setTab} variant="secondary" />
      <div className="pt-6" />
      {tab === "users" && (
        <>
          <UsersTab signedInId={user.id} />
          <RoleReference />
        </>
      )}
    </div>
  );
}

// What each role can actually do, rendered from the table that lives beside the
// predicates in gates.ts. Written there rather than here on purpose: a
// permissions table maintained where it is displayed drifts from the code that
// enforces it, and nobody notices until someone is refused something the page
// told them they could do.
function RoleReference() {
  return (
    <div className="px-4 lg:px-8 pb-10">
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>What each role can do</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: C.muted }}>
            Read from the same file that enforces it. A qualifier means the role alone does not settle it.
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left" style={{ borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                  Act
                </th>
                {(["admin", "assessor", "owner", "auditor"] as const).map((role) => (
                  <th
                    key={role}
                    className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-center"
                    style={{ color: C.muted, whiteSpace: "nowrap" }}
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_CAPABILITIES.map((cap) => (
                <tr key={cap.act} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="px-4 py-2.5 text-[12.5px]" style={{ color: C.ink }}>
                    {cap.act}
                    {cap.qualifier && (
                      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{cap.qualifier}</div>
                    )}
                  </td>
                  {(["admin", "assessor", "owner", "auditor"] as const).map((role) => (
                    <td key={role} className="px-3 py-2.5 text-center text-[13px]" style={{ color: cap.roles.includes(role) ? C.green : C.border }}>
                      {cap.roles.includes(role) ? "●" : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
