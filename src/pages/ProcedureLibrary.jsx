import React, { useEffect, useState } from "react";
import {
  ListChecks, ClipboardList, Layers, Link2, Boxes, User, RefreshCw, FileCheck2,
  CheckCircle2, Circle, RotateCcw, Info, Play, X, PartyPopper,
} from "lucide-react";
import { C } from "../theme";
import { PROCEDURES } from "../data/procedures";
import { POLICIES, getFrameworkClauses } from "../data/policies";
import { ASSET_SUMMARIES } from "../data/assets";
import { EVIDENCE_CONFIDENCE } from "../data/assuranceModel";

const STANDARD_ABBR = { "SOC 2": "SOC2", "ISO 27001": "27001", "ISO 27017": "27017", "ISO 27018": "27018", "ISO 27701": "27701", "PCI DSS": "PCI", HIPAA: "HIPAA" };
const MAPPED_STANDARDS = ["ISO 27001", "SOC 2", "PCI DSS", "HIPAA"];

// There's no real auth/user system yet, so the attestation workflow below
// simulates a single signed-in operator running their own SOP — same "JK"
// identity the app used to show in the old Executive Dashboard header. State
// persists in localStorage only (no backend), keyed per step so it survives
// navigating away and back, but resets if you clear it. None of this touches
// the static page behind the popup — that page is just the SOP document.
const SIMULATED_USER = { initials: "JK", name: "You" };
const STORAGE_KEY = "grc-procedure-attestations";
const SLIDE_MS = 320;

function loadAttestations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>
      <Icon size={12} /> {children}
    </div>
  );
}

function MetaChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
        <Icon size={11} /> {label}
      </div>
      <div className="text-xs mt-1" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

