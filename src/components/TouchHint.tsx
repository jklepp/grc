import React, { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { C } from "../theme";
import { useIsNarrow } from "./useIsNarrow";

// A `title` tooltip that a finger can reach.
//
// Most `title` attributes in this app repeat something already on screen, and
// those can simply go dark on touch. A few carry the only copy of a fact — what
// "Formally Assessed" actually claims, what a basis means — and on a phone
// those were unreadable, because a pointer has hover and a finger does not.
//
// At `lg` and up this renders its child and nothing else: the caller keeps its
// own `title`, the DOM is untouched, and the native tooltip behaves exactly as
// it did. The tap affordance exists only below the breakpoint, where the
// tooltip does not.
export function TouchHint({ hint, children }: { hint: string; children: ReactNode }) {
  const isNarrow = useIsNarrow();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // pointerdown rather than mousedown: a touch never fires the latter until
  // after a synthetic delay, which leaves the bubble open under the next tap.
  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!isNarrow) return <>{children}</>;

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={hint}
        className="inline-flex items-center"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-30 block w-[min(280px,72vw)] rounded-lg p-2.5 text-[11px] leading-relaxed"
          style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink, boxShadow: "0 12px 28px rgba(0,0,0,0.28)" }}
        >
          {hint}
        </span>
      )}
    </span>
  );
}
