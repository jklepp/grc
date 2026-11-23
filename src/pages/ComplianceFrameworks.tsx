import React, { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, BookOpen, ExternalLink, Scale, Search } from "lucide-react";
import { C } from "../theme";
import { useLiveEngine } from "../engine/useLiveEngine";
import { PageHeader } from "../components/Headings";
import { AreaSelectList, type AreaListItem } from "../components/AreaSelectList";
import { CrossCheckPane } from "../components/CrossCheckPane";
import { IN_SCOPE_CONTROLS } from "../engine";
import {
  SOURCE_DOCUMENTS,
  controlsByClause,
  designation,
  isStructural,
  paragraphMarker,
  type Designation,
  type SourceDocument,
  type SourceParagraph,
} from "../engine/sourceText";
import type { Control } from "../graph/nodes/controls";

// The framework side of the crosswalk: a standard in its own words, paragraph
// by paragraph, with the common controls each paragraph lands on. Common
// Controls answers "what does this control satisfy"; this page answers "what
// does the standard ask for, and where do we cover it."
//
// The page opens on the list of frameworks whose source text ACME holds; each
// one drills into that framework's text. Only standards whose text can be
// republished are here (see engine/sourceText.ts).
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Source Serif 4', serif";

function DesignationTag({ d }: { d: Designation }) {
  const style = d === "Standard"
    ? { background: C.accentBg, color: C.accent }
    : d === "Required"
      ? { background: C.greenBg, color: C.green }
      : { background: C.amberBg, color: C.amber };
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={style}>{d}</span>;
}

function ControlChips({ controls, onOpen }: { controls: Control[] | undefined; onOpen: (c: Control) => void }) {
  if (!controls?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span className="text-[10px] mr-0.5" style={{ color: C.muted }}>Common controls</span>
      {controls.map((c) => (
        <button
          key={c.id}
          type="button"
          title={`${c.name}: cross-check against the source`}
          onClick={() => onOpen(c)}
          className="text-[10px] px-1.5 py-0.5 rounded underline decoration-dotted underline-offset-2"
          style={{ background: C.bg, color: C.accent, fontFamily: MONO }}
        >
          {c.id}
        </button>
      ))}
    </div>
  );
}

function ParagraphRow({ p, controls, onOpen }: { p: SourceParagraph; controls: Control[] | undefined; onOpen: (c: Control) => void }) {
  const d = designation(p);
  return (
    <div id={`clause-${p.id}`} className="flex gap-3 py-2.5" style={{ paddingLeft: (p.level - 1) * 20, borderTop: `1px solid ${C.border}` }}>
      <span className="w-12 shrink-0 text-right text-xs pt-0.5" style={{ color: C.accent, fontFamily: MONO }} title={p.id}>{paragraphMarker(p)}</span>
      <div className="min-w-0 flex-1">
        {p.heading && (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[13px] font-semibold italic" style={{ color: C.ink }}>{p.heading}</span>
            {d && <DesignationTag d={d} />}
          </div>
        )}
        {p.text && <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line" style={{ color: C.ink, marginTop: p.heading ? 2 : 0 }}>{p.text}</p>}
        <div className="text-[10px] mt-1" style={{ color: C.muted, fontFamily: MONO }}>{p.id}</div>
        <ControlChips controls={controls} onOpen={onOpen} />
      </div>
    </div>
  );
}

function Tile({ value, label, hint }: { value: ReactNode; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 min-w-0" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold" style={{ color: C.ink, fontFamily: SERIF }}>{value}</span>
        <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      </div>
      {hint && <div className="text-[10px] mt-0.5 leading-snug" style={{ color: C.muted }}>{hint}</div>}
    </div>
  );
}

function documentStats(doc: SourceDocument, byClause: Map<string, Control[]>) {
  const paragraphs = doc.sections.flatMap((s) => s.paragraphs);
  const count = (d: Designation) => paragraphs.filter((p) => designation(p) === d).length;
  return {
    standards: count("Standard"),
    required: count("Required"),
    addressable: count("Addressable"),
    mapped: paragraphs.filter((p) => byClause.has(p.id)).length,
    worded: paragraphs.filter((p) => !isStructural(p)).length,
  };
}

function useInScopeControls() {
  // Same live read as Common Controls: IN_SCOPE_CONTROLS is reassigned on publish().
  const liveEngine = useLiveEngine();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => IN_SCOPE_CONTROLS, [liveEngine]);
}

function FrameworkList({ onSelect }: { onSelect: (standard: string) => void }) {
  const controls = useInScopeControls();
  const items: AreaListItem[] = useMemo(() => Object.values(SOURCE_DOCUMENTS).map((doc) => {
    const stats = documentStats(doc, controlsByClause(controls, doc.standard));
    return {
      id: doc.standard,
      icon: Scale,
      label: doc.title,
      description: `${doc.citation}. ${doc.license} Source as of ${doc.asOf}.`,
      metrics: [
        { value: stats.worded, label: "Paragraphs" },
        { value: stats.standards, label: "Standards" },
        { value: stats.mapped, label: "Mapped to controls", tone: "good" },
      ],
      attention: { count: 0, label: "Read the source text" },
    };
  }), [controls]);

  return (
    <div className="w-full pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        icon={BookOpen}
        title="Compliance Frameworks"
        description="The source standards, preserved in their own words. Pick a framework to read its requirements and the common controls that map to each one."
      />
      <div className="px-4 lg:px-8">
        <AreaSelectList areas={items} onSelect={onSelect} />
      </div>
    </div>
  );
}

