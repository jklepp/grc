import { Info, Network, Database, Fingerprint, ShieldCheck, Crosshair, Layers, TrendingUp, Boxes, ListTodo, ListChecks, ClipboardList } from "lucide-react";

// `group` drives WorkspaceTabBar's layout: "primary" tabs render inline,
// "details" tabs are folded behind the "Details" dropdown, and the single
// "details-home" tab is the page that dropdown's own button opens — it is
// never drawn as a chip, but it does lead the dropdown as its own row, above
// a divider, so it is reachable without knowing the button is also a link.
// Every other id/URL below is unchanged from before the grouping existed.
export const SUB_TABS = [
  { id: "overview", label: "Overview", icon: Info, group: "primary" },
  { id: "architecture", label: "Architecture", icon: Network, group: "primary" },
  { id: "controls", label: "Controls", icon: Layers, group: "primary" },
  { id: "findings", label: "Findings", icon: ListTodo, group: "primary" },
  { id: "actions", label: "Actions", icon: ListChecks, group: "primary" },
  { id: "details", label: "Details", icon: ClipboardList, group: "details-home" },
  { id: "data", label: "Data", icon: Database, group: "details" },
  { id: "identity", label: "Identity", icon: Fingerprint, group: "details" },
  { id: "security", label: "Security", icon: ShieldCheck, group: "details" },
  { id: "testing", label: "Testing", icon: Crosshair, group: "details" },
  { id: "risk", label: "Risk", icon: TrendingUp, group: "details" },
  { id: "assets", label: "Assets", icon: Boxes, group: "details" },
] as const;

export type SystemWorkspaceTab = (typeof SUB_TABS)[number]["id"];
