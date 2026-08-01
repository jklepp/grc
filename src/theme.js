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
  ink: "#E7E9EE",
  muted: "#8891A3",
  accent: "#8C7AE6",
  green: "#5FB98A",
  amber: "#E0A94E",
  red: "#E0716A",
  na: "#4A5265",
  greenBg: "rgba(95,185,138,0.12)",
  amberBg: "rgba(224,169,78,0.12)",
  redBg: "rgba(224,113,106,0.12)",
  accentBg: "rgba(140,122,230,0.15)",
};

export const LIGHT = {
  bg: "#F5F6FA",
  panel: "#FFFFFF",
  panel2: "#F0F1F7",
  border: "#E4E6EF",
  ink: "#1B1E2B",
  muted: "#6B7280",
  accent: "#6C5DD3",
  green: "#1F9254",
  amber: "#B87A1E",
  red: "#C74A3F",
  na: "#9AA2B0",
  greenBg: "rgba(31,146,84,0.10)",
  amberBg: "rgba(184,122,30,0.10)",
  redBg: "rgba(199,74,63,0.10)",
  accentBg: "rgba(108,93,211,0.10)",
};

// Mutable — start dark, mutated in place by applyTheme()
export const C = { ...DARK };

const CLASS_META_DARK = {
  Public: { bg: "rgba(140,148,158,0.15)", color: "#AEB6C2" },
  Internal: { bg: "rgba(108,134,209,0.15)", color: "#93A8E6" },
  Confidential: { bg: "rgba(150,110,190,0.18)", color: "#C9A6E8" },
  Restricted: { bg: "rgba(224,113,142,0.18)", color: "#E8899F" },
};
const CLASS_META_LIGHT = {
  Public: { bg: "rgba(91,100,114,0.10)", color: "#5B6472" },
  Internal: { bg: "rgba(61,90,196,0.10)", color: "#3D5AC4" },
  Confidential: { bg: "rgba(122,74,163,0.10)", color: "#7A4AA3" },
  Restricted: { bg: "rgba(199,74,111,0.10)", color: "#C74A6F" },
};

// Mutable — start dark, mutated in place by applyTheme()
export const CLASS_META = {
  Public: { ...CLASS_META_DARK.Public },
  Internal: { ...CLASS_META_DARK.Internal },
  Confidential: { ...CLASS_META_DARK.Confidential },
  Restricted: { ...CLASS_META_DARK.Restricted },
};
export const CLASS_ORDER = ["Public", "Internal", "Confidential", "Restricted"];

export function applyTheme(mode) {
  Object.assign(C, mode === "light" ? LIGHT : DARK);
  const classSource = mode === "light" ? CLASS_META_LIGHT : CLASS_META_DARK;
  Object.keys(classSource).forEach((key) => Object.assign(CLASS_META[key], classSource[key]));
}
