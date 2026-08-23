import { Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// One tab today. The shell exists so the next settings surface — integration
// credentials, tier baselines, whatever the fake "Vanta · 8m ago" pill in the
// top bar eventually becomes — has an obvious home rather than becoming a sixth
// top-level page.
export const SETTINGS_TABS = [
  { id: "users", label: "Users", icon: Users },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.some((t) => t.id === value);
}
