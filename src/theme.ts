// Shared design tokens for the whole app.
// C and CLASS_META are mutable objects — every page imports them once and reads
// properties at render time, so calling applyTheme() updates the whole app in place
// without needing Context or prop drilling.

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

export const DARK = {
  bg: "#0F1420",
  panel: "#171D2B",
  panel2: "#1D2433",
  border: "#2A3244",
  borderStrong: "#242B3A",
  ink: "#E7E9EE",
  muted: "#8891A3",
  accent: "#8C7AE6",
  // A deeper shade of accent for surfaces that need a solid fill rather than
  // a text/border color — e.g. the active pill on a selected tab, where the
  // base accent reads too light against dark ink text on top of it.
  accentStrong: "#5B4BB8",
  green: "#5FB98A",
  // Severity escalation now runs green -> teal -> blue -> indigo instead of
  // the traffic-light green -> amber -> red. No hue in this ramp reads as a
  // stop-light "warning" or "danger" color; escalation is carried by
  // increasing saturation/darkness (light teal -> deep indigo) the same way
  // the System Badges tier gradients already do. Token keys are still named
  // `amber`/`red`/`amberBg`/`redBg` everywhere they're consumed
  // (criticality/risk/assurance bands, dozens of pages) — renaming those
  // keys isn't worth the blast radius since only the rendered hex is
  // user-visible, not the internal name.
  amber: "#4E8FD6",
  red: "#3E4F9E",
  na: "#4A5265",
  greenBg: "rgba(95,185,138,0.12)",
  amberBg: "rgba(78,143,214,0.12)",
  redBg: "rgba(62,79,158,0.12)",
  accentBg: "rgba(140,122,230,0.15)",
};

export const LIGHT = {
  bg: "#F5F6FA",
  panel: "#FFFFFF",
  panel2: "#F0F1F7",
  border: "#E4E6EF",
  borderStrong: "#D2D4DC",
  ink: "#1B1E2B",
  muted: "#6B7280",
  accent: "#6C5DD3",
  accentStrong: "#4A3C99",
  green: "#1F9254",
  amber: "#2E6CB5", // same blue family as DARK.amber, darkened/saturated to match this palette's contrast pattern
  red: "#2C3B85", // same indigo family as DARK.red, darkened/saturated to match this palette's contrast pattern
  na: "#9AA2B0",
  greenBg: "rgba(31,146,84,0.10)",
  amberBg: "rgba(46,108,181,0.10)",
  redBg: "rgba(44,59,133,0.10)",
  accentBg: "rgba(108,93,211,0.10)",
};

// Mutable — start dark, mutated in place by applyTheme()
export const C = { ...DARK };

export type ThemeMode = "dark" | "light";
export type ClassificationLabel = "Public" | "Internal" | "Confidential" | "Restricted";

const CLASS_META_DARK = {
  Public: { bg: "rgba(140,148,158,0.15)", color: "#AEB6C2" },
  Internal: { bg: "rgba(108,134,209,0.15)", color: "#93A8E6" },
  Confidential: { bg: "rgba(150,110,190,0.18)", color: "#C9A6E8" },
  Restricted: { bg: "rgba(204,127,194,0.18)", color: "#CC7FC2" },
};
const CLASS_META_LIGHT = {
  Public: { bg: "rgba(91,100,114,0.10)", color: "#5B6472" },
  Internal: { bg: "rgba(61,90,196,0.10)", color: "#3D5AC4" },
  Confidential: { bg: "rgba(122,74,163,0.10)", color: "#7A4AA3" },
  Restricted: { bg: "rgba(163,74,150,0.10)", color: "#A34A96" },
};

// Mutable — start dark, mutated in place by applyTheme()
export const CLASS_META = {
  Public: { ...CLASS_META_DARK.Public },
  Internal: { ...CLASS_META_DARK.Internal },
  Confidential: { ...CLASS_META_DARK.Confidential },
  Restricted: { ...CLASS_META_DARK.Restricted },
};
export const CLASS_ORDER: ClassificationLabel[] = ["Public", "Internal", "Confidential", "Restricted"];

export function applyTheme(mode: ThemeMode): void {
  Object.assign(C, mode === "light" ? LIGHT : DARK);
  const classSource = mode === "light" ? CLASS_META_LIGHT : CLASS_META_DARK;
  (Object.keys(classSource) as ClassificationLabel[]).forEach((key) => Object.assign(CLASS_META[key], classSource[key]));
}
