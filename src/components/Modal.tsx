import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { C } from "../theme";

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
  children: ReactNode;
}

export default function Modal({ open, onClose, width = 960, height = 700, variant = "panel", children }: ModalProps) {
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

  const fullscreen = variant === "fullscreen";

  return (
    <div
      // Edge to edge when fullscreen: the point is maximum canvas, and a scrim
      // margin around a panel that is already filling the window is just border
      // you cannot use. Clicking out is still possible on the panel variant;
      // here Esc and the close button are the way out.
      className={`fixed inset-0 z-50 flex items-center justify-center ${fullscreen ? "p-0" : "p-6"}`}
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`overflow-hidden flex flex-col ${fullscreen ? "" : "rounded-2xl"}`}
        style={{
          width: fullscreen ? "100%" : `min(${width}px, 100%)`,
          height: fullscreen ? "100%" : `min(${height}px, 100%)`,
          background: C.panel,
          border: fullscreen ? "none" : `1px solid ${C.border}`,
          boxShadow: fullscreen ? "none" : "0 24px 64px -12px rgba(0,0,0,0.45)",
        }}
      >
        {children}
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
