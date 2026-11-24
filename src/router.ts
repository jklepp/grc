import type { NavigationPageId } from "./components/TopNav";
import { SUB_TABS } from "./pages/SystemWorkspace/tabs";
import type { SystemWorkspaceTab } from "./pages/SystemWorkspace/tabs";
import type { SystemId } from "./graph/ids";

// The URL hash is the single source of truth for where the user is:
//   #/overview[/dashboard|schedule] → risk-register|footprint parse, then fall
//                                   back to dashboard while deprecated
//   #/systems                     → system picker
//   #/systems/<SystemId>[/<tab>]  → one system's workspace, on a tab
//   #/compliance[/ccf|frameworks|audits|obligations]
//   #/compliance/audits/<EngagementId>[/<tab>] → one audit, opened on a tab
//   #/governance[/policy|procedures|principles|exceptions]  (old compliance
//                                   areas here redirect to #/compliance)
//   #/graph
//   #/settings[/users]            → admin only, reached from the user menu
// App owns parsing/serializing; pages keep navigating through onNavigate ids.
export interface AppRoute {
  page: NavigationPageId;
  /** Page-level tab/area (validated by each page's own guard). */
  tab?: string;
  /** data-estate only: null = picker, an id = that system's workspace. */
  systemId?: SystemId | null;
  /** data-estate only: workspace tab within the selected system. */
  systemTab?: SystemWorkspaceTab;
  /** compliance/audits only: the engagement opened in place. */
  engagementId?: string;
  /** compliance/audits only: the engagement's tab (validated by EngagementDetail). */
  engagementTab?: string;
}

const PAGE_BY_SLUG: Record<string, NavigationPageId> = {
  overview: "overview",
  systems: "data-estate",
  compliance: "compliance",
  governance: "governance",
  graph: "graph-explorer",
  settings: "settings",
};

const SLUG_BY_PAGE = Object.fromEntries(
  Object.entries(PAGE_BY_SLUG).map(([slug, page]) => [page, slug])
) as Record<NavigationPageId, string>;

function isSystemWorkspaceTab(value: string): value is SystemWorkspaceTab {
  return SUB_TABS.some((t) => t.id === value);
}

export function parseHash(hash: string): AppRoute | null {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const page = segments[0] ? PAGE_BY_SLUG[segments[0]] : undefined;
  if (!page) return null;
  if (page === "data-estate") {
    const systemId = (segments[1] as SystemId | undefined) ?? null;
    const systemTab = segments[2] && isSystemWorkspaceTab(segments[2]) ? segments[2] : undefined;
    return { page, systemId, systemTab };
  }
  if (page === "compliance" && segments[1] === "audits" && segments[2]) {
    return { page, tab: segments[1], engagementId: segments[2], engagementTab: segments[3] };
  }
  return { page, tab: segments[1] };
}

export function hashForRoute(route: AppRoute): string {
  const parts = [SLUG_BY_PAGE[route.page]];
  if (route.page === "data-estate") {
    if (route.systemId) {
      parts.push(encodeURIComponent(route.systemId));
      if (route.systemTab) parts.push(route.systemTab);
    }
  } else if (route.tab) {
    parts.push(encodeURIComponent(route.tab));
    if (route.page === "compliance" && route.engagementId) {
      parts.push(encodeURIComponent(route.engagementId));
      if (route.engagementTab) parts.push(encodeURIComponent(route.engagementTab));
    }
  }
  return `#/${parts.join("/")}`;
}
