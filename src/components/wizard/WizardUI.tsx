import React, { useEffect, useState } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Info, Plus, Search, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../theme";

// One visual system for the Add / Edit System wizard.
//
// Every wizard step composes these primitives instead of writing its own
// panel/label/button styling, so "selected", "saved", "disabled" and "error"
// look and behave identically on all eight steps. Colors are read from the
// mutable theme object at render time (never copied into a module constant) so
// applyTheme() keeps working.
//
// Surface hierarchy — three levels, nothing else:
//   page    C.bg      the wizard content pane
//   card    C.panel   a Section, and the modal chrome around the pane
//   well    C.bg      a recessed block inside a card (lists, entity cards)
//   control C.panel2  anything the user types into or toggles

export const WZ = {
  radius: { control: 8, card: 12, chip: 6, pill: 999 },
  serif: "'Source Serif 4', serif",
  // The one foreground used on a filled accent surface.
  onAccent: "#fff",
} as const;

// The one typography scale. Sizes: 10 (eyebrow/label), 11 (help/meta),
// 12.5 (body), 13.5 (section title), 19 (step title / figure).
export const TX = {
  eyebrow: "text-[10px] uppercase tracking-[0.14em] font-mono font-medium",
  modalTitle: "text-[17px] font-semibold leading-tight",
  stepTitle: "text-[19px] font-semibold leading-tight",
  railTitle: "text-[12px] font-semibold leading-tight",
  tag: "text-[10px] font-mono",
  lead: "text-[12.5px] leading-relaxed",
  sectionTitle: "text-[13.5px] font-semibold leading-tight",
  sectionDesc: "text-[11px] leading-snug",
  label: "text-[10px] uppercase tracking-[0.08em] font-mono font-medium",
  help: "text-[11px] leading-snug",
  body: "text-[12.5px] leading-normal",
  meta: "text-[11px] leading-snug",
  code: "text-[10px] font-mono font-semibold tracking-wide",
  itemTitle: "text-[13px] font-semibold leading-tight",
  figure: "text-[19px] font-semibold leading-none",
} as const;

export type Tone = "info" | "success" | "warning" | "danger" | "neutral";

export function toneColor(tone: Tone): string {
  if (tone === "success") return C.green;
  if (tone === "warning") return C.amber;
  if (tone === "danger") return C.red;
  if (tone === "neutral") return C.muted;
  return C.accent;
}
function toneSurface(tone: Tone): string {
  if (tone === "success") return C.greenBg;
  if (tone === "warning") return C.amberBg;
  if (tone === "danger") return C.redBg;
  if (tone === "neutral") return C.panel2;
  return C.accentBg;
}
const TONE_ICON: Record<Tone, LucideIcon> = {
  info: Info, success: Check, warning: AlertTriangle, danger: AlertTriangle, neutral: Info,
};

/* ---------------------------------------------------------------- layout -- */

export function StepHeader({ step, total, title, description }: {
  step: number; total: number; title: string; description: string;
}) {
  return (
    <header className="mb-5">
      <div className={`${TX.eyebrow} mb-1.5`} style={{ color: C.accent }}>Step {step} of {total}</div>
      <h2 className={TX.stepTitle} style={{ color: C.ink, fontFamily: WZ.serif }}>{title}</h2>
      <p className={`${TX.lead} mt-2 max-w-[68ch]`} style={{ color: C.muted }}>{description}</p>
    </header>
  );
}

// Vertical stack of Sections — the only spacing a step body needs.
export function StepBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

// `grow` lets a Section fill a flex column and hand its own body the height,
// so a long list can scroll inside the card instead of the whole step.
export function Section({ icon: Icon, title, description, aside, grow = false, children }: {
  icon: LucideIcon; title: string; description?: string; aside?: ReactNode; grow?: boolean; children: ReactNode;
}) {
  return (
    <section
      className={grow ? "flex-1 min-h-0 flex flex-col" : undefined}
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: WZ.radius.card }}
    >
      <header className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.accentBg, color: C.accent, borderRadius: WZ.radius.control }}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={TX.sectionTitle} style={{ color: C.ink }}>{title}</h3>
          {description && <p className={`${TX.sectionDesc} mt-1`} style={{ color: C.muted }}>{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className={`p-4 flex flex-col gap-4 ${grow ? "flex-1 min-h-0" : ""}`}>{children}</div>
    </section>
  );
}