export default function ComplianceFrameworks() {
  const [standard, setStandard] = useState<string | null>(null);
  if (!standard || !SOURCE_DOCUMENTS[standard]) return <FrameworkList onSelect={setStandard} />;
  return <FrameworkSource key={standard} standard={standard} onBack={() => setStandard(null)} />;
}

function FrameworkSource({ standard, onBack }: { standard: string; onBack: () => void }) {
  const CONTROLS = useInScopeControls();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mappedOnly, setMappedOnly] = useState(false);

  const [crossCheckId, setCrossCheckId] = useState<string | null>(null);
  const doc = SOURCE_DOCUMENTS[standard];
  const crossCheckControl = crossCheckId ? CONTROLS.find((c) => c.id === crossCheckId) ?? null : null;
  const byClause = useMemo(() => controlsByClause(CONTROLS, standard), [CONTROLS, standard]);
  const stats = useMemo(() => documentStats(doc, byClause), [doc, byClause]);

  const q = query.trim().toLowerCase();
  const matches = (p: SourceParagraph) =>
    !isStructural(p) &&
    (!mappedOnly || byClause.has(p.id)) &&
    (!q || p.id.toLowerCase().includes(q) || p.text.toLowerCase().includes(q) || (p.heading ?? "").toLowerCase().includes(q));

  const filtering = Boolean(q) || mappedOnly;
  const sections = doc.sections
    .filter((s) => !sectionId || s.id === sectionId)
    .map((s) => ({ section: s, paragraphs: s.paragraphs.filter(matches) }))
    .filter((s) => !filtering || s.paragraphs.length > 0);

  const navButton = (key: string, label: ReactNode, count: number | null, active: boolean, onClick: () => void, first = false) => (
    <button
      key={key}
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs"
      style={{ background: active ? C.panel2 : "transparent", color: active ? C.accent : C.ink, borderTop: first ? "none" : `1px solid ${C.border}` }}
    >
      <span className="flex-1 min-w-0">{label}</span>
      {count != null && <span className="shrink-0" style={{ color: C.muted, fontFamily: MONO }}>{count}</span>}
    </button>
  );

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-4 lg:px-8 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 -ml-2"
          style={{ minHeight: 32, color: C.accent }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> All frameworks
        </button>
      </div>
      <PageHeader
        icon={Scale}
        title={doc.title}
        description="The framework in its own words, with the common controls every requirement maps to."
        right={
          <a
            href={doc.source}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}
          >
            <ExternalLink size={12} /> {doc.citation} · eCFR as of {doc.asOf}
          </a>
        }
      />

      <div className="px-4 lg:px-8 pb-12 flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile value={stats.standards} label="Standards" hint={`${doc.title}, ${doc.citation}`} />
          <Tile value={stats.required} label="Required specifications" />
          <Tile value={stats.addressable} label="Addressable specifications" hint="Implement, or document why not and adopt an equivalent." />
          <Tile value={`${stats.mapped} of ${stats.worded}`} label="Paragraphs mapped" hint="Paragraphs at least one common control lands on." />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
          <nav aria-label="Sections" className="w-full lg:w-72 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
            <div className="p-3 text-xs font-medium" style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>SECTIONS</div>
            {navButton("all", <span className="font-medium">All of {doc.citation.replace(/^45 CFR /, "")}</span>, null, sectionId === null, () => setSectionId(null), true)}
            {doc.sections.map((s) =>
              navButton(
                s.id,
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="shrink-0 text-[10px]" style={{ color: sectionId === s.id ? C.accent : C.muted, fontFamily: MONO }}>§ {s.id}</span>
                  <span className="truncate">{s.title.replace(/\.$/, "")}</span>
                </span>,
                s.paragraphs.filter((p) => byClause.has(p.id)).length || null,
                sectionId === s.id,
                () => setSectionId(s.id),
              )
            )}
          </nav>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <Search size={14} color={C.muted} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search text or citation, e.g. 164.312(a)" aria-label="Search requirements" className="bg-transparent text-sm outline-none w-full" style={{ color: C.ink }} />
              </label>
              <label className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.ink }}>
                <input type="checkbox" checked={mappedOnly} onChange={(e) => setMappedOnly(e.target.checked)} />
                Mapped to a control
              </label>
            </div>

            <div className="flex flex-col gap-4">
              {sections.map(({ section, paragraphs }) => (
                <section key={section.id} aria-labelledby={`sec-${section.id}`} className="rounded-xl px-5 py-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <div className="text-xs" style={{ color: C.accent, fontFamily: MONO }}>§ {section.id}</div>
                  <h2 id={`sec-${section.id}`} className="mt-0.5 mb-2 text-lg" style={{ color: C.ink, fontFamily: SERIF, fontWeight: 600 }}>{section.title}</h2>
                  {!filtering && section.intro.map((t, i) => (
                    <p key={i} className="mt-0 mb-2 text-[13px] leading-relaxed" style={{ color: C.ink }}>{t}</p>
                  ))}
                  {paragraphs.map((p) => <ParagraphRow key={p.id} p={p} controls={byClause.get(p.id)} onOpen={(c) => setCrossCheckId(c.id)} />)}
                </section>
              ))}
              {sections.length === 0 && (
                <div className="rounded-xl px-5 py-6 text-xs" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>No requirements match.</div>
              )}
              <p className="m-0 text-[11px] leading-relaxed" style={{ color: C.muted }}>
                Text retrieved from the eCFR on {doc.asOf}. {doc.license} Control mappings come from the Secure Controls Framework crosswalk.
              </p>
            </div>
          </div>
        </div>
      </div>
      {crossCheckControl && (
        <CrossCheckPane control={crossCheckControl} standard={standard} onClose={() => setCrossCheckId(null)} />
      )}
    </div>
  );
}
