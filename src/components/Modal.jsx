import React, { useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../theme";

// Generic overlay + centered panel. No app primitive existed for this before
// the Add System wizard — kept deliberately small (scrim, esc-to-close, panel
// shell) rather than growing size/footer/etc. variants nothing else needs yet.
export default function Modal({ open, onClose, width = 960, height = 700, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: `min(${width}px, 100%)`,
          height: `min(${height}px, 100%)`,
          background: C.panel,
          border: `1px solid ${C.border}`,
          boxShadow: "0 24px 64px -12px rgba(0,0,0,0.45)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalCloseButton({ onClose }) {
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
