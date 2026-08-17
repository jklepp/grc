import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Controls from "./pages/Controls";
import Systems from "./pages/Systems";
import Governance from "./pages/Governance";
import Overview from "./pages/Overview";
import GraphExplorer from "./pages/GraphExplorer";
import { C, applyTheme, FONT_IMPORT } from "./theme";

// Map nav item ids (defined in Sidebar.jsx) to the page component to render.
// Adding a page = add it to NAV_ITEMS in Sidebar.jsx, then add the case here.
const PAGES = {
  assurance: Controls,
  "data-estate": Systems,
  governance: Governance,
  overview: Overview,
  "graph-explorer": GraphExplorer,
};

// Old top-level ids for pages that got folded into a consolidated page (e.g.
// "asset-register" into Data Estate). Other pages still call onNavigate with
// these ids, so this keeps those links working — landing on the consolidated
// page, opened to the tab the old id used to mean — without having to touch
// every caller each time another consolidation happens.
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
};

export default function App() {
  const [active, setActive] = useState("data-estate");
  const [initialTab, setInitialTab] = useState(undefined);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("light");

  // Mutates the shared C / CLASS_META objects in theme.js in place, before this
  // render reads any of their properties. Every page imports those same objects,
  // so this one call updates colors app-wide without Context or prop drilling.
  applyTheme(mode);

  function navigate(id) {
    const route = LEGACY_ROUTES[id];
    setActive(route ? route.page : id);
    setInitialTab(route ? route.tab : undefined);
  }

  const ActivePage = PAGES[active];

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
