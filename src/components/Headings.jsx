import React from "react";
import { C } from "../theme";

// Shared page title: one accent-colored line (icon + bold text) instead of the
// old pattern of a small eyebrow label that just repeated (or silently
// disagreed with) the heading below it. `title` is always the same string
// shown for this page in the sidebar nav, so the two can't drift apart again.
// `tagline` is optional flavor text for pages whose old h1 said something more
// descriptive than the nav label — kept as a small line under the title
// instead of being the title itself.
export function PageHeader({ icon: Icon, title, tagline, description, descriptionClassName = "max-w-2xl", right, children }) {
  return (
    <div className="px-8 pt-8 pb-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {/* Icon is paired only with the title line (never the tagline below it),
              so it centers against a single line of text the same way whether or
              not a page happens to have a tagline. */}
          <div className="flex items-center gap-3">
            {Icon && <Icon size={26} color={C.accent} strokeWidth={2.25} className="shrink-0" />}
            <h1 className="text-3xl font-bold leading-tight" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
              {title}
            </h1>
          </div>
          {tagline && (
            <div className="text-xs mt-1" style={{ color: C.muted, marginLeft: Icon ? 38 : 0 }}>{tagline}</div>
          )}
        </div>
        {right}
      </div>
      {description && <p className={`text-sm mt-3 ${descriptionClassName}`} style={{ color: C.muted }}>{description}</p>}
      {children}
    </div>
  );
}

// Shared in-page tab bar for consolidated pages (Overview, Data Estate, ...):
// a segmented control rather than an underline, so the active tab reads as
// "selected" at a glance — inverted ink/bg fill instead of a thin accent line.
// `tabs` is [{ id, label, icon }]; `active` is the selected id.
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="px-8 pt-8">
      <div className="inline-flex items-center gap-1 p-1 rounded-xl" style={{ background: C.panel2 }}>
        {tabs.map((t) => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? C.ink : "transparent",
                color: isActive ? C.bg : C.muted,
              }}
            >
              {Icon && <Icon size={15} />}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shared subsection heading: modeled on the System Security Plan's document
// sections — a muted icon, a serif title, and a border spanning the full
// width of its container beneath it — used to introduce a content block
// within a page (as opposed to PageHeader, which titles the whole page).
// `number` is optional: only the SSP's own numbered document sections use
// it, so it's off by default everywhere else.
export function SectionHeading({ icon: Icon, children, number, hint, right, className = "" }) {
  return (
    <div className={`flex items-center gap-2 mb-4 pb-2 flex-wrap ${className}`} style={{ borderBottom: `1px solid ${C.accent}` }}>
      {number && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded shrink-0" style={{ background: C.accentBg, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
          {number}
        </span>
      )}
      {Icon && <Icon size={15} color={C.muted} className="shrink-0" />}
      <h2 className="text-lg" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{children}</h2>
      {hint && <span className="text-xs" style={{ color: C.muted }}>— {hint}</span>}
      {right && <span className="ml-auto flex items-center">{right}</span>}
    </div>
  );
}
