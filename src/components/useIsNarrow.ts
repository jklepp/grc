import { useSyncExternalStore } from "react";

// The one place the layout's mobile breakpoint exists in JavaScript.
//
// It has to stay in step with Tailwind's `lg`, which is what every responsive
// class in this app switches on. The two cannot be derived from one another —
// Tailwind's value lives in its own defaults, this one in a media query — so
// they are named together here and nowhere else.
export const LG_BREAKPOINT_PX = 1024;

// Tailwind's `lg:` applies at >= 1024px, so "narrow" stops just short of it.
const NARROW_QUERY = `(max-width: ${LG_BREAKPOINT_PX - 0.02}px)`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(NARROW_QUERY).matches;
}

// True below the width the layout switches at.
//
// Reach for this only where a surface must *not render* rather than be hidden —
// CSS is cheaper and does not re-render, so `hidden lg:block` is the default
// answer and this is the exception. It answers "does this fit", never "may this
// person do it": permission comes from `src/auth/gates.ts` and nowhere else,
// and a viewport value must never be composed with a `Permission` or passed
// into a gate. Fits and may are different questions with different answers.
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