// A recessed block inside a Section: list containers, entity cards, grouped
// checkboxes. Never nests inside another Well.
// `hollow` drops the fill and keeps only the outline — for a block nested
// inside something that is already at well level (a list inside an EntityCard),
// where a second identical fill would read as a missing border.
export function Well({ children, className = "", style, padded = true, hollow = false }: {
  children: ReactNode; className?: string; style?: CSSProperties; padded?: boolean; hollow?: boolean;
}) {
  return (
    <div
      className={`${padded ? "p-3.5" : ""} ${className}`}
      style={{ background: hollow ? undefined : C.bg, border: `1px solid ${C.border}`, borderRadius: WZ.radius.control, ...style }}
    >
      {children}
    </div>
  );
}

export function FieldGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ReactNode }) {
  const template = cols === 1 ? "grid-cols-1"
    : cols === 2 ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  return <div className={`grid gap-4 ${template}`}>{children}</div>;
}

export function Field({ label, note, error, span2 = false, children }: {
  label: string; note?: string; error?: string | null; span2?: boolean; children: ReactNode;
}) {
  return (
    <div className={span2 ? "col-span-full min-w-0" : "min-w-0"}>
      <label className={`${TX.label} block mb-1.5`} style={{ color: C.muted }}>{label}</label>
      {children}
      {error
        ? <div className={`${TX.help} mt-1.5 flex items-start gap-1.5`} style={{ color: C.amber }}><AlertTriangle size={11} className="mt-px shrink-0" />{error}</div>
        : note ? <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>{note}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- controls -- */

const CONTROL_BASE = "wz-focusable w-full px-3 py-2 text-[12.5px] outline-none transition-colors";
function controlStyle(): CSSProperties {
  return { background: C.panel2, border: `1px solid ${C.border}`, color: C.ink, borderRadius: WZ.radius.control };
}

export function TextInput({ className = "", style, ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${CONTROL_BASE} ${className}`} style={{ ...controlStyle(), ...style }} />;
}
export function TextArea({ className = "", style, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`${CONTROL_BASE} resize-y ${className}`}
      style={{ ...controlStyle(), minHeight: 64, ...style }}
    />
  );
}
export function Select({ className = "", style, ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${CONTROL_BASE} ${className}`} style={{ ...controlStyle(), ...style }} />;
}

// `tint` swaps the accent for a semantic color where the choice itself
// carries meaning (a PRISMA rating on the red-to-green ramp). Everything else
// about the selected state — fill, border, check — stays identical.
export function ChoiceChip({ selected, onClick, disabled, ariaLabel, tint, solid = false, className = "", children }: {
  selected: boolean; onClick: () => void; disabled?: boolean; ariaLabel?: string;
  tint?: string; solid?: boolean; className?: string; children: ReactNode;
}) {
  const edge = tint ?? C.accent;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`wz-focusable wz-lift inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium capitalize transition-colors ${className}`}
      style={{
        color: selected ? (solid ? WZ.onAccent : edge) : C.ink,
        background: selected ? (solid ? edge : tint ? `${tint}22` : C.accentBg) : C.panel2,
        border: `1px solid ${selected ? edge : C.border}`,
      }}
    >
      {selected && !solid && <Check size={11} className="mr-1.5 -ml-0.5 shrink-0" />}
      {children}
    </button>
  );
}

// A mutually-exclusive tile choice (hosting type). Same selected + disabled
// language as ChoiceChip, just with room for a supporting line.
export function OptionCard({ selected, disabled, onClick, title, hint, disabledTitle }: {
  selected: boolean; disabled?: boolean; onClick: () => void; title: string; hint: string; disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={title}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      onClick={onClick}
      className="wz-focusable wz-lift text-left px-3.5 py-3 transition-colors"
      style={{
        border: `1px solid ${selected ? C.accent : C.border}`,
        background: selected ? C.accentBg : C.bg,
        borderRadius: WZ.radius.control,
      }}
    >
      <div className={`${TX.itemTitle} capitalize`} style={{ color: selected ? C.accent : C.ink }}>{title}</div>
      <div className={`${TX.help} mt-1`} style={{ color: C.muted }}>{hint}</div>
    </button>
  );
}

// The single checkbox in the wizard. Rows that need their own layout (the
// data-type picker) use this directly; everything else goes through CheckRow.
export function Checkbox({ checked, onChange, ariaLabel, className = "" }: {
  checked: boolean; onChange: (checked: boolean) => void; ariaLabel?: string; className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      className={`wz-focusable shrink-0 ${className}`}
      style={{ accentColor: C.accent, width: 14, height: 14 }}
    />
  );
}

// A checkbox + label row — the default pairing everywhere in the wizard.
export function CheckRow({ checked, onChange, label, ariaLabel, className = "" }: {
  checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; ariaLabel?: string; className?: string;
}) {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer ${TX.body} ${className}`} style={{ color: C.ink }}>
      <Checkbox checked={checked} onChange={onChange} ariaLabel={ariaLabel} className="mt-px" />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

// A checkbox that owns its own surface — used where turning it on reveals more
// fields. Selected uses exactly the same accent treatment as ChoiceChip.
export function ToggleCard({ checked, onChange, title, description, children }: {
  checked: boolean; onChange: (checked: boolean) => void; title: string; description: string; children?: ReactNode;
}) {
  return (
    <div
      className="p-3.5 transition-colors"
      style={{
        background: checked ? C.accentBg : C.bg,
        border: `1px solid ${checked ? C.accent : C.border}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <CheckRow
        checked={checked}
        onChange={onChange}
        ariaLabel={title}
        label={
          <>
            <span className={`${TX.itemTitle} block`} style={{ color: checked ? C.accent : C.ink }}>{title}</span>
            <span className={`${TX.help} block mt-1`} style={{ color: C.muted }}>{description}</span>
          </>
        }
      />
      {children && <div className="mt-3.5 pl-6">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- actions -- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, children, className = "", style, ...props }: {
  variant?: ButtonVariant; size?: "sm" | "md"; icon?: LucideIcon; iconRight?: LucideIcon;
} & ComponentProps<"button">) {
  const sizing = size === "sm" ? "px-2.5 py-1.5 text-[11px] gap-1.5" : "px-3.5 py-2 text-[12.5px] gap-1.5";
  const iconSize = size === "sm" ? 12 : 14;
  const palette: Record<ButtonVariant, CSSProperties> = {
    // Only `primary` paints its own background. The others stay on the
    // preflight-transparent default so the shared `.wz-hover` rule can supply
    // the hover fill — an inline background would out-specify it.
    primary: { background: C.accent, color: WZ.onAccent, border: "1px solid transparent" },
    secondary: { color: C.ink, border: `1px solid ${C.border}` },
    ghost: { color: C.muted, border: "1px solid transparent" },
    danger: { color: C.red, border: `1px solid ${C.border}` },
  };
  return (
    <button
      type="button"
      {...props}
      className={`wz-focusable ${variant === "primary" ? "wz-lift" : "wz-hover"} inline-flex items-center justify-center font-semibold transition-colors ${sizing} ${className}`}
      style={{ borderRadius: WZ.radius.control, ...palette[variant], ...style }}
    >
      {Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
      {IconRight && <IconRight size={iconSize} className="shrink-0" />}
    </button>
  );
}

export function IconButton({ label, icon: Icon, tone = "neutral", className = "", ...props }: {
  label: string; icon: LucideIcon; tone?: Tone;
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`wz-focusable wz-hover p-1.5 transition-colors ${className}`}
      style={{ color: toneColor(tone), border: "1px solid transparent", borderRadius: WZ.radius.control }}
    >
      <Icon size={14} />
    </button>
  );
}

// Every destructive control in the wizard is this button, in the danger tone —
// so "remove" never looks like a neutral icon action anywhere in the flow.
export function RemoveButton({ label, ...props }: Omit<ComponentProps<"button">, "children"> & { label: string }) {
  return <IconButton icon={Trash2} tone="danger" label={label} {...props} />;
}

// The one "add a row" affordance. Full width, dashed, accent — used for
// assets, actors, relationships, agents and DR tests alike.
export function AddButton({ children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="wz-focusable wz-lift w-full flex items-center justify-center gap-2 py-2.5 text-[12.5px] font-semibold transition-colors"
      style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg, borderRadius: WZ.radius.control }}
    >
      <Plus size={14} /> {children}
    </button>
  );
}

