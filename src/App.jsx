import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import CommonControlFramework from "./pages/CommonControlFramework";
import DataClassificationGapMatrix from "./pages/DataClassificationGapMatrix";
import DataFootprint from "./pages/DataFootprint";
import RiskRegister from "./pages/RiskRegister";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import { C, applyTheme, FONT_IMPORT } from "./theme";

// Map nav item ids (defined in Sidebar.jsx) to the page component to render.
// Adding a page = add it to NAV_ITEMS in Sidebar.jsx, then add the case here.
const PAGES = {
  ccf: CommonControlFramework,
  "gap-matrix": DataClassificationGapMatrix,
  "data-footprint": DataFootprint,
  "risk-register": RiskRegister,
  executive: ExecutiveDashboard,
};

export default function App() {
  const [active, setActive] = useState("ccf");
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("dark");

  // Mutates the shared C / CLASS_META objects in theme.js in place, before this
  // render reads any of their properties. Every page imports those same objects,
  // so this one call updates colors app-wide without Context or prop drilling.
  applyTheme(mode);

  const ActivePage = PAGES[active];

  return (
    <div className="flex" style={{ background: C.bg, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        active={active}
        onSelect={setActive}
        mode={mode}
        onToggleTheme={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
      />
      <div className="flex-1" style={{ maxHeight: "100vh", overflowY: "auto" }}>
        <ActivePage onNavigate={setActive} />
      </div>
    </div>
  );
}
