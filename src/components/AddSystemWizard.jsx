import React, { useMemo, useState } from "react";
import {
  Info, Gauge, Layers, ClipboardCheck, Check, AlertTriangle, Plus, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { C } from "../theme";
import Modal, { ModalCloseButton } from "./Modal";
import { ClassificationTag, AssuranceBadge } from "./SystemBadges";
import {
  ORGS, VENDORS, PROVIDER_CERTIFICATIONS, HOSTING_TYPES, INHERITED_DOMAINS,
  AVAILABILITY_TIERS, DATA_SUBJECT_TYPES, ASSET_TYPE_CATEGORIES, ASSET_TYPES,
  DATA_ROLE_META, getAllDataTypes, CLOUD_REGIONS, RETENTION_OPTIONS, RESIDENCY_OPTIONS,
} from "../engine";
import { buildLiveEngine } from "../engine/liveGraph";
import { YAML_FACTS } from "../graph/sources/yaml";
import { loadRuntimeFacts, saveRuntimeFacts, nextSystemId, nextAssetId } from "../engine/runtimeFactsStore";

const STEPS = [
  { id: 1, title: "System", detail: "Identity & hosting", icon: Info },
  { id: 2, title: "Scope", detail: "Assessment coverage", icon: Gauge },
  { id: 3, title: "Assets", detail: "What it holds", icon: Layers },
  { id: 4, title: "Review", detail: "Computed posture", icon: ClipboardCheck },
];

// Providers eligible for a given hosting type: only ones whose certification
// coverage already spans every domain that hosting type inherits. Anything
// else would leave the system with zero assessed controls, which the
// validators treat as a build failure rather than a legitimate "just
// onboarded" state — see the plan doc / liveGraph.ts comment.
// A vendor whose certification happens to be a superset of a lighter hosting
// type's required domains (Workday's SaaS cert covers cloud's two domains)
// still isn't a real option for that hosting type — the vendor's own
// category has to match what the hosting type actually is.
const HOSTING_VENDOR_CATEGORY = { cloud: "cloud-infrastructure", saas: "saas" };

function eligibleProviders(hostingType) {
  const required = INHERITED_DOMAINS[hostingType] || [];
  if (required.length === 0) return [];
  const category = HOSTING_VENDOR_CATEGORY[hostingType];
  return VENDORS.filter((v) => {
    if (category && v.category !== category) return false;
    const covered = new Set(
      PROVIDER_CERTIFICATIONS.filter((c) => c.provider === v.name).flatMap((c) => c.domains)
    );
    return required.every((d) => covered.has(d));
  });
}

function blankAsset(index) {
  const assetType = ASSET_TYPES[0];
  return {
    key: `new-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    assetType,
    kind: ASSET_TYPE_CATEGORIES[assetType][0],
    provider: "",
    criticalityFactors: {
      confidentiality: { score: 2, reason: "" },
      integrity: { score: 2, reason: "" },
      availability: { score: 2, reason: "" },
      regulatory: { score: 2, reason: "" },
      businessDependency: { score: 2, reason: "" },
    },
    inherentLikelihood: 2,
    dataTypes: {}, // dataTypeId -> role ("" = not touched)
  };
}

const CRIT_FACTORS = [
  ["confidentiality", "Confidentiality"],
  ["integrity", "Integrity"],
  ["availability", "Availability"],
  ["regulatory", "Regulatory"],
  ["businessDependency", "Business dependency"],
];

function Field({ label, note, span2, children }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wide font-mono mb-1.5" style={{ color: C.muted }}>{label}</label>
      {children}
      {note && <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>{note}</div>}
    </div>
  );
}

const inputStyle = { background: C.panel2, border: `1px solid ${C.border}`, color: C.ink };
function TextInput(props) {
  return <input {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />;
}
function TextArea(props) {
  return <textarea {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y" style={{ ...inputStyle, minHeight: 60 }} />;
}
function Select(props) {
  return <select {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />;
}

export default function AddSystemWizard({ open, onClose, onCreated }) {
  const [step, setStep] = useState(1);

  const [hostingType, setHostingType] = useState("cloud");
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [boundary, setBoundary] = useState("");
  const [availabilityTier, setAvailabilityTier] = useState(AVAILABILITY_TIERS[1]);
  const [userCount, setUserCount] = useState(0);
  const [regions, setRegions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [approxRecords, setApproxRecords] = useState(0);
  const [retention, setRetention] = useState(RETENTION_OPTIONS[0]);
  const [residency, setResidency] = useState(RESIDENCY_OPTIONS[0]);
  const [internetFacing, setInternetFacing] = useState(false);
  const [ownerOrgId, setOwnerOrgId] = useState(ORGS[0]?.id ?? "");
  const [assessor, setAssessor] = useState("");

  const [assets, setAssets] = useState([blankAsset(0)]);

  const [dryRun, setDryRun] = useState(null); // { problems, systemId, classification, assurance, coverage }
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const providers = useMemo(() => eligibleProviders(hostingType), [hostingType]);
  const dataTypes = useMemo(() => getAllDataTypes(), []);

  function reset() {
    setStep(1); setHostingType("cloud"); setProvider(""); setName(""); setMission(""); setBoundary("");
    setAvailabilityTier(AVAILABILITY_TIERS[1]); setUserCount(0); setRegions([]); setSubjects([]);
    setApproxRecords(0); setRetention(RETENTION_OPTIONS[0]); setResidency(RESIDENCY_OPTIONS[0]); setInternetFacing(false);
    setOwnerOrgId(ORGS[0]?.id ?? ""); setAssessor(""); setAssets([blankAsset(0)]); setDryRun(null);
  }

  function close() { reset(); onClose(); }

  function updateAsset(key, patch) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  function updateAssetType(key, assetType) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, assetType, kind: ASSET_TYPE_CATEGORIES[assetType][0] } : a)));
  }
  function updateCrit(key, factor, patch) {
    setAssets((prev) => prev.map((a) => (a.key === key
      ? { ...a, criticalityFactors: { ...a.criticalityFactors, [factor]: { ...a.criticalityFactors[factor], ...patch } } }
      : a)));
  }
  function toggleDataType(key, dataTypeId, checked) {
    setAssets((prev) => prev.map((a) => {
      if (a.key !== key) return a;
      const next = { ...a.dataTypes };
      if (checked) next[dataTypeId] = next[dataTypeId] || "processes";
      else delete next[dataTypeId];
      return { ...a, dataTypes: next };
    }));
  }
  function setDataTypeRole(key, dataTypeId, role) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, dataTypes: { ...a.dataTypes, [dataTypeId]: role } } : a)));
  }
  function addAsset() { setAssets((prev) => [...prev, blankAsset(prev.length)]); }
  function removeAsset(key) { setAssets((prev) => (prev.length > 1 ? prev.filter((a) => a.key !== key) : prev)); }

  // Builds the runtime fact rows this system/its assets would add, on top of
  // whatever the user has already created in earlier sessions — never wired
  // into the real store until Create System is pressed.
  function buildCandidateRuntimeFacts() {
    const existing = loadRuntimeFacts();
    const systemId = nextSystemId(existing);
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const system = {
      id: systemId,
      name: name.trim() || "Untitled system",
      env: `${provider || "Unknown provider"} (${hostingType})`,
      hostingType,
      provider,
      standards: [...new Set(PROVIDER_CERTIFICATIONS.filter((c) => c.provider === provider).map((c) => c.standard))],
      mission: mission.trim(),
      boundary: boundary.trim(),
      connections: [],
      roles: ownerOrgId ? [{ role: "System Owner", ownerId: ownerOrgId }] : [],
      syncSource: "manual",
      lastSynced: "just now",
      oktaEnforced: "compliant",
      mfaEnforced: "compliant",
      internetFacing,
      availabilityTier,
      userCount: Number(userCount) || 0,
      regions,
      dataProfile: {
        subjects,
        approxRecords: Number(approxRecords) || 0,
        retention,
        residency: residency ? [residency] : [],
      },
    };

    const newAssets = assets.map((a, i) => ({
      id: nextAssetId(systemId, i),
      systemId,
      name: a.name.trim() || `Asset ${i + 1}`,
      type: a.assetType,
      kind: a.kind,
      provider: a.provider.trim() || provider,
      code: `A${i + 1}`,
      criticalityFactors: a.criticalityFactors,
      inherentLikelihood: Number(a.inherentLikelihood) || 1,
    }));

    const newAssetDataTypes = assets.flatMap((a, i) =>
      Object.entries(a.dataTypes).map(([dataTypeId, role]) => ({
        assetId: nextAssetId(systemId, i), dataTypeId, role,
      }))
    );

    const assessmentScope = {
      systemId,
      engagement: `Onboarding — ${system.name}`,
      assessor: assessor.trim() || "Unassigned",
      periodStart: today,
      periodEnd: nextYear,
      samplingRationale:
        "New system, not yet subject to a dedicated assessment engagement — controls are assessed only where the hosting provider's own certification already covers them.",
      controlIds: [],
    };

    const runtime = {
      systems: [...existing.systems, system],
      assets: [...existing.assets, ...newAssets],
      assetDataTypes: [...existing.assetDataTypes, ...newAssetDataTypes],
      assessmentScopes: [...existing.assessmentScopes, assessmentScope],
      expectedClassification: { ...existing.expectedClassification },
      // This wizard only ever adds a system — it never evaluates a control —
      // so these three just carry forward whatever runtimeMutations.ts has
      // already recorded for earlier systems, unchanged.
      implementationMechanisms: [...existing.implementationMechanisms],
      evidence: [...existing.evidence],
      notImplemented: [...existing.notImplemented],
    };

    return { runtime, systemId };
  }

  function runDryRun() {
    setChecking(true);
    // Synchronous today (buildLiveEngine has no async work), but kept as its
    // own step so the Review panel can show a spinner if that ever changes.
    const { runtime, systemId } = buildCandidateRuntimeFacts();
    const { engine, problems } = buildLiveEngine(YAML_FACTS, runtime);
    if (!engine) {
      setDryRun({ problems, systemId: null });
      setChecking(false);
      return;
    }
    const rollup = engine.rollups.systemRollups.find((s) => s.id === systemId);
    setDryRun({
      problems: [],
      systemId,
      classification: rollup?.classification ?? null,
      assurance: rollup?.overallAssurance ?? null,
      coverage: rollup?.coverage ?? null,
    });
    setChecking(false);
  }

  function goNext() {
    if (step === 3) { runDryRun(); setStep(4); return; }
    if (step < 4) setStep(step + 1);
  }
  function goBack() { if (step > 1) setStep(step - 1); }
  function jumpTo(n) { setStep(n); }

  function handleCreate() {
    if (!dryRun || dryRun.problems.length > 0) return;
    setSaving(true);
    const { runtime } = buildCandidateRuntimeFacts();
    saveRuntimeFacts(runtime);
    setSaving(false);
    onCreated?.();
    window.location.reload();
  }

  const canAdvanceFrom1 = name.trim() && provider && boundary.trim() && mission.trim();

  return (
    <Modal open={open} onClose={close} width={960} height={700}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
            <ClipboardCheck size={19} color={C.accent} />
            Add System
          </h1>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            New systems are assessed the same way as every existing one — nothing here is scored by hand.
          </div>
        </div>
        <ModalCloseButton onClose={close} />
      </div>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "188px 1fr" }}>
        {/* ---- Step rail ---- */}
        <nav className="p-3 overflow-y-auto" style={{ borderRight: `1px solid ${C.border}`, background: C.panel2 }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => jumpTo(s.id)}
                  className="w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors"
                  style={{ background: isActive ? C.accentBg : "transparent" }}
                >
                  <span
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono font-semibold"
                    style={{
                      border: `1.5px solid ${isActive ? C.accent : isDone ? C.green : C.border}`,
                      background: isActive ? C.accent : isDone ? C.greenBg : "transparent",
                      color: isActive ? "#fff" : isDone ? C.green : C.muted,
                    }}
                  >
                    {isDone ? <Check size={12} /> : s.id}
                  </span>
                  <span className="pt-0.5">
                    <div className="text-[12.5px] font-semibold" style={{ color: isActive ? C.ink : C.muted }}>{s.title}</div>
                    <div className="text-[10.5px]" style={{ color: C.muted }}>{s.detail}</div>
                  </span>
                </button>
                {i < STEPS.length - 1 && <div style={{ width: 1.5, height: 16, marginLeft: 21, background: C.border }} />}
              </React.Fragment>
            );
          })}
        </nav>

        {/* ---- Content pane ---- */}
        <div className="p-6 overflow-y-auto">
          {step === 1 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 1 of 4</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>System identity & hosting</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Core facts about the system. Its classification, assurance and PRISMA level are never entered here — they're
                computed from what you tell us it holds, in Step 3.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="System name" span2><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Analytics Data Lake" /></Field>
                <Field label="Mission" span2><TextArea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="What does this system do, and for whom?" /></Field>
                <Field label="Boundary" span2><TextArea value={boundary} onChange={(e) => setBoundary(e.target.value)} placeholder="What's inside this boundary, and what isn't?" /></Field>

                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide font-mono mb-1.5" style={{ color: C.muted }}>Hosting type</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {HOSTING_TYPES.map((h) => {
                      const disabled = eligibleProviders(h).length === 0;
                      const selected = hostingType === h;
                      return (
                        <button
                          key={h}
                          disabled={disabled}
                          onClick={() => { setHostingType(h); setProvider(""); }}
                          title={disabled ? "No certified provider covers this hosting type's inherited domains yet" : undefined}
                          className="text-left rounded-lg px-3 py-2.5 transition-colors"
                          style={{
                            border: `1.5px solid ${selected ? C.accent : C.border}`,
                            background: selected ? C.accentBg : C.panel2,
                            opacity: disabled ? 0.45 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                        >
                          <div className="text-[13px] font-semibold capitalize" style={{ color: selected ? C.accent : C.ink }}>{h.replace("-", " ")}</div>
                          <div className="text-[10.5px] mt-0.5" style={{ color: C.muted }}>
                            {disabled ? "No certified provider on file yet" : `${eligibleProviders(h).length} certified provider${eligibleProviders(h).length === 1 ? "" : "s"}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10.5px] mt-1.5" style={{ color: C.muted }}>
                    Only hosting types with a certified provider on file are selectable — otherwise this system would have zero
                    assessed controls, which fails validation.
                  </div>
                </div>

                <Field label="Provider" note="Only providers whose certifications cover this hosting type's inherited domains appear here.">
                  <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="">Select a provider…</option>
                    {providers.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </Select>
                </Field>
                <Field label="Availability tier">
                  <Select value={availabilityTier} onChange={(e) => setAvailabilityTier(e.target.value)}>
                    {AVAILABILITY_TIERS.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
                  </Select>
                </Field>

                <Field label="Users"><TextInput type="number" min={0} value={userCount} onChange={(e) => setUserCount(e.target.value)} /></Field>
                <Field label="Regions">
                  <div className="flex flex-wrap gap-3 pt-1">
                    {CLOUD_REGIONS.map((r) => (
                      <label key={r} className="flex items-center gap-1.5 text-sm font-mono" style={{ color: C.ink }}>
                        <input
                          type="checkbox"
                          checked={regions.includes(r)}
                          onChange={(e) => setRegions((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="System owner">
                  <Select value={ownerOrgId} onChange={(e) => setOwnerOrgId(e.target.value)}>
                    {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
                <Field label="Internet facing?">
                  <label className="flex items-center gap-2 text-sm py-2" style={{ color: C.ink }}>
                    <input type="checkbox" checked={internetFacing} onChange={(e) => setInternetFacing(e.target.checked)} />
                    Reachable from the open internet
                  </label>
                </Field>

                <Field label="Data subjects" span2>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {DATA_SUBJECT_TYPES.map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-sm capitalize" style={{ color: C.ink }}>
                        <input
                          type="checkbox"
                          checked={subjects.includes(s)}
                          onChange={(e) => setSubjects((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                        />
                        {s.replace("-", " ")}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Approx. records"><TextInput type="number" min={0} value={approxRecords} onChange={(e) => setApproxRecords(e.target.value)} /></Field>
                <Field label="Retention">
                  <Select value={retention} onChange={(e) => setRetention(e.target.value)}>
                    {RETENTION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
                <Field label="Residency" span2>
                  <Select value={residency} onChange={(e) => setResidency(e.target.value)}>
                    {RESIDENCY_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 2 of 4</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Assessment scope</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                How this system's controls get assessed. Most of this is set by what you chose in Step 1, not typed here.
              </p>

              <div className="rounded-xl p-4 mb-5 flex gap-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <Gauge size={18} color={C.accent} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: C.ink }}>Scored by provider inheritance</div>
                  <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
                    Controls in {provider || "the chosen provider"}'s certified domains are assessed automatically from its own
                    reports. No dedicated engagement is scoped yet — no controls are hand-marked satisfied.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 max-w-[60ch]">
                <Field label="Assessor of record" note="The one field here that's a real authored fact, not a default — who's vouching for this system.">
                  <TextInput value={assessor} onChange={(e) => setAssessor(e.target.value)} placeholder="e.g. J. Ortiz — Security Engineering" />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 3 of 4</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Assets</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Every asset needs at least one data type assigned — that's the only input classification is derived from.
              </p>

              {assets.map((a, i) => (
                <div key={a.key} className="rounded-xl p-4 mb-3.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="text-[13px] font-bold flex items-center gap-2" style={{ color: C.ink }}>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                        {`A${i + 1}`}
                      </span>
                      {a.name || `Asset ${i + 1}`}
                    </div>
                    {assets.length > 1 && (
                      <button onClick={() => removeAsset(a.key)} className="p-1 rounded" style={{ color: C.muted }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3.5">
                    <Field label="Name"><TextInput value={a.name} onChange={(e) => updateAsset(a.key, { name: e.target.value })} /></Field>
                    <Field label="Type">
                      <Select value={a.assetType} onChange={(e) => updateAssetType(a.key, e.target.value)}>
                        {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                    <Field label="Kind">
                      <Select value={a.kind} onChange={(e) => updateAsset(a.key, { kind: e.target.value })}>
                        {ASSET_TYPE_CATEGORIES[a.assetType].map((k) => <option key={k} value={k}>{k.replace(/-/g, " ")}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <div className="text-[10px] uppercase tracking-wide font-mono mb-2" style={{ color: C.muted }}>Criticality</div>
                  <div className="grid gap-2 mb-1" style={{ gridTemplateColumns: "128px 70px 1fr" }}>
                    {CRIT_FACTORS.map(([key, label]) => (
                      <React.Fragment key={key}>
                        <div className="text-xs flex items-center" style={{ color: C.ink }}>{label}</div>
                        <select
                          value={a.criticalityFactors[key].score}
                          onChange={(e) => updateCrit(a.key, key, { score: Number(e.target.value) })}
                          className="text-xs rounded px-2 py-1"
                          style={inputStyle}
                        >
                          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <input
                          value={a.criticalityFactors[key].reason}
                          onChange={(e) => updateCrit(a.key, key, { reason: e.target.value })}
                          placeholder="reason"
                          className="text-xs rounded px-2 py-1"
                          style={inputStyle}
                        />
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase tracking-wide font-mono mt-3.5 mb-2" style={{ color: C.muted }}>Data types touched</div>
                  <div className="rounded-lg" style={{ border: `1px solid ${C.border}` }}>
                    {dataTypes.map((dt, di) => {
                      const checked = Object.hasOwn(a.dataTypes, dt.id);
                      return (
                        <div
                          key={dt.id}
                          className="flex items-center gap-2.5 px-3 py-2"
                          style={{ borderBottom: di < dataTypes.length - 1 ? `1px solid ${C.border}` : "none", opacity: checked ? 1 : 0.55 }}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => toggleDataType(a.key, dt.id, e.target.checked)} />
                          <span className="text-xs flex-1" style={{ color: C.ink }}>{dt.name}</span>
                          <ClassificationTag level={dt.sensitivity} />
                          <select
                            disabled={!checked}
                            value={a.dataTypes[dt.id] || "processes"}
                            onChange={(e) => setDataTypeRole(a.key, dt.id, e.target.value)}
                            className="text-[11px] rounded px-2 py-1"
                            style={{ ...inputStyle, width: 120 }}
                          >
                            {Object.keys(DATA_ROLE_META).map((r) => <option key={r} value={r}>{DATA_ROLE_META[r].label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={addAsset}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12.5px] font-semibold"
                style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg }}
              >
                <Plus size={14} /> Add another asset
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 4 of 4</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Review</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                This is the actual validator running against your entries — not a preview of it.
              </p>

              {checking && <div className="text-sm" style={{ color: C.muted }}>Checking…</div>}

              {!checking && dryRun && dryRun.problems.length === 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div>
                        <div className="text-lg font-bold" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>{dryRun.classification ?? "—"}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Classification</div>
                      </div>
                      {dryRun.classification && <ClassificationTag level={dryRun.classification} />}
                    </div>
                    <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div>
                        <div className="text-lg font-bold" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>{dryRun.assurance ?? "—"}%</div>
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Assurance</div>
                      </div>
                      {dryRun.assurance != null && <AssuranceBadge pct={dryRun.assurance} size={34} />}
                    </div>
                    <div className="rounded-xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-lg font-bold" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>
                        {dryRun.coverage ? `${dryRun.coverage.assessed} / ${dryRun.coverage.applicable}` : "—"}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Controls assessed (of applicable)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12.5px]" style={{ background: C.greenBg, color: C.green }}>
                    <Check size={16} className="shrink-0 mt-0.5" />
                    <div><b>Passes validation</b> — ready to create. This is exactly what will render in System Security Profile.</div>
                  </div>
                </>
              )}

              {!checking && dryRun && dryRun.problems.length > 0 && (
                <>
                  <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12.5px] mb-3.5" style={{ background: C.redBg, color: C.red }}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div><b>{dryRun.problems.length} problem{dryRun.problems.length === 1 ? "" : "s"} found</b> — fix these before this system can be created.</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dryRun.problems.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg pl-3 pr-3.5 py-2.5 text-xs leading-relaxed"
                        style={{ background: C.redBg, border: `1px solid ${C.border}`, borderLeftWidth: 3, borderLeftColor: C.red, color: C.ink }}
                      >
                        <AlertTriangle size={14} color={C.red} className="shrink-0 mt-0.5" />
                        <span className="flex-1">{p}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: C.panel2 }}>
        <span className="text-[11px] font-mono" style={{ color: C.muted }}>STEP {step} OF 4</span>
        <div className="flex gap-2.5">
          <button
            onClick={goBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
            style={{ border: `1px solid ${C.border}`, color: C.ink, opacity: step === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={step === 1 && !canAdvanceFrom1}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
              style={{ background: C.accent, color: "#fff", opacity: step === 1 && !canAdvanceFrom1 ? 0.4 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!dryRun || dryRun.problems.length > 0 || saving}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
              style={{ background: C.accent, color: "#fff", opacity: (!dryRun || dryRun.problems.length > 0 || saving) ? 0.4 : 1 }}
            >
              <Check size={14} /> Create System
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
