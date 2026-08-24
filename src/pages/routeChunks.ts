import type { NavigationPageId } from "../components/TopNav";

// One chunk per top-level page.
//
// Landing on a system's workspace used to download Governance's control
// catalogue, the Graph Explorer and Settings too, because App's switch only
// ever picked between modules that were already loaded.
//
// These live in their own module rather than beside the `lazy()` calls in
// App.tsx so that App keeps exporting only its component — a module that
// exports both a component and a constant loses fast refresh.
//
// Naming the factories also lets the nav warm a chunk on hover: the module
// registry dedupes, so a prefetch and the matching `lazy()` resolve to one
// request rather than two.
export const ROUTE_CHUNKS: Record<NavigationPageId, () => Promise<unknown>> = {
  "data-estate": () => import("./Systems"),
  governance: () => import("./Governance"),
  overview: () => import("./Overview"),
  "graph-explorer": () => import("./GraphExplorer"),
  settings: () => import("./Settings/Settings"),
};

// Fire-and-forget. A failed prefetch is not an error worth surfacing — the
// real navigation will request the chunk again and report properly if it is
// genuinely unreachable.
export function prefetchRoute(page: NavigationPageId): void {
  void ROUTE_CHUNKS[page]?.().catch(() => {});
}
