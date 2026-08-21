import React, { useState } from "react";
import type { ComponentProps, ComponentType } from "react";
import TopNav from "./components/TopNav";
import type { NavigationPageId } from "./components/TopNav";
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
  systemsPickerEpoch?: number;
}

function controlsTab(tab?: PageTab): ControlsTab | undefined {
  return tab === "ccf" || tab === "control-profile" ? tab : undefined;
}

function systemsTab(tab?: PageTab): SystemsTab | undefined {
  return tab === "profile" || tab === "map" || tab === "assets" ? tab : undefined;
}

function governanceTab(tab?: PageTab): GovernanceTab | undefined {
  return tab === "policy" || tab === "procedures" || tab === "principles" || tab === "schedule" || tab === "exceptions" ? tab : undefined;
}

function overviewTab(tab?: PageTab): OverviewTab | undefined {
  return tab === "dashboard" || tab === "risk-register" || tab === "footprint" ? tab : undefined;
}

// Map nav item ids (defined in TopNav.tsx) to a consistently typed renderer.
// Controls/Governance/Overview each seed their in-page area/tab from
// `initialTab` only on mount (`useState(initialTab ?? null)`), so re-picking
// a different sub-area from the TopNav dropdown while already on that page
// re-renders the same instance and is silently ignored. Keying on the tab
// forces a remount so the new selection actually takes — same fix Systems
// already uses (there via `systemsPickerEpoch`) for the same reason.
const PAGES: Record<NavigationPageId, ComponentType<PageProps>> = {
  assurance: ({ initialTab }) => {
    const tab = controlsTab(initialTab);
    return <Controls key={tab ?? "landing"} initialTab={tab} />;
  },
  "data-estate": ({ initialTab, onNavigate, systemsPickerEpoch }) => (
    <Systems
      key={systemsPickerEpoch}
      initialTab={systemsTab(initialTab)}
      onNavigate={onNavigate}
      pickerEpoch={systemsPickerEpoch}
    />
  ),
  governance: ({ initialTab, onNavigate }) => {
    const tab = governanceTab(initialTab);
    return <Governance key={tab ?? "landing"} initialTab={tab} onNavigate={onNavigate} />;
  },
  overview: ({ initialTab, onNavigate }) => {
    const tab = overviewTab(initialTab);
    return <Overview key={tab ?? "landing"} initialTab={tab} onNavigate={onNavigate} />;
  },
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
  "exception-register": { page: "governance", tab: "exceptions" },
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
  // Incremented only when the Systems nav item is clicked, so that click can
  // reopen the picker even if Systems is already mounted on a workspace.
  const [systemsPickerEpoch, setSystemsPickerEpoch] = useState(0);
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
      if (id === "data-estate") setSystemsPickerEpoch((n) => n + 1);
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
    <div className="flex flex-col" style={{ background: C.bg, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      <TopNav
        active={active}
        onSelect={navigate}
        mode={mode}
        onToggleTheme={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
      />
      <div className="flex-1" style={{ overflowY: "auto" }}>
        <ActivePage onNavigate={navigate} initialTab={initialTab} systemsPickerEpoch={systemsPickerEpoch} />
      </div>
    </div>
  );
}
