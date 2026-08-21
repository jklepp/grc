import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { C } from "../../theme";
import type { AssetId } from "../../graph/ids";

export interface AssetOption { assetId: AssetId; label: string }

export function fieldLabel(children: ReactNode) {
  return <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{children}</div>;
}

// A function, not a hoisted object literal — C's values are mutated in place
// by theme.js's applyTheme() on every theme change, so a plain object built
// once at module load would freeze whatever C.panel held before the app's
// default theme was ever applied. Calling this at render time reads the live
// values instead.
export function inputStyle(): CSSProperties {
  return {
    background: C.panel, border: `1px solid ${C.border}`, color: C.ink,
    borderRadius: 8, padding: "6px 8px", fontSize: 12, width: "100%",
  };
}

export function selectedValue<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}
