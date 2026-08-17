import React from "react";
import { Building2 } from "lucide-react";

// Brand-color monogram badges for hosting providers — a recognizable mark
// instead of plain text, without pulling in external logo assets. Falls back
// to a generic building icon for providers not in the map (e.g. a bespoke
// SaaS tenant name).
const PROVIDER_STYLE = {
  AWS: { label: "AWS", bg: "#FF9900", color: "#0F1420" },
  Azure: { label: "Az", bg: "#0078D4", color: "#fff" },
  GCP: { label: "GCP", bg: "#4285F4", color: "#fff" },
  Workday: { label: "WD", bg: "#F62D00", color: "#fff" },
};

export function ProviderBadge({ provider, size = 16 }) {
  const style = PROVIDER_STYLE[provider];
  if (!style) {
    return <Building2 size={size} className="shrink-0" />;
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm font-bold shrink-0"
      style={{ background: style.bg, color: style.color, width: size + 6, height: size, fontSize: size * 0.5, lineHeight: 1 }}
    >
      {style.label}
    </span>
  );
}
