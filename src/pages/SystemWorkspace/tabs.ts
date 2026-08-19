import { Info, Network, Database, Fingerprint, ShieldCheck, Crosshair, Layers, TrendingUp, Boxes } from "lucide-react";

export const SUB_TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "architecture", label: "Architecture", icon: Network },
  { id: "data", label: "Data", icon: Database },
  { id: "identity", label: "Identity", icon: Fingerprint },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "testing", label: "Testing", icon: Crosshair },
  { id: "controls", label: "Controls", icon: Layers },
  { id: "risk", label: "Risk", icon: TrendingUp },
  { id: "assets", label: "Assets", icon: Boxes },
] as const;

export type SystemWorkspaceTab = (typeof SUB_TABS)[number]["id"];
