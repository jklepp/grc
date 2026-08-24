import React, { useEffect, useState } from "react";
import { C } from "../theme";

// A load that finishes quickly should not paint anything at all.
//
// This is Boot's convention, lifted out so App's route boundaries can hold to
// it too. Showing a spinner the instant a chunk starts downloading reads as a
// flash of unrelated content on a fast connection, which is worse than a beat
// of the previous screen — so the spinner is held back, and a transition that
// lands inside the delay never shows one.
export const SPINNER_DELAY_MS = 200;

// `fill` is the difference between the two callers. Boot owns the whole window
// and centres in the viewport; a route boundary sits under a TopNav that must
// not move, so it fills its own pane instead.
export function DelayedSpinner({ label, fill = false }: { label: string; fill?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SPINNER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const frame: React.CSSProperties = fill
    ? { minHeight: "60vh", padding: 24 }
    : { background: C.bg, minHeight: "100dvh", padding: 24 };

  if (!visible) return <div className="flex items-center justify-center" style={frame} />;

  return (
    <div className="flex items-center justify-center" style={frame}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-full"
          style={{
            width: 26,
            height: 26,
            border: `2px solid ${C.panel2}`,
            borderTopColor: C.accent,
            animation: "grc-boot-spin 700ms linear infinite",
          }}
        />
        <div style={{ color: C.muted, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </div>
        <style>{"@keyframes grc-boot-spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </div>
  );
}
