import React, { useState } from "react";
import type { ComponentProps, ComponentType } from "react";
import Sidebar from "./components/Sidebar";
import type { NavigationPageId } from "./components/Sidebar";
import Controls from "./pages/Controls";
import Systems from "./pages/Systems";
import Governance from "./pages/Governance";
import Overview from "./pages/Overview";
import GraphExplorer from "./pages/GraphExplorer";
import Login from "./pages/Login";
import { C, applyTheme, FONT_IMPORT } from "./theme";
import type { ThemeMode } from "./theme";

type ControlsTab = NonNullable<ComponentProps<typeof Controls>["initialTab"]>;
type SystemsTab = NonNullable<ComponentProps<typeof Systems>["initialTab"]>;
type GovernanceTab = NonNullable<ComponentProps<typeof Governance>["initialTab"]>;
type OverviewTab = NonNullable<ComponentProps<typeof Overview>["initialTab"]>;
type PageTab = ControlsTab | SystemsTab | GovernanceTab | OverviewTab;

interface PageProps {
  initialTab?: PageTab;
  onNavigate: (target: string) => void;
}

function controlsTab(tab?: PageTab): ControlsTab | undefined {
  return tab === "ccf" || tab === "control-profile" ? tab : undefined;
}

function systemsTab(tab?: PageTab): SystemsTab | undefined {
  return tab === "profile" || tab === "map" || tab === "assets" ? tab : undefined;
}

function governanceTab(tab?: PageTab): GovernanceTab | undefined {
  return tab === "policy" || tab === "procedures" || tab === "principles" || tab === "schedule" ? tab : undefined;
}

function overviewTab(tab?: PageTab): OverviewTab | undefined {
  return tab === "dashboard" || tab === "risk-register" || tab === "footprint" ? tab : undefined;
}

// Map nav item ids (defined in Sidebar.tsx) to a consistently typed renderer.
const PAGES: Record<NavigationPageId, ComponentType<PageProps>> = {
  assurance: ({ initialTab }) => <Controls initialTab={controlsTab(initialTab)} />,
  "data-estate": ({ initialTab }) => <Systems initialTab={systemsTab(initialTab)} />,
  governance: ({ initialTab, onNavigate }) => (
    <Governance initialTab={governanceTab(initialTab)} onNavigate={onNavigate} />
  ),
  overview: ({ initialTab, onNavigate }) => (
    <Overview initialTab={overviewTab(initialTab)} onNavigate={onNavigate} />
  ),
  "graph-explorer": () => <GraphExplorer />,
};

// Old top-level ids for pages that got folded into a consolidated page (e.g.
// "asset-register" into Data Estate). Other pages still call onNavigate with
// these ids, so this keeps those links working — landing on the consolidated
// page, opened to the tab the old id used to mean — without having to touch
// every caller each time another consolidation happens.
interface LegacyRoute {
  page: NavigationPageId;
  tab: PageTab;
}

const LEGACY_ROUTES = {
  "data-footprint": { page: "overview", tab: "footprint" },
  "data-map": { page: "data-estate", tab: "map" },
  "gap-matrix": { page: "data-estate", tab: "profile" },
  "asset-register": { page: "data-estate", tab: "assets" },
  ccf: { page: "assurance", tab: "ccf" },
  "control-profile": { page: "assurance", tab: "control-profile" },
  "policy-center": { page: "governance", tab: "policy" },
  "procedure-library": { page: "governance", tab: "procedures" },
  "security-principles": { page: "governance", tab: "principles" },
  "activity-timeliness": { page: "governance", tab: "schedule" },
  ssp: { page: "data-estate", tab: "profile" },
} satisfies Record<string, LegacyRoute>;

function legacyRouteFor(id: string): LegacyRoute | undefined {
  return Object.entries(LEGACY_ROUTES).find(([routeId]) => routeId === id)?.[1];
}

function isNavigationPageId(id: string): id is NavigationPageId {
  return Object.hasOwn(PAGES, id);
}

export default function App() {
  const [active, setActive] = useState<NavigationPageId>("data-estate");
  const [initialTab, setInitialTab] = useState<PageTab | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("light");
  // No real auth is wired up yet — this just gates the UI behind the login screen.
  const [authenticated, setAuthenticated] = useState(false);

  // Mutates the shared C / CLASS_META objects in theme.ts in place, before this
  // render reads any of their properties. Every page imports those same objects,
  // so this one call updates colors app-wide without Context or prop drilling.
  applyTheme(mode);

  function navigate(id: string) {
    const route = legacyRouteFor(id);
    if (route) {
      setActive(route.page);
      setInitialTab(route.tab);
      return;
    }
    if (isNavigationPageId(id)) {
      setActive(id);
      setInitialTab(undefined);
    }
  }

  const ActivePage = PAGES[active];

  if (!authenticated) {
    return (
      <>
        <style>{FONT_IMPORT}</style>
        <Login onLogin={() => setAuthenticated(true)} />
      </>
    );
  }

  return (
    <div className="flex" style={{ background: C.bg, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        active={active}
        onSelect={navigate}
        mode={mode}
        onToggleTheme={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
      />
      <div className="flex-1" style={{ maxHeight: "100vh", overflowY: "auto" }}>
        <ActivePage onNavigate={navigate} initialTab={initialTab} />
      </div>
    </div>
  );
}
