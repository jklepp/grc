import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { C } from "../theme";
import { useIsNarrow } from "./useIsNarrow";

// Generic overlay + centered panel. No app primitive existed for this before
// the Add System wizard — kept deliberately small (scrim, esc-to-close, panel
// shell) rather than growing size/footer/etc. variants nothing else needs yet.
interface ModalProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  height?: number;
  // "fullscreen" fills the browser WINDOW instead of sizing to width/height —
  // for surfaces whose whole point is room (the system canvas expanded).
  //
  // The window, deliberately, not the screen. An earlier pass drove the native
  // Fullscreen API here, which takes over the whole monitor the way F11 does
  // and hides the app around it; that is a bigger, more disorienting thing than
  // "make this panel big" and it is not what expanding a diagram should mean.
  variant?: "panel" | "fullscreen";
  // Names the surface inside, for panels that cannot be used below the
  // mobile breakpoint. Set it on every panel that records a decision: the
  // reader gets one sentence saying where to go instead of a 1180px wizard
  // folded into a 390px screen. Modal owns this because Modal already owns
  // how much room a panel needs — `width`, `height`, and the min() clamp
  // below are the same question one step earlier.
  //
  // This is a viewport decision and never a permission one; see useIsNarrow.
  requiresRoom?: string;
  children: ReactNode;
}

// Shown in place of a panel that has no room to lay itself out. Deliberately
// not a wizard screen: when this renders there is no wizard, so it composes
// nothing from WizardUI and CONTRACT.md's chrome rules have nothing to say
// about it.
function NeedsRoom({ what, onClose }: { what: string; onClose: () => void }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
        {what} needs a wider screen
      </h2>
      <p className="text-sm mt-3 leading-relaxed" style={{ color: C.muted }}>
        Recording a decision — scope, a control assessment, a finding and its CAP —
        needs a desktop-width window to lay the work out.
      </p>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>
        On a phone, ACME ASSURE is for reading: the dashboards, the System Register,
        a system's profile, its findings, and the governance pages.
      </p>
      <div className="flex justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-semibold"
          style={{ color: C.ink, border: `1px solid ${C.border}` }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function Modal({ open, onClose, width = 960, height = 700, variant = "panel", requiresRoom, children }: ModalProps) {
  // Read before the early return below, as hooks must be. A narrow screen
  // makes the panel render the notice INSTEAD of its children, rather than
  // hiding them with CSS, so a 2,300-line wizard nobody can see never mounts.
  const isNarrow = useIsNarrow();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock the page behind the scrim: without this, wheel events the modal
  // doesn't consume scroll the document underneath it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;

  const tooNarrow = Boolean(requiresRoom) && isNarrow;
  const fullscreen = variant === "fullscreen" && !tooNarrow;

  return (
    <div
      // Edge to edge when fullscreen: the point is maximum canvas, and a scrim
      // margin around a panel that is already filling the window is just border
      // you cannot use. Clicking out is still possible on the panel variant;
      // here Esc and the close button are the way out.
      className={`fixed inset-0 z-50 flex items-center justify-center ${fullscreen ? "p-0" : "p-3 lg:p-6"}`}
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`overflow-hidden flex flex-col ${fullscreen ? "" : "rounded-2xl"}`}
        style={{
          width: tooNarrow ? "min(400px, 100%)" : fullscreen ? "100%" : `min(${width}px, 100%)`,
          height: tooNarrow ? "auto" : fullscreen ? "100%" : `min(${height}px, 100%)`,
          background: C.panel,
          border: fullscreen ? "none" : `1px solid ${C.border}`,
          boxShadow: fullscreen ? "none" : "0 24px 64px -12px rgba(0,0,0,0.45)",
        }}
      >
        {tooNarrow && requiresRoom ? <NeedsRoom what={requiresRoom} onClose={onClose} /> : children}
      </div>
    </div>
  );
}

export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="rounded-lg p-1.5 transition-colors"
      style={{ color: C.muted }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <X size={16} />
    </button>
  );
}
