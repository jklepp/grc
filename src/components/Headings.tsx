import React from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { C } from "../theme";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: ReactNode;
  tagline?: ReactNode;
  description?: ReactNode;
  descriptionClassName?: string;
  right?: ReactNode;
  children?: ReactNode;
}

// Shared page title: one accent-colored line (icon + bold text) instead of the
// old pattern of a small eyebrow label that just repeated (or silently
// disagreed with) the heading below it. `title` is always the same string
// shown for this page in the sidebar nav, so the two can't drift apart again.
// `tagline` is optional flavor text for pages whose old h1 said something more
// descriptive than the nav label — kept as a small line under the title
// instead of being the title itself.
export function PageHeader({ icon: Icon, title, tagline, description, descriptionClassName = "max-w-2xl", right, children }: PageHeaderProps) {
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
// `variant="secondary"` is for a TabBar nested *below* another TabBar (e.g.
// System Security Profile's sub-tabs inside Data Estate's top-level tabs) —
// an underline style so the two rows don't read as the same kind of control
// stacked twice.
export interface TabDefinition<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface TabBarProps<T extends string> {
  tabs: readonly TabDefinition<T>[];
  active: T;
  onChange: (id: T) => void;
  variant?: "primary" | "secondary";
}

export function TabBar<T extends string>({ tabs, active, onChange, variant = "primary" }: TabBarProps<T>) {
  if (variant === "secondary") {
    return (
      <div className="px-8 pt-6">
        <div className="flex items-center gap-1 flex-wrap" style={{ borderBottom: `1px solid ${C.border}` }}>
          {tabs.map((t) => {
            const isActive = active === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors"
                style={{
                  color: isActive ? "#fff" : C.muted,
                  background: isActive ? C.accentStrong : "transparent",
                }}
              >
                {Icon && <Icon size={13} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
interface SectionHeadingProps {
  icon?: LucideIcon;
  children: ReactNode;
  number?: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function SectionHeading({ icon: Icon, children, number, hint, right, className = "" }: SectionHeadingProps) {
  return (
    <div className={`flex items-center gap-2 mb-4 pb-2 flex-wrap ${className}`} style={{ borderBottom: `1px solid ${C.borderStrong}` }}>
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
