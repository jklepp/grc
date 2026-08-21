import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/Headings";
import { AreaSelectList } from "../components/AreaSelectList";
import type { AreaListItem } from "../components/AreaSelectList";
import { CLASS_ORDER } from "../theme";
import { IN_SCOPE_CONTROLS, getAllSystems } from "../engine";
import { CONTROL_AREAS } from "./controlAreas";
import type { ControlAreaId } from "./controlAreas";

const DOMAIN_COUNT = new Set(IN_SCOPE_CONTROLS.map((c) => c.domain)).size;
const STANDARD_COUNT = new Set(IN_SCOPE_CONTROLS.flatMap((c) => c.frameworks.map((f) => f.standard))).size;
const SYSTEM_COUNT = getAllSystems().length;

const AREA_METRICS: Record<ControlAreaId, AreaListItem["metrics"]> = {
  ccf: [
    { value: IN_SCOPE_CONTROLS.length, label: "Controls in scope" },
    { value: DOMAIN_COUNT, label: "Domains" },
    { value: STANDARD_COUNT, label: "Standards mapped" },
  ],
  "control-profile": [
    { value: CLASS_ORDER.length, label: "Classification tiers" },
    { value: SYSTEM_COUNT, label: "Systems evaluated" },
  ],
};

const AREAS: AreaListItem<ControlAreaId>[] = CONTROL_AREAS.map((area) => ({
  id: area.id,
  icon: area.icon,
  label: area.label,
  description: area.description,
  metrics: AREA_METRICS[area.id],
}));

// List layout matches SelectSystem's system table (bordered row list, avatar,
// stat readouts) so this landing page and Governance's read as the same "pick
// one of these" pattern instead of a table on one page and cards on another.
export function ControlsLanding({ onSelect }: { onSelect: (area: ControlAreaId) => void }) {
  return (
    <div className="w-full pb-12">
      <PageHeader
        icon={SlidersHorizontal}
        title="Select a Control Area"
        description="Choose the control workflow you want to work in. Each area draws from the same underlying control catalog and system assessments."
      />

      <div className="px-8">
        <AreaSelectList areas={AREAS} onSelect={onSelect} />
      </div>
    </div>
  );
}