/* --------------------------------------------------------------- feedback -- */

// `tone` is the kit vocabulary. `color`/`surface` is the escape hatch for the
// app-wide control metas, which already resolve to theme tokens of their own —
// the pill stays one component and one shape either way.
export function StatusPill({ tone = "neutral", children, icon: Icon, color: colorProp, surface }: {
  tone?: Tone; children: ReactNode; icon?: LucideIcon; color?: string; surface?: string;
}) {
  const color = colorProp ?? toneColor(tone);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] font-mono whitespace-nowrap"
      style={{ color, background: surface ?? toneSurface(tone), border: `1px solid ${color}44`, borderRadius: WZ.radius.pill }}
    >
      {Icon && <Icon size={10} className="shrink-0" />}
      {children}
    </span>
  );
}

// Block-level message. Every success / warning / error banner in the wizard is
// one of these — there are no bespoke tinted divs anywhere else.
export function Callout({ tone = "info", title, children, icon: Icon }: {
  tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: LucideIcon;
}) {
  const color = toneColor(tone);
  const Glyph = Icon ?? TONE_ICON[tone];
  return (
    <div
      className="flex items-start gap-2.5 px-3.5 py-3"
      style={{ background: toneSurface(tone), border: `1px solid ${color}44`, borderRadius: WZ.radius.control }}
    >
      <Glyph size={14} color={color} className="shrink-0 mt-0.5" />
      <div className={`${TX.body} min-w-0`} style={{ color: C.ink }}>
        {title && <span className="font-semibold" style={{ color }}>{title}</span>}
        {title && children ? " " : null}
        {children}
      </div>
    </div>
  );
}