// Some SOPs now cover up to ~46 real controls (the Governance, Risk &
// Compliance group), so the raw ID list and clause citations both need to
// stay usable rather than dumping a wall of IDs — collapsed by default with
// a "show N more" toggle, and the clause list scrolls instead of growing
// the card indefinitely.
function ControlMapping({ controlIds, uncitedControlIds }) {
  const [expanded, setExpanded] = useState(false);
  const [showUncited, setShowUncited] = useState(false);
  const LIMIT = 18;
  const shown = expanded ? controlIds : controlIds.slice(0, LIMIT);
  const hiddenCount = controlIds.length - shown.length;
  const citedCount = controlIds.length - uncitedControlIds.length;

  return (
    <div className="rounded-lg p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="text-[11px] mb-3" style={{ color: C.muted }}>
        Maps to <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{controlIds.length}</span> SCF control{controlIds.length !== 1 ? "s" : ""}:{" "}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{shown.join(", ")}{hiddenCount > 0 ? " …" : ""}</span>
        {hiddenCount > 0 && (
          <button onClick={() => setExpanded(true)} className="ml-1.5 font-medium" style={{ color: C.accent }}>show {hiddenCount} more</button>
        )}
        {expanded && controlIds.length > LIMIT && (
          <button onClick={() => setExpanded(false)} className="ml-1.5 font-medium" style={{ color: C.accent }}>show less</button>
        )}
      </div>
      <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${C.border}`, maxHeight: 160, overflowY: "auto" }}>
        {MAPPED_STANDARDS.map((std) => {
          const clauses = getFrameworkClauses(controlIds, std);
          if (clauses.length === 0) return null;
          return (
            <div key={std} className="flex items-start gap-2 text-[11px]">
              <span className="w-12 shrink-0 font-semibold pt-0.5" style={{ color: C.accent }}>{STANDARD_ABBR[std]}</span>
              <span className="flex-1" style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{clauses.join(", ")}</span>
            </div>
          );
        })}
      </div>
      <div className="pt-2 mt-2 text-[11px]" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>{citedCount}/{controlIds.length}</span>{" "}
        {uncitedControlIds.length === 0
          ? "controls are individually cited on a specific step above (tagged inline) — every control this procedure owns is called out at step level."
          : "controls are individually cited on a specific step above (tagged inline); the rest are covered by the procedure as a whole but not yet called out at step level."}
        {uncitedControlIds.length > 0 && (
          <>
            {" "}
            <button onClick={() => setShowUncited((v) => !v)} className="font-medium" style={{ color: C.accent }}>
              {showUncited ? "hide" : "show"} the {uncitedControlIds.length} not yet cited
            </button>
            {showUncited && (
              <div className="mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{uncitedControlIds.join(", ")}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function assuranceColor(score) {
  if (score >= 90) return C.green;
  if (score >= 75) return C.amber;
  if (score >= 60) return C.amber;
  return C.red;
}

// The animated step card: sits inside an overflow-hidden frame in the modal.
// Completing a step drives it through exit (slide left + fade) -> instantly
// repositioned off-screen right with transitions disabled -> enter (slide
// back to center + fade). The double requestAnimationFrame before flipping
// to "enter" forces the browser to paint the off-screen position first, so
// the transition back to center actually animates instead of being
// collapsed into a single no-op frame.
function StepCard({ step, onComplete, phase }) {
  const slide = (() => {
    switch (phase) {
      case "exit":
        return { transform: "translateX(-115%)", opacity: 0, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
      case "enter-instant":
        return { transform: "translateX(115%)", opacity: 0, transition: "none" };
      case "enter":
        return { transform: "translateX(0)", opacity: 1, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
      default:
        return { transform: "translateX(0)", opacity: 1, transition: `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` };
    }
  })();

  return (
    <div style={{ ...slide, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="text-2xl font-semibold mb-4" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{step.title}</div>
      <div className="text-sm leading-relaxed mb-8" style={{ color: C.muted, maxWidth: 440 }}>{step.detail}</div>
      <button
        onClick={onComplete}
        className="flex items-center justify-center gap-2 text-sm font-semibold py-3 px-6 rounded-lg"
        style={{ background: C.accent, color: "#fff", width: "fit-content" }}
      >
        <CheckCircle2 size={16} /> Mark step complete
      </button>
    </div>
  );
}

function SopWizardModal({ procedure, attestedMap, onAttestStep, onRestart, onClose }) {
  const steps = procedure.steps;
  const firstIncomplete = steps.findIndex((_, i) => !attestedMap[i]);
  const startIndex = firstIncomplete === -1 ? steps.length : firstIncomplete;

  const [displayIndex, setDisplayIndex] = useState(startIndex);
  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isComplete = displayIndex >= steps.length;

  function handleComplete() {
    onAttestStep(displayIndex);
    setPhase("exit");
    setTimeout(() => {
      const next = displayIndex + 1;
      setDisplayIndex(next);
      if (next < steps.length) {
        setPhase("enter-instant");
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase("enter")));
      } else {
        setPhase("idle");
      }
    }, SLIDE_MS);
  }

  function handleRestart() {
    onRestart();
    setDisplayIndex(0);
    setPhase("idle");
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full flex overflow-hidden"
        style={{ background: C.panel, border: `1px solid ${C.border}`, maxWidth: 860, height: "min(640px, 85vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: the full process workflow, always visible */}
        <div className="w-72 shrink-0 p-5 flex flex-col" style={{ background: C.panel2, borderRight: `1px solid ${C.border}`, overflowY: "auto" }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{procedure.code}</div>
          <div className="text-sm font-semibold mb-4 leading-snug" style={{ color: C.ink }}>{procedure.title}</div>
          <div className="space-y-1">
            {steps.map((s, i) => {
              const done = i < displayIndex || (i === displayIndex && phase === "exit");
              const isCurrent = i === displayIndex && !isComplete && phase !== "exit";
              const record = attestedMap[i];
              return (
                <div
                  key={i}
                  title={record ? `Attested ${formatTimestamp(record.at)}` : undefined}
                  className="flex items-start gap-2.5 rounded-lg p-2"
                  style={{ background: isCurrent ? C.accentBg : "transparent" }}
                >
                  <span className="shrink-0 mt-0.5">
                    {done ? <CheckCircle2 size={15} color={C.green} /> : <Circle size={15} color={isCurrent ? C.accent : C.muted} />}
                  </span>
                  <span className="text-xs leading-snug" style={{ color: done ? C.green : isCurrent ? C.ink : C.muted, fontWeight: isCurrent ? 600 : 400 }}>
                    {i + 1}. {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: the step actually being worked, one at a time */}
        <div className="flex-1 min-w-0 p-8 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4 shrink-0">
            <div className="text-xs font-medium" style={{ color: C.muted }}>
              {!isComplete ? `Step ${displayIndex + 1} of ${steps.length}` : "Workflow complete"}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: C.muted, background: C.panel2 }} title="Close">
              <X size={16} />
            </button>
          </div>

          <div style={{ overflow: "hidden", position: "relative", flex: 1 }}>
            {!isComplete ? (
              <StepCard step={steps[displayIndex]} onComplete={handleComplete} phase={phase} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <PartyPopper size={40} color={C.green} className="mb-3" />
                <div className="text-xl font-semibold" style={{ color: C.ink }}>SOP fully attested</div>
                <div className="text-xs mt-1 mb-6" style={{ color: C.muted }}>
                  {steps.length} of {steps.length} steps attested by {SIMULATED_USER.initials}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestart}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-lg text-sm font-semibold"
                    style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
                  >
                    <RotateCcw size={14} /> Restart
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-3 rounded-lg text-sm font-semibold"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProcedureLibrary({ onNavigate }) {
  const [selectedId, setSelectedId] = useState(PROCEDURES[0].id);
  const [attestations, setAttestations] = useState(loadAttestations);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attestations));
  }, [attestations]);

  const selected = PROCEDURES.find((p) => p.id === selectedId) || PROCEDURES[0];
  const linkedPolicy = POLICIES.find((p) => p.id === selected.policyId);

  const scoredAssets = [...ASSET_SUMMARIES]
    .filter((a) => a.categoryScores[selected.category] != null)
    .sort((a, b) => b.categoryScores[selected.category] - a.categoryScores[selected.category]);

  function attestStep(procedureId, stepIndex) {
    setAttestations((prev) => ({
      ...prev,
      [procedureId]: { ...(prev[procedureId] || {}), [stepIndex]: { by: SIMULATED_USER.initials, at: new Date().toISOString() } },
    }));
  }

  function resetProcedure(procedureId) {
    setAttestations((prev) => {
      const next = { ...prev };
      delete next[procedureId];
      return next;
    });
  }

  const selectedAttested = attestations[selected.id] || {};

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
          <ListChecks size={13} /> Procedure Library
        </div>
        <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>ACME SOP Library</h1>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          One Standard Operating Procedure per Assurance Category — the "how" behind each policy's "what," generic
          enough to cover every asset in a category rather than one per asset. Each SOP links to the policy it
          operationalizes and the real assets currently scored against it.
        </p>
      </div>

      <div className="px-8 flex gap-5 pb-12">
        <div className="w-64 shrink-0 rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.border}`, height: "fit-content" }}>
          {PROCEDURES.map((p) => {
            const isActive = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="w-full flex flex-col items-start px-3 py-2.5 text-left"
                style={{ background: isActive ? C.panel2 : "transparent", borderBottom: `1px solid ${C.border}` }}
              >
                <span className="text-[10px]" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{p.code} · {p.category}</span>
                <span className="text-xs leading-snug font-medium" style={{ color: isActive ? C.ink : C.muted }}>{p.title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 rounded-xl p-6" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
            {selected.code} · {selected.category}
          </div>
          <h2 className="text-2xl mb-3" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>{selected.title}</h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: C.ink }}>{selected.purpose}</p>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <MetaChip icon={User} label="Owner" value={selected.owner} />
            <MetaChip icon={RefreshCw} label="Review Cadence" value={selected.reviewCadence} />
            <MetaChip icon={FileCheck2} label="Typical Evidence" value={selected.evidenceType} />
          </div>

          {linkedPolicy && (
            <div className="mb-6">
              <SectionLabel icon={Link2}>Implements policy</SectionLabel>
              <button
                onClick={() => onNavigate && onNavigate("policy-center")}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.border}` }}
              >
                <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{linkedPolicy.code}</span> {linkedPolicy.title}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={ClipboardList}>
              <span style={{ margin: 0 }}>Procedure steps</span>
            </SectionLabel>
            <div className="flex items-center gap-2">
              <button
                onClick={() => resetProcedure(selected.id)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                style={{ color: C.muted }}
                title="Clear attestations for this SOP"
              >
                <RotateCcw size={11} /> Reset
              </button>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: C.accent, color: "#fff" }}
              >
                <Play size={13} /> Start SOP
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {selected.steps.map((s, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-xs font-semibold shrink-0 w-5" style={{ color: C.accent }}>{i + 1}.</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{s.title}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>{s.detail}</div>
                  {s.controls && s.controls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.controls.map((id) => (
                        <span
                          key={id}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: C.panel2, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${C.border}` }}
                          title="Control this step operationalizes"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg p-3 mb-6" style={{ background: C.panel2, color: C.muted }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Running the SOP through <span style={{ color: C.ink, fontWeight: 600 }}>Start SOP</span> records
              <span style={{ color: C.ink, fontWeight: 600 }}> Self-attestation</span>-tier evidence
              ({EVIDENCE_CONFIDENCE["Self-attestation"]}/100 in the Cyber Assurance model) — the lowest confidence
              tier there is. It's a real record that the step happened, but it doesn't raise an asset's Control
              Assurance score on its own; pairing it with a stronger evidence type (a screenshot, an automated test,
              continuous telemetry) is what actually would.
            </span>
          </div>

          <SectionLabel icon={Layers}>Control mapping</SectionLabel>
          <div className="mb-6"><ControlMapping controlIds={selected.controlIds} uncitedControlIds={selected.uncitedControlIds} /></div>

          <SectionLabel icon={Boxes}>Assets scored against this category</SectionLabel>
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            {scoredAssets.map((a, i) => (
              <button
                key={a.id}
                onClick={() => onNavigate && onNavigate("asset-register")}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none", background: i % 2 ? "transparent" : C.panel2 }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{a.name}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>{a.system.name}</div>
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: assuranceColor(a.categoryScores[selected.category]) }}>
                  {a.categoryScores[selected.category]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {wizardOpen && (
        <SopWizardModal
          procedure={selected}
          attestedMap={selectedAttested}
          onAttestStep={(stepIndex) => attestStep(selected.id, stepIndex)}
          onRestart={() => resetProcedure(selected.id)}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
