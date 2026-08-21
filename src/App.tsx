import React, { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import TopNav from "./components/TopNav";
import type { NavigationPageId } from "./components/TopNav";
import Controls from "./pages/Controls";
import Systems from "./pages/Systems";
import Governance from "./pages/Governance";
import Overview from "./pages/Overview";
import GraphExplorer from "./pages/GraphExplorer";
import Login from "./pages/Login";
import { DEFAULT_SYSTEM_ID } from "./pages/SystemWorkspace/SystemWorkspace";
import type { SystemWorkspaceTab } from "./pages/SystemWorkspace/tabs";
import type { SystemSelectOptions } from "./pages/SelectSystem";
import type { SystemId } from "./graph/ids";
import { hashForRoute, parseHash } from "./router";
import type { AppRoute } from "./router";
import { C, applyTheme, FONT_IMPORT } from "./theme";
import type { ThemeMode } from "./theme";

type ControlsTab = NonNullable<ComponentProps<typeof Controls>["initialTab"]>;
type GovernanceTab = NonNullable<ComponentProps<typeof Governance>["initialTab"]>;
type OverviewTab = NonNullable<ComponentProps<typeof Overview>["initialTab"]>;

function controlsTab(tab?: string): ControlsTab | undefined {
  return tab === "ccf" || tab === "control-profile" ? tab : undefined;
}

function governanceTab(tab?: string): GovernanceTab | undefined {
  return tab === "policy" || tab === "procedures" || tab === "principles" || tab === "schedule" || tab === "exceptions" ? tab : undefined;
}

function overviewTab(tab?: string): OverviewTab | undefined {
  return tab === "dashboard" || tab === "risk-register" || tab === "footprint" ? tab : undefined;
}

// Old top-level ids for pages that got folded into a consolidated page (e.g.
// "asset-register" into Data Estate). Other pages still call onNavigate with
// these ids, so this keeps those links working — landing on the consolidated
// page, opened to the tab the old id used to mean — without having to touch
// every caller each time another consolidation happens.
interface LegacyRoute {
  page: NavigationPageId;
  tab: string;
}

const LEGACY_ROUTES = {
  "data-footprint": { page: "overview", tab: "footprint" },
  "risk-register": { page: "overview", tab: "risk-register" },
  "executive-dashboard": { page: "overview", tab: "dashboard" },
  "data-map": { page: "data-estate", tab: "map" },
  "gap-matrix": { page: "data-estate", tab: "profile" },
  "asset-register": { page: "data-estate", tab: "assets" },
  ccf: { page: "assurance", tab: "ccf" },
  "control-profile": { page: "assurance", tab: "control-profile" },
  "policy-center": { page: "governance", tab: "policy" },
  "procedure-library": { page: "governance", tab: "procedures" },
  "security-principles": { page: "governance", tab: "principles" },
  "activity-timeliness": { page: "governance", tab: "schedule" },
  "exception-register": { page: "governance", tab: "exceptions" },
  ssp: { page: "data-estate", tab: "profile" },
} satisfies Record<string, LegacyRoute>;

// Legacy data-estate tab ids predate the System Workspace; they map onto its
// own tabs so old deep-links still land on the right one.
const SYSTEM_TAB_BY_LEGACY_TAB: Record<string, SystemWorkspaceTab> = {
  profile: "overview",
  map: "architecture",
  assets: "assets",
};

function legacyRouteFor(id: string): LegacyRoute | undefined {
  return Object.entries(LEGACY_ROUTES).find(([routeId]) => routeId === id)?.[1];
}

const PAGE_IDS: NavigationPageId[] = ["overview", "data-estate", "assurance", "governance", "graph-explorer"];

function isNavigationPageId(id: string): id is NavigationPageId {
  return (PAGE_IDS as string[]).includes(id);
}

// Post-login landing: Production AI Platform's workspace, same as before.
const DEFAULT_ROUTE: AppRoute = { page: "data-estate", systemId: DEFAULT_SYSTEM_ID };

const AUTH_STORAGE_KEY = "grc-authenticated";
const THEME_STORAGE_KEY = "grc-theme-mode";

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash) ?? DEFAULT_ROUTE);
  const [startAssessment, setStartAssessment] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(() =>
    localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"
  );
  // No real auth is wired up yet — this just gates the UI behind the login
  // screen. sessionStorage keeps a refresh from dumping the user back to it.
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(AUTH_STORAGE_KEY) === "1");

  // Mutates the shared C / CLASS_META objects in theme.ts in place, before this
  // render reads any of their properties. Every page imports those same objects,
  // so this one call updates colors app-wide without Context or prop drilling.
  applyTheme(mode);

  useEffect(() => {
    // Canonicalize an empty/unknown hash so the first history entry is stable,
    // then let back/forward (and manual hash edits) drive the route.
    if (!parseHash(window.location.hash)) {
      window.history.replaceState(null, "", hashForRoute(DEFAULT_ROUTE));
    }
    const onPopState = () => setRoute(parseHash(window.location.hash) ?? DEFAULT_ROUTE);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function applyRoute(next: AppRoute, options?: { replace?: boolean }) {
    setRoute(next);
    const target = hashForRoute(next);
    if (window.location.hash !== target) {
      if (options?.replace) window.history.replaceState(null, "", target);
      else window.history.pushState(null, "", target);
    }
  }

  function navigate(id: string) {
    const legacy = legacyRouteFor(id);
    if (legacy) {
      if (legacy.page === "data-estate") {
        applyRoute({
          page: "data-estate",
          systemId: route.systemId ?? DEFAULT_SYSTEM_ID,
          systemTab: SYSTEM_TAB_BY_LEGACY_TAB[legacy.tab],
        });
      } else {
        applyRoute({ page: legacy.page, tab: legacy.tab });
      }
      return;
    }
    if (isNavigationPageId(id)) {
      // The Systems nav item always lands on the picker, even when a system's
      // workspace is open — the two are distinct routes now.
      applyRoute(id === "data-estate" ? { page: id, systemId: null } : { page: id });
    }
  }

  function openSystem(id: SystemId, options?: SystemSelectOptions) {
    setStartAssessment(Boolean(options?.startAssessment));
    applyRoute({ page: "data-estate", systemId: id, systemTab: options?.startAssessment ? "controls" : "overview" });
  }

  function showPicker() {
    setStartAssessment(false);
    applyRoute({ page: "data-estate", systemId: null });
  }

  function login() {
    sessionStorage.setItem(AUTH_STORAGE_KEY, "1");
    setAuthenticated(true);
  }

  function toggleTheme() {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  if (!authenticated) {
    return (
      <>
        <style>{FONT_IMPORT}</style>
        <Login onLogin={login} />
      </>
    );
  }

  // Controls/Governance/Overview each seed their in-page area/tab from
  // `initialTab` only on mount (`useState(initialTab ?? null)`), so keying on
  // the tab forces a remount whenever the route's tab changes — otherwise
  // picking a different sub-area while already on that page would be silently
  // ignored.
  let activePage: React.ReactNode;
  switch (route.page) {
    case "assurance": {
      const tab = controlsTab(route.tab);
      activePage = <Controls key={tab ?? "landing"} initialTab={tab} onNavigate={navigate} />;
      break;
    }
    case "governance": {
      const tab = governanceTab(route.tab);
      activePage = <Governance key={tab ?? "landing"} initialTab={tab} onNavigate={navigate} />;
      break;
    }
    case "overview": {
      const tab = overviewTab(route.tab);
      activePage = <Overview key={tab ?? "landing"} initialTab={tab} onNavigate={navigate} />;
      break;
    }
    case "graph-explorer":
      activePage = <GraphExplorer />;
      break;
    default:
      activePage = (
        <Systems
          systemId={route.systemId ?? null}
          systemTab={route.systemTab}
          startAssessment={startAssessment}
          onOpenSystem={openSystem}
          onShowPicker={showPicker}
          onSystemTabChange={(tab) => applyRoute({ ...route, systemTab: tab }, { replace: true })}
          onNavigate={navigate}
        />
      );
  }

  return (
    <div className="flex flex-col" style={{ background: C.bg, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      <TopNav
        active={route.page}
        onSelect={navigate}
        mode={mode}
        onToggleTheme={toggleTheme}
      />
      <div className="flex-1" style={{ overflowY: "auto" }}>
        {activePage}
      </div>
    </div>
  );
}