// Inline, field-adjacent message. Same tone vocabulary as Callout, no surface.
export function InlineHint({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const color = toneColor(tone);
  const Glyph = TONE_ICON[tone];
  return (
    <span className={`${TX.help} inline-flex items-start gap-1.5`} style={{ color }}>
      <Glyph size={12} className="shrink-0 mt-px" /> <span>{children}</span>
    </span>
  );
}

// The one "show me the rest" affordance: chevron, label, optional summary.
// Used for evidence provenance, form provenance, and maturity detail alike.
export function DisclosureButton({ open, onToggle, children, summary, tone = "info" }: {
  open: boolean; onToggle: () => void; children: ReactNode; summary?: ReactNode; tone?: Tone;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`wz-focusable inline-flex items-center gap-1.5 ${TX.help} font-semibold text-left`}
      style={{ color: toneColor(tone), border: "1px solid transparent", borderRadius: WZ.radius.chip }}
    >
      <Chevron size={12} className="shrink-0" />
      {children}
      {summary && <span className="font-normal" style={{ color: C.muted }}>{summary}</span>}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${TX.help} px-3.5 py-4 text-center`}
      style={{ border: `1px dashed ${C.border}`, color: C.muted, borderRadius: WZ.radius.control }}
    >
      {children}
    </div>
  );
}

// flex-wrap rather than min-w-0 on the text column: a one-word figure
// ("Restricted") has no shrink room, so the aside drops to its own line
// instead of the value being clipped.
export function StatTile({ label, value, hint, aside }: {
  label: string; value: ReactNode; hint?: string; aside?: ReactNode;
}) {
  return (
    <Well className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
      <div>
        <div className={TX.figure} style={{ color: C.ink, fontFamily: WZ.serif }}>{value}</div>
        <div className={`${TX.meta} mt-1.5 font-semibold`} style={{ color: C.ink }}>{label}</div>
        {hint && <div className={`${TX.help} mt-0.5`} style={{ color: C.muted }}>{hint}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </Well>
  );
}

/* ----------------------------------------------------------- entity cards -- */

// The single expand / edit / save / remove card used for assets, actors,
// relationships, agents and DR tests. Collapsed = a recorded fact with a Saved
// pill; expanded = the accent-bordered row currently being edited. Nothing
// else in the wizard implements this behaviour on its own.
export function EntityCard({
  code, title, summary, expanded, saved, onExpand, onSave, saveLabel, canSave,
  invalidReason, onRemove, removeLabel, children,
}: {
  code: string;
  title: string;
  summary?: ReactNode;
  expanded: boolean;
  saved: boolean;
  onExpand: () => void;
  onSave: () => void;
  saveLabel: string;
  canSave: boolean;
  invalidReason?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${expanded ? C.accent : C.border}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <div className={`flex items-start justify-between gap-3 p-3.5 ${expanded ? "pb-0" : ""}`}>
        <div className="min-w-0">
          <div className={`${TX.itemTitle} flex items-center gap-2`} style={{ color: C.ink }}>
            <span className={`${TX.code} px-1.5 py-0.5 shrink-0`} style={{ background: C.accentBg, color: C.accent, borderRadius: WZ.radius.chip }}>
              {code}
            </span>
            <span className="truncate">{title}</span>
          </div>
          {!expanded && summary && (
            <div className={`${TX.meta} mt-1.5`} style={{ color: C.muted }}>{summary}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded
            ? <StatusPill tone="info">Editing</StatusPill>
            : saved ? <StatusPill tone="success" icon={Check}>Saved</StatusPill> : null}
          {!expanded && <Button size="sm" onClick={onExpand}>Edit</Button>}
          {onRemove && <RemoveButton label={removeLabel ?? `Remove ${title}`} onClick={onRemove} />}
        </div>
      </div>

      {expanded && (
        <div className="p-3.5 flex flex-col gap-4">
          {children}
          <div className="flex items-center justify-end gap-3 pt-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
            {!canSave && invalidReason && (
              <span className="mr-auto"><InlineHint tone="warning">{invalidReason}</InlineHint></span>
            )}
            <Button variant="primary" icon={Check} disabled={!canSave} onClick={onSave}>{saveLabel}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// The list wrapper every entity list uses: rows, then one AddButton.
export function EntityList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/* ------------------------------------------------------------ wizard shell -- */

// The chrome every wizard modal shares: header / rail / body / footer, plus
// the --wz-* custom properties that drive the focus, hover and disabled rules
// in index.css. Wrapping the modal's children in one element also keeps the
// header and footer out of the scrolling region.
// Publishes the --wz-* custom properties the focus / hover / disabled rules in
// index.css read. Any surface built from these primitives needs it, including
// panels that live on a page rather than inside a modal.
export function WizardTokens({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={className}
      style={{ "--wz-accent": C.accent, "--wz-ring": C.accentBg, "--wz-hover": C.panel2 } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function WizardChrome({ children }: { children: ReactNode }) {
  return <WizardTokens className="flex flex-col flex-1 min-h-0">{children}</WizardTokens>;
}

// Names the surface the operator is inside — the one solid-accent strip at
// the very top of every wizard-like modal ("Scope Determination Wizard",
// "System Control Editor"), so which flow you are in is answered before the
// header. Title only; context, actions and close stay in WizardHeader.
export function WizardBanner({ icon: Icon, title }: { icon?: LucideIcon; title: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-6 py-3 shrink-0"
      style={{ background: C.accent, color: WZ.onAccent }}
    >
      {Icon && <Icon size={15} className="shrink-0" />}
      <span className="text-[13px] font-mono font-semibold uppercase tracking-[0.16em]">{title}</span>
    </div>
  );
}

export function WizardHeader({ icon: Icon, title, description, aside, onClose }: {
  icon: LucideIcon; title: string; description: string; aside?: ReactNode; onClose?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}`, background: C.panel }}>
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="w-8 h-8 flex items-center justify-center shrink-0"
          style={{ background: C.accentBg, color: C.accent, borderRadius: WZ.radius.control }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <h1 className={TX.modalTitle} style={{ color: C.ink, fontFamily: WZ.serif }}>{title}</h1>
          <p className={`${TX.help} mt-1.5 max-w-[90ch]`} style={{ color: C.muted }}>{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {aside}
        {onClose}
      </div>
    </header>
  );
}

// A labelled control that sits in wizard chrome rather than in a form body —
// the reviewer of record in a header, a search box above a list.
export function InlineField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 shrink-0">
      <span className={TX.label} style={{ color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

// A read-only counter in wizard chrome ("Scope decided 12 of 40").
export function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-right shrink-0">
      <div className={TX.label} style={{ color: C.muted }}>{label}</div>
      <div className={`${TX.body} font-semibold mt-1`} style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

// minmax(0,1fr) row: an implicit auto row would grow to its content and defeat
// the panes' own overflow-y-auto scrolling.
// `enter` slides the body in on mount — for a wizard that swaps its whole
// subject (the control assessment walk remounts the panel per control), so the
// arrival reads as a new thing rather than the same page with different words.
export function WizardBody({ children, enter = false }: { children: ReactNode; enter?: boolean }) {
  const [settled, setSettled] = useState(!enter);
  useEffect(() => {
    if (settled) return;
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
  }, [settled]);
  return (
    <div
      className="flex-1 min-h-0 grid grid-cols-[172px_minmax(0,1fr)] lg:grid-cols-[208px_minmax(0,1fr)]"
      style={{
        gridTemplateRows: "minmax(0, 1fr)",
        opacity: settled ? 1 : 0,
        transform: settled ? "translateX(0)" : "translateX(24px)",
        transition: "transform 320ms cubic-bezier(.2,.7,.3,1), opacity 260ms ease",
      }}
    >
      {children}
    </div>
  );
}

export function WizardRail({ label = "Wizard steps", children }: { label?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="p-3 overflow-y-auto" style={{ borderRight: `1px solid ${C.border}`, background: C.panel }}>
      {children}
    </nav>
  );
}

// `connected` draws the vertical run between items — reserved for a real
// sequence. An unordered set of destinations gets a `label` instead.
export function RailGroup({ label, connected = false, children }: {
  label?: string; connected?: boolean; children: ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="mb-2 last:mb-0">
      {label && <div className={`${TX.label} px-2.5 pb-2`} style={{ color: C.muted }}>{label}</div>}
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {connected && i < items.length - 1 && (
            <div style={{ width: 1.5, height: 10, marginLeft: 21, background: C.border }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export type RailState = "active" | "done" | "pending";

// The one rail row. `marker` is a step number, `icon` a glyph — done always
// wins and shows a check, so "finished" reads the same in every wizard.
export function RailItem({ icon: Icon, marker, title, detail, state, onClick, disabled, ariaLabel }: {
  icon?: LucideIcon;
  marker?: ReactNode;
  title: string;
  detail?: ReactNode;
  state: RailState;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const isActive = state === "active";
  const isDone = state === "done";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? title}
      title={title}
      aria-current={isActive ? "step" : undefined}
      className={`wz-focusable ${isActive ? "" : "wz-hover"} w-full text-left flex items-start gap-2.5 px-2.5 py-2 mb-1 transition-colors`}
      style={{
        background: isActive ? C.accentBg : undefined,
        border: `1px solid ${isActive ? C.accent : "transparent"}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <span
        className={`${TX.code} w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0`}
        style={{
          border: `1.5px solid ${isActive ? C.accent : isDone ? C.green : C.border}`,
          background: isActive ? C.accent : isDone ? C.greenBg : "transparent",
          color: isActive ? WZ.onAccent : isDone ? C.green : C.muted,
        }}
      >
        {isDone ? <Check size={11} /> : Icon ? <Icon size={11} /> : marker}
      </span>
      <span className="min-w-0 pt-0.5 flex-1">
        <span className={`block ${TX.railTitle} truncate`} style={{ color: C.ink }}>{title}</span>
        {detail && <span className={`block ${TX.help} mt-1`} style={{ color: C.muted }}>{detail}</span>}
      </span>
    </button>
  );
}

// Step position on the left, blocking reason next to it, actions on the right —
// the same footer grammar in every wizard.
export function WizardFooter({ position, hint, children }: {
  position: ReactNode; hint?: ReactNode; children?: ReactNode;
}) {
  return (
    <footer className="flex items-center gap-4 px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: C.panel }}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`${TX.eyebrow} shrink-0`} style={{ color: C.muted }}>{position}</span>
        {hint}
      </div>
      {children && <div className="flex items-center gap-2.5 shrink-0">{children}</div>}
    </footer>
  );
}

export function ProgressBar({ value, total, label, color, className = "" }: {
  value: number; total: number; label?: string; color?: string; className?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className={`flex-1 h-1 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
      style={{ background: C.border, borderRadius: WZ.radius.pill }}
    >
      <div
        className="h-full"
        style={{ background: color ?? C.accent, width: `${pct}%`, borderRadius: WZ.radius.pill, transition: "width 320ms ease" }}
      />
    </div>
  );
}

// Every wizard ends the same way: one green mark, the headline, what was
// recorded, the tiles that prove it, who signed it, and the way onward.
export function CompletionScreen({ title, description, tiles, signature, children }: {
  title: string;
  description: ReactNode;
  tiles?: ReactNode;
  signature?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: C.greenBg, border: `1px solid ${C.green}44`, color: C.green }}
      >
        <Check size={26} />
      </div>
      <h2 className={TX.stepTitle} style={{ color: C.ink, fontFamily: WZ.serif }}>{title}</h2>
      <p className={`${TX.lead} mt-2.5 max-w-[62ch]`} style={{ color: C.muted }}>{description}</p>
      {tiles && <div className="mt-7 w-full max-w-2xl">{tiles}</div>}
      {signature && <div className={`${TX.help} mt-6`} style={{ color: C.muted }}>{signature}</div>}
      {children && <div className="flex items-center gap-2.5 mt-6 flex-wrap justify-center">{children}</div>}
    </div>
  );
}

// A two-line decision button — the choice a wizard offers on the item in
// front of you. Same tone vocabulary as Button, sized for a pair side by side.
export function ActionCard({ icon: Icon, title, description, tone = "secondary", onClick, disabled }: {
  icon: LucideIcon; title: string; description: string;
  tone?: "primary" | "secondary" | "danger"; onClick: () => void; disabled?: boolean;
}) {
  const edge = tone === "danger" ? C.red : tone === "primary" ? C.accent : C.border;
  const ink = tone === "danger" ? C.red : tone === "primary" ? WZ.onAccent : C.ink;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${title} — ${description}`}
      className={`wz-focusable ${tone === "primary" ? "wz-lift" : "wz-hover"} flex-1 min-w-0 text-left px-4 py-3.5 transition-colors`}
      style={{
        background: tone === "primary" ? C.accent : undefined,
        border: `1px solid ${edge}`,
        borderRadius: WZ.radius.control,
      }}
    >
      <span className={`${TX.itemTitle} flex items-center gap-2`} style={{ color: ink }}>
        <Icon size={14} className="shrink-0" /> {title}
      </span>
      <span className={`${TX.help} block mt-1.5`} style={{ color: tone === "primary" ? "rgba(255,255,255,0.78)" : C.muted }}>
        {description}
      </span>
    </button>
  );
}

// A search box that owns its own row. One search affordance for every wizard
// list, rather than a bespoke bordered div per screen.
export function SearchInput({ value, onChange, placeholder, ariaLabel, className = "" }: {
  value: string; onChange: (value: string) => void; placeholder: string; ariaLabel: string; className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search size={14} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <TextInput
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// The one way a failed commit is reported: the validator's own lines, in the
// danger tone, above the thing that could not be saved.
export function SaveErrorCallout({ problems }: { problems: readonly string[] }) {
  return (
    <Callout tone="danger" title="Couldn't save — the change would leave the assessment inconsistent.">
      <ul className="mt-1.5 flex flex-col gap-1">
        {problems.map((problem, i) => <li key={i} className={TX.help} style={{ color: C.ink }}>{problem}</li>)}
      </ul>
    </Callout>
  );
}
