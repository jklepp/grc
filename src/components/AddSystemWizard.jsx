import React, { useEffect, useMemo, useState } from "react";
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
  SYSTEM_REGULATORY_CONTEXTS, IDENTITY_TYPES, NETWORK_EXPOSURES,
  engine as appEngine,
} from "../engine";
import { buildLiveEngine } from "../engine/liveGraph";
import { YAML_FACTS } from "../graph/sources/yaml";
import { loadRuntimeFacts, saveRuntimeFacts, nextSystemId, nextAssetId } from "../engine/runtimeFactsStore";

const STEPS = [
  { id: 1, title: "Basics", detail: "Purpose & ownership", icon: Info },
  { id: 2, title: "Technology", detail: "Hosting & exposure", icon: Gauge },
  { id: 3, title: "Data", detail: "What it processes", icon: Layers },
  { id: 4, title: "Assets", detail: "Where data lives", icon: Layers },
  { id: 5, title: "Derived Scope", detail: "What applies & why", icon: ClipboardCheck },
  { id: 6, title: "Launch", detail: "Start assessment", icon: Check },
];

function defaultAssessmentTarget() {
  return new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

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

function assetTypeForKind(kind) {
  return ASSET_TYPES.find((type) => ASSET_TYPE_CATEGORIES[type].includes(kind)) ?? ASSET_TYPES[0];
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
      confidentiality: { score: 50, reason: "" },
      integrity: { score: 50, reason: "" },
      availability: { score: 50, reason: "" },
      regulatory: { score: 50, reason: "" },
      businessDependency: { score: 50, reason: "" },
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
function TextInput({ className = "", style, ...props }) {
  return <input {...props} className={`w-full text-sm rounded-lg px-3 py-2 outline-none ${className}`} style={{ ...inputStyle, ...style }} />;
}
function TextArea(props) {
  return <textarea {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y" style={{ ...inputStyle, minHeight: 60 }} />;
}
function Select(props) {
  return <select {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />;
}

function ChoiceChip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors"
      style={{
        color: selected ? C.accent : C.ink,
        background: selected ? C.accentBg : C.panel2,
        border: `1px solid ${selected ? C.accent : C.border}`,
      }}
    >
      {selected && <Check size={12} className="inline mr-1.5 -mt-0.5" />}
      {children}
    </button>
  );
}

function ToggleCard({ checked, onChange, title, description, children }) {
  return (
    <div
      className="rounded-lg p-3 transition-colors"
      style={{ background: checked ? C.accentBg : C.panel2, border: `1px solid ${checked ? C.accent : C.border}` }}
    >
      <label className="flex gap-3 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="block text-[13px] font-semibold" style={{ color: checked ? C.accent : C.ink }}>{title}</span>
          <span className="block text-[10.5px] leading-4 mt-0.5" style={{ color: C.muted }}>{description}</span>
        </span>
      </label>
      {children && <div className="ml-6">{children}</div>}
    </div>
  );
}

function TechnologySection({ number, title, description, children }) {
  return (
    <section className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ color: C.accent, background: C.accentBg }}>
          {number}
        </div>
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: C.ink }}>{title}</h3>
          <p className="text-[10.5px] mt-0.5" style={{ color: C.muted }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AddSystemWizard({ open, onClose, onCreated, editingSystemId = null }) {
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
  const [systemDataTypeIds, setSystemDataTypeIds] = useState([]);
  const [dataSearch, setDataSearch] = useState("");
  const [internetFacing, setInternetFacing] = useState(false);
  const [usesAI, setUsesAI] = useState(false);
  const [autonomousActions, setAutonomousActions] = useState(false);
  const [regulatoryContext, setRegulatoryContext] = useState([]);
  const [identityTypes, setIdentityTypes] = useState([]);
  const [networkExposure, setNetworkExposure] = useState([]);
  const [hasThirdPartyIntegration, setHasThirdPartyIntegration] = useState(false);
  const [sdlcApplicable, setSdlcApplicable] = useState(false);
  const [ownerOrgId, setOwnerOrgId] = useState(ORGS[0]?.id ?? "");
  const [assessor, setAssessor] = useState("");
  const [assessmentTarget, setAssessmentTarget] = useState(defaultAssessmentTarget);

  const [assets, setAssets] = useState([blankAsset(0)]);

  const [dryRun, setDryRun] = useState(null); // { problems, systemId, classification, assurance, coverage }
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const providers = useMemo(() => eligibleProviders(hostingType), [hostingType]);
  const dataTypes = useMemo(() => getAllDataTypes(), []);
  const filteredDataTypes = useMemo(() => {
    const query = dataSearch.trim().toLowerCase();
    if (!query) return dataTypes;
    return dataTypes.filter((dt) => [dt.name, dt.kind, dt.description, ...dt.regulatoryFlags]
      .some((value) => value.toLowerCase().includes(query)));
  }, [dataSearch, dataTypes]);
  const mappedDataTypeIds = useMemo(
    () => new Set(assets.flatMap((a) => Object.keys(a.dataTypes))),
    [assets]
  );
  const unmappedSystemDataTypeIds = systemDataTypeIds.filter((id) => !mappedDataTypeIds.has(id));

  useEffect(() => {
    if (!open || !editingSystemId) return;
    const source = appEngine.graph.systemById[editingSystemId];
    if (!source) return;
    const sourceAssets = appEngine.graph.assetsBySystem[editingSystemId] ?? [];
    const sourceDataTypeIds = appEngine.classification.dataTypesForSystem(editingSystemId).map((dt) => dt.id);
    const scope = appEngine.graph.assessmentScopeBySystem[editingSystemId];

    setStep(1);
    setName(source.name);
    setMission(source.mission);
    setBoundary(source.boundary);
    setHostingType(source.hostingType);
    setProvider(source.provider);
    setAvailabilityTier(source.availabilityTier);
    setUserCount(source.userCount);
    setRegions([...source.regions]);
    setSubjects([...source.dataProfile.subjects]);
    setApproxRecords(source.dataProfile.approxRecords);
    setRetention(source.dataProfile.retention);
    setResidency(source.dataProfile.residency[0] ?? RESIDENCY_OPTIONS[0]);
    setSystemDataTypeIds(sourceDataTypeIds);
    setDataSearch("");
    setInternetFacing(source.internetFacing);
    setUsesAI(source.aiUsage.usesAI);
    setAutonomousActions(source.aiUsage.autonomousActions);
    setRegulatoryContext([...source.regulatoryContext]);
    setIdentityTypes([...source.onboardingProfile.identityTypes]);
    setNetworkExposure([...source.onboardingProfile.networkExposure]);
    setHasThirdPartyIntegration(source.onboardingProfile.hasThirdPartyIntegration);
    setSdlcApplicable(source.onboardingProfile.sdlcApplicable);
    setOwnerOrgId(source.roles.find((role) => role.role === "System Owner")?.ownerId ?? ORGS[0]?.id ?? "");
    setAssessor(scope?.assessor ?? "");
    setAssessmentTarget(scope?.periodEnd ?? defaultAssessmentTarget());
    setAssets(sourceAssets.map((asset) => ({
      key: asset.id,
      id: asset.id,
      name: asset.name,
      assetType: assetTypeForKind(asset.kind),
      sourceType: asset.type,
      sourceKind: asset.kind,
      kind: asset.kind,
      provider: asset.provider,
      criticalityFactors: structuredClone(asset.criticalityFactors),
      inherentLikelihood: asset.inherentLikelihood,
      dataTypes: Object.fromEntries(appEngine.classification.dataForAsset(asset.id).map((holding) => [holding.dataTypeId, holding.role])),
    })));
    setDryRun(null);
  }, [editingSystemId, open]);

  function reset() {
    setStep(1); setHostingType("cloud"); setProvider(""); setName(""); setMission(""); setBoundary("");
    setAvailabilityTier(AVAILABILITY_TIERS[1]); setUserCount(0); setRegions([]); setSubjects([]);
    setApproxRecords(0); setRetention(RETENTION_OPTIONS[0]); setResidency(RESIDENCY_OPTIONS[0]);
    setSystemDataTypeIds([]); setDataSearch(""); setInternetFacing(false);
    setUsesAI(false); setAutonomousActions(false); setRegulatoryContext([]);
    setIdentityTypes([]); setNetworkExposure([]); setHasThirdPartyIntegration(false); setSdlcApplicable(false);
    setOwnerOrgId(ORGS[0]?.id ?? ""); setAssessor(""); setAssessmentTarget(defaultAssessmentTarget());
    setAssets([blankAsset(0)]); setDryRun(null);
  }

  function close() { reset(); onClose(); }

  function updateAsset(key, patch) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  function updateAssetType(key, assetType) {
    setAssets((prev) => prev.map((a) => (a.key === key
      ? { ...a, assetType, kind: ASSET_TYPE_CATEGORIES[assetType][0], sourceType: null, sourceKind: null }
      : a)));
  }
  function updateCrit(key, factor, patch) {
    setAssets((prev) => prev.map((a) => (a.key === key
      ? { ...a, criticalityFactors: { ...a.criticalityFactors, [factor]: { ...a.criticalityFactors[factor], ...patch } } }
      : a)));
  }
  function toggleSystemDataType(dataTypeId) {
    if (systemDataTypeIds.includes(dataTypeId)) {
      setSystemDataTypeIds((prev) => prev.filter((id) => id !== dataTypeId));
      setAssets((current) => current.map((a) => {
        const next = { ...a.dataTypes };
        delete next[dataTypeId];
        return { ...a, dataTypes: next };
      }));
      return;
    }
    setSystemDataTypeIds((prev) => [...prev, dataTypeId]);
  }
  function addAssetDataType(key, dataTypeId) {
    if (!dataTypeId) return;
    setAssets((prev) => prev.map((a) => {
      if (a.key !== key) return a;
      return { ...a, dataTypes: { ...a.dataTypes, [dataTypeId]: a.dataTypes[dataTypeId] || "processes" } };
    }));
  }
  function removeAssetDataType(key, dataTypeId) {
    setAssets((prev) => prev.map((a) => {
      if (a.key !== key) return a;
      const next = { ...a.dataTypes };
      delete next[dataTypeId];
      return { ...a, dataTypes: next };
    }));
  }
  function setDataTypeRole(key, dataTypeId, role) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, dataTypes: { ...a.dataTypes, [dataTypeId]: role } } : a)));
  }
  function addAsset() { setAssets((prev) => [...prev, blankAsset(prev.length)]); }
  function removeAsset(key) { setAssets((prev) => (prev.length > 1 ? prev.filter((a) => a.key !== key) : prev)); }

  // Builds an upsert candidate for either a new or existing system. Nothing is
  // wired into the real store until the complete graph validates.
  function buildCandidateRuntimeFacts() {
    const existing = loadRuntimeFacts();
    const systemId = editingSystemId ?? nextSystemId(existing);
    const sourceSystem = editingSystemId ? appEngine.graph.systemById[editingSystemId] : null;
    const sourceScope = editingSystemId ? appEngine.graph.assessmentScopeBySystem[editingSystemId] : null;
    const today = new Date().toISOString().slice(0, 10);
    const ownerRole = ownerOrgId ? [{ role: "System Owner", ownerId: ownerOrgId }] : [];

    const system = {
      id: systemId,
      name: name.trim() || "Untitled system",
      env: `${provider || "Unknown provider"} (${hostingType})`,
      hostingType,
      provider,
      standards: [...new Set([
        ...(sourceSystem?.standards ?? []),
        ...PROVIDER_CERTIFICATIONS.filter((c) => c.provider === provider).map((c) => c.standard),
      ])],
      mission: mission.trim(),
      boundary: boundary.trim(),
      connections: sourceSystem ? [...sourceSystem.connections] : [],
      roles: [...(sourceSystem?.roles.filter((role) => role.role !== "System Owner") ?? []), ...ownerRole],
      syncSource: sourceSystem?.syncSource ?? "manual",
      lastSynced: "just now",
      oktaEnforced: sourceSystem?.oktaEnforced ?? "compliant",
      mfaEnforced: sourceSystem?.mfaEnforced ?? "compliant",
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
      aiUsage: { usesAI, autonomousActions: usesAI && autonomousActions },
      regulatoryContext,
      onboardingProfile: { identityTypes, networkExposure, hasThirdPartyIntegration, sdlcApplicable },
    };

    const usedAssetIds = new Set(assets.map((a) => a.id).filter(Boolean));
    let nextAssetIndex = 0;
    function assetIdForDraft(asset) {
      if (asset.id) return asset.id;
      let candidate;
      do {
        candidate = nextAssetId(systemId, nextAssetIndex);
        nextAssetIndex += 1;
      } while (usedAssetIds.has(candidate));
      usedAssetIds.add(candidate);
      return candidate;
    }
    const newAssets = assets.map((a, i) => ({
      id: assetIdForDraft(a),
      systemId,
      name: a.name.trim() || `Asset ${i + 1}`,
      type: a.sourceType && a.kind === a.sourceKind ? a.sourceType : a.assetType,
      kind: a.kind,
      provider: a.provider.trim() || provider,
      code: `A${i + 1}`,
      criticalityFactors: a.criticalityFactors,
      inherentLikelihood: Number(a.inherentLikelihood) || 1,
    }));

    const newAssetDataTypes = assets.flatMap((a, i) =>
      Object.entries(a.dataTypes).map(([dataTypeId, role]) => ({
        assetId: newAssets[i].id, dataTypeId, role,
      }))
    );

    const assessmentScope = {
      systemId,
      engagement: sourceScope?.engagement ?? `Onboarding — ${system.name}`,
      assessor: assessor.trim() || "Unassigned",
      periodStart: sourceScope?.periodStart ?? today,
      periodEnd: assessmentTarget,
      samplingRationale: sourceScope?.samplingRationale ??
        "New system, not yet subject to a dedicated assessment engagement — controls are assessed only where the hosting provider's own certification already covers them.",
      controlIds: sourceScope ? [...sourceScope.controlIds] : [],
    };

    const replacedAssetIds = new Set([
      ...(appEngine.graph.assetsBySystem[systemId] ?? []).map((a) => a.id),
      ...existing.assets.filter((a) => a.systemId === systemId).map((a) => a.id),
      ...newAssets.map((a) => a.id),
    ]);
    const expectedClassification = { ...existing.expectedClassification };
    delete expectedClassification[systemId];

    const runtime = {
      systems: [...existing.systems.filter((s) => s.id !== systemId), system],
      assets: [...existing.assets.filter((a) => a.systemId !== systemId), ...newAssets],
      assetDataTypes: [...existing.assetDataTypes.filter((edge) => !replacedAssetIds.has(edge.assetId)), ...newAssetDataTypes],
      assessmentScopes: [...existing.assessmentScopes.filter((scope) => scope.systemId !== systemId), assessmentScope],
      expectedClassification,
      // This wizard only ever adds a system — it never evaluates a control —
      // so these three just carry forward whatever runtimeMutations.ts has
      // already recorded for earlier systems, unchanged.
      implementationMechanisms: [...existing.implementationMechanisms],
      evidence: [...existing.evidence],
      notImplemented: [...existing.notImplemented],
      prismaOverrides: [...existing.prismaOverrides],
      findings: [...existing.findings],
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
    const applicability = engine.compliance.controlApplicabilitySummary(systemId);
    setDryRun({
      problems: [],
      systemId,
      classification: rollup?.classification ?? null,
      assurance: rollup?.overallAssurance ?? null,
      coverage: rollup?.coverage ?? null,
      applicability,
    });
    setChecking(false);
  }

  function goNext() {
    if (step === 4) { runDryRun(); setStep(5); return; }
    if (step < 6) setStep(step + 1);
  }
  function goBack() { if (step > 1) setStep(step - 1); }
  function jumpTo(n) {
    if (n < step) { setStep(n); return; }
    if (n === 2 && canAdvanceFrom1) { setStep(2); return; }
    if (n === 3 && canAdvanceFrom1 && canAdvanceFrom2) { setStep(3); return; }
    if (n === 4 && canAdvanceFrom1 && canAdvanceFrom2 && canAdvanceFrom3) { setStep(4); return; }
    if (n === 5 && canAdvanceFrom4) { runDryRun(); setStep(5); return; }
    if (n === 6 && dryRun && dryRun.problems.length === 0) setStep(6);
  }

  function handleCreate() {
    if (!dryRun || dryRun.problems.length > 0 || !canLaunch) return;
    setSaving(true);
    const { runtime } = buildCandidateRuntimeFacts();
    const { engine, problems } = buildLiveEngine(YAML_FACTS, runtime);
    if (!engine) {
      setDryRun((current) => ({ ...(current ?? {}), problems }));
      setSaving(false);
      setStep(5);
      return;
    }
    saveRuntimeFacts(runtime);
    setSaving(false);
    onCreated?.();
    window.location.reload();
  }

  const canAdvanceFrom1 = name.trim() && boundary.trim() && mission.trim() && ownerOrgId;
  const canAdvanceFrom2 = Boolean(provider && regions.length > 0);
  const canAdvanceFrom3 = systemDataTypeIds.length > 0;
  const canAdvanceFrom4 = assets.every((a) => Object.keys(a.dataTypes).length > 0) && unmappedSystemDataTypeIds.length === 0;
  const canLaunch = Boolean(assessor.trim() && assessmentTarget);
  const nextDisabled =
    (step === 1 && !canAdvanceFrom1) ||
    (step === 2 && !canAdvanceFrom2) ||
    (step === 3 && !canAdvanceFrom3) ||
    (step === 4 && !canAdvanceFrom4) ||
    (step === 5 && (!dryRun || dryRun.problems.length > 0));

  return (
    <Modal open={open} onClose={close} width={960} height={700}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
            <ClipboardCheck size={19} color={C.accent} />
            {editingSystemId ? "Edit System" : "Add System"}
          </h1>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {editingSystemId
              ? "Update declared facts; classification, scope, and assurance will be recalculated before anything is saved."
              : "New systems are assessed the same way as every existing one — nothing here is scored by hand."}
          </div>
        </div>
        <ModalCloseButton onClose={close} />
      </div>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "188px 1fr" }}>
        {/* ---- Step rail ---- */}
        <nav className="p-3 overflow-y-auto" style={{ borderRight: `1px solid ${C.border}`, background: C.panel2 }}>
          {STEPS.map((s, i) => {
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
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 1 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>System basics</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Core facts about the system. Its classification, assurance and PRISMA level are never entered here — they're
                computed from the technology, data and assets you add later.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="System name" span2><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Analytics Data Lake" /></Field>
                <Field label="Mission" span2><TextArea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="What does this system do, and for whom?" /></Field>
                <Field label="Boundary" span2><TextArea value={boundary} onChange={(e) => setBoundary(e.target.value)} placeholder="What's inside this boundary, and what isn't?" /></Field>

                <Field label="System owner">
                  <Select value={ownerOrgId} onChange={(e) => setOwnerOrgId(e.target.value)}>
                    {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
                <Field label="Availability tier">
                  <Select value={availabilityTier} onChange={(e) => setAvailabilityTier(e.target.value)}>
                    {AVAILABILITY_TIERS.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
                  </Select>
                </Field>
                <Field label="Users" note="Approximate active population for this boundary.">
                  <TextInput type="number" min={0} value={userCount} onChange={(e) => setUserCount(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 2 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Technology & exposure</h2>
              <p className="text-xs mb-5 max-w-[64ch]" style={{ color: C.muted }}>
                Capture the system's operating environment. Your choices determine which controls apply and which ones may be inherited from a provider.
              </p>

              <div className="space-y-4">
                <TechnologySection number="1" title="Choose the hosting environment" description="Start with where the system runs, then select its provider and deployment region.">
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
                            {disabled ? "Not configured" : `${eligibleProviders(h).length} eligible provider${eligibleProviders(h).length === 1 ? "" : "s"}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Field label="Provider" note="Limited to providers with qualifying assurance on file.">
                      <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                        <option value="">Select a provider…</option>
                        {providers.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Deployment regions" note="Select every region in this system boundary.">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {CLOUD_REGIONS.map((r) => (
                          <ChoiceChip
                            key={r}
                            selected={regions.includes(r)}
                            onClick={() => setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
                          >
                            <span className="font-mono normal-case">{r}</span>
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                  </div>
                  {!canAdvanceFrom2 && (
                    <div className="flex items-center gap-2 text-[10.5px] mt-3" style={{ color: C.muted }}>
                      <Info size={13} /> Select a provider and at least one deployment region to continue.
                    </div>
                  )}
                </TechnologySection>

                <TechnologySection number="2" title="Describe access and exposure" description="Choose every identity and network path that can reach the system.">
                  <ToggleCard
                    checked={internetFacing}
                    onChange={setInternetFacing}
                    title="Publicly reachable"
                    description="The system, an endpoint, or a login surface is reachable from the open internet."
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Field label="Identity types" note="Who or what can authenticate to this boundary.">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {IDENTITY_TYPES.map((t) => (
                          <ChoiceChip
                            key={t}
                            selected={identityTypes.includes(t)}
                            onClick={() => setIdentityTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                          >
                            {t.replace(/-/g, " ")}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Network paths" note="How traffic reaches or leaves the system.">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {NETWORK_EXPOSURES.map((n) => (
                          <ChoiceChip
                            key={n}
                            selected={networkExposure.includes(n)}
                            onClick={() => setNetworkExposure((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                          >
                            {n.replace(/-/g, " ")}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                  </div>
                </TechnologySection>

                <TechnologySection number="3" title="Flag operational characteristics" description="These choices add targeted vendor, development, AI, and regulatory requirements.">
                  <div className="grid grid-cols-3 gap-3">
                    <ToggleCard
                      checked={hasThirdPartyIntegration}
                      onChange={setHasThirdPartyIntegration}
                      title="Third-party integration"
                      description="Exchanges data with or depends on another organization."
                    />
                    <ToggleCard
                      checked={sdlcApplicable}
                      onChange={setSdlcApplicable}
                      title="Custom software"
                      description="ACME develops or maintains code within this boundary."
                    />
                    <ToggleCard
                      checked={usesAI}
                      onChange={(checked) => { setUsesAI(checked); if (!checked) setAutonomousActions(false); }}
                      title="AI usage"
                      description="Contains or calls a model, agent, or RAG pipeline."
                    >
                    {usesAI && (
                      <label className="flex items-start gap-1.5 text-[10.5px] mt-2" style={{ color: C.ink }}>
                        <input type="checkbox" checked={autonomousActions} onChange={(e) => setAutonomousActions(e.target.checked)} />
                        Can act without human approval
                      </label>
                    )}
                    </ToggleCard>
                  </div>
                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <Field label="Regulatory context" note="Select business obligations that apply beyond the data profile captured on the next page.">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {SYSTEM_REGULATORY_CONTEXTS.map((r) => (
                          <ChoiceChip
                            key={r}
                            selected={regulatoryContext.includes(r)}
                            onClick={() => setRegulatoryContext((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
                          >
                            {r.replace(/-/g, " ")}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                  </div>
                </TechnologySection>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 6 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Launch assessment</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Assign the assessment and set its target date. {editingSystemId ? "Saving recalculates the system's scope without changing its recorded evidence." : "Creating the system launches an honest initial scope; controls remain unassessed until evidence or a supported inheritance actually evaluates them."}
              </p>

              <div className="rounded-xl p-4 mb-5 flex gap-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <Gauge size={18} color={C.accent} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: C.ink }}>Initial assessment plan</div>
                  <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
                    Controls in {provider || "the chosen provider"}'s certified domains are assessed automatically from its own
                    reports. No dedicated engagement is scoped yet — no controls are hand-marked satisfied.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-[72ch]">
                <Field label="Assessor of record" note="The person accountable for reviewing the evidence and recording the assessment.">
                  <TextInput value={assessor} onChange={(e) => setAssessor(e.target.value)} placeholder="e.g. J. Ortiz — Security Engineering" />
                </Field>
                <Field label="Target completion" note="The assessment period ends on this date.">
                  <TextInput type="date" value={assessmentTarget} onChange={(e) => setAssessmentTarget(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 3 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>System data inventory</h2>
              <p className="text-xs mb-5 max-w-[64ch]" style={{ color: C.muted }}>
                Identify every type of data this system stores, transmits, or processes. You will map these data types to individual assets next.
              </p>

              <div className="rounded-xl p-4 mb-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <div className="text-[13px] font-semibold mb-3" style={{ color: C.ink }}>Boundary data profile</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data subjects" span2>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {DATA_SUBJECT_TYPES.map((s) => (
                        <ChoiceChip
                          key={s}
                          selected={subjects.includes(s)}
                          onClick={() => setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                        >
                          {s.replace("-", " ")}
                        </ChoiceChip>
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

              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between gap-4 p-4" style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: C.ink }}>Data types processed</div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: C.muted }}>
                      {systemDataTypeIds.length} selected · choose all that apply to the system boundary
                    </div>
                  </div>
                  <TextInput
                    value={dataSearch}
                    onChange={(e) => setDataSearch(e.target.value)}
                    placeholder="Search data types…"
                    aria-label="Search data types"
                    style={{ width: 240 }}
                  />
                </div>
                <div>
                  {filteredDataTypes.map((dt, index) => {
                    const selected = systemDataTypeIds.includes(dt.id);
                    return (
                      <label
                        key={dt.id}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                        style={{
                          background: selected ? C.accentBg : C.panel,
                          borderBottom: index < filteredDataTypes.length - 1 ? `1px solid ${C.border}` : "none",
                        }}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggleSystemDataType(dt.id)} className="mt-1" />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-[12.5px] font-semibold" style={{ color: C.ink }}>{dt.name}</span>
                            <span className="text-[10px] font-mono capitalize" style={{ color: C.muted }}>{dt.kind.replace(/-/g, " ")}</span>
                          </span>
                          <span className="block text-[10.5px] mt-0.5" style={{ color: C.muted }}>{dt.description}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {dt.regulatoryFlags.slice(0, 2).map((flag) => (
                            <span key={flag} className="text-[9.5px] font-mono" style={{ color: C.muted }}>{flag}</span>
                          ))}
                          <ClassificationTag level={dt.sensitivity} />
                        </span>
                      </label>
                    );
                  })}
                  {filteredDataTypes.length === 0 && (
                    <div className="text-xs text-center py-8" style={{ color: C.muted }}>No data types match that search.</div>
                  )}
                </div>
              </div>
              {!canAdvanceFrom3 && (
                <div className="flex items-center gap-2 text-[10.5px] mt-3" style={{ color: C.muted }}>
                  <Info size={13} /> Select at least one data type to continue.
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 4 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Assets & data mapping</h2>
              <p className="text-xs mb-5 max-w-[64ch]" style={{ color: C.muted }}>
                Add the assets inside this boundary and map only the system data types each asset stores, transmits, or processes.
              </p>

              {unmappedSystemDataTypeIds.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[11.5px] mb-4" style={{ background: C.accentBg, color: C.ink }}>
                  <Info size={15} color={C.accent} className="shrink-0 mt-0.5" />
                  <div>
                    <b>{unmappedSystemDataTypeIds.length} data type{unmappedSystemDataTypeIds.length === 1 ? " still needs" : "s still need"} an asset.</b>
                    <span style={{ color: C.muted }}> Use each asset's “Add data type” menu to identify where that data is stored, processed, or transmitted.</span>
                  </div>
                </div>
              )}

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
                      <Select value={a.kind} onChange={(e) => updateAsset(a.key, { kind: e.target.value, sourceType: null, sourceKind: null })}>
                        {ASSET_TYPE_CATEGORIES[a.assetType].map((k) => <option key={k} value={k}>{k.replace(/-/g, " ")}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <div className="text-[10px] uppercase tracking-wide font-mono mb-2" style={{ color: C.muted }}>Criticality</div>
                  <div className="grid gap-2 mb-1" style={{ gridTemplateColumns: "128px 86px 1fr" }}>
                    {CRIT_FACTORS.map(([key, label]) => (
                      <React.Fragment key={key}>
                        <div className="text-xs flex items-center" style={{ color: C.ink }}>{label}</div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          aria-label={`${label} criticality score`}
                          value={a.criticalityFactors[key].score}
                          onChange={(e) => updateCrit(a.key, key, { score: Number(e.target.value) })}
                          className="text-xs rounded px-2 py-1 outline-none"
                          style={inputStyle}
                        />
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

                  <div className="flex items-end justify-between gap-4 mt-4 mb-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide font-mono" style={{ color: C.muted }}>Data processed by this asset</div>
                      <div className="text-[10.5px] mt-0.5" style={{ color: C.muted }}>Add from the system inventory selected on the previous step.</div>
                    </div>
                    <select
                      value=""
                      onChange={(e) => addAssetDataType(a.key, e.target.value)}
                      className="text-[11px] rounded-lg px-2.5 py-2"
                      style={{ ...inputStyle, width: 210 }}
                      aria-label={`Add data type to ${a.name || `Asset ${i + 1}`}`}
                    >
                      <option value="">+ Add data type…</option>
                      {systemDataTypeIds
                        .filter((id) => !Object.hasOwn(a.dataTypes, id))
                        .map((id) => dataTypes.find((dt) => dt.id === id))
                        .filter(Boolean)
                        .map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                    </select>
                  </div>
                  {Object.keys(a.dataTypes).length > 0 ? (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                      {Object.entries(a.dataTypes).map(([dataTypeId, role], di, entries) => {
                        const dt = dataTypes.find((item) => item.id === dataTypeId);
                        if (!dt) return null;
                        return (
                        <div
                          key={dataTypeId}
                          className="flex items-center gap-2.5 px-3 py-2"
                          style={{ borderBottom: di < entries.length - 1 ? `1px solid ${C.border}` : "none", background: C.panel }}
                        >
                          <span className="text-xs flex-1" style={{ color: C.ink }}>{dt.name}</span>
                          <ClassificationTag level={dt.sensitivity} />
                          <select
                            value={role}
                            onChange={(e) => setDataTypeRole(a.key, dataTypeId, e.target.value)}
                            className="text-[11px] rounded px-2 py-1"
                            style={{ ...inputStyle, width: 120 }}
                          >
                            {Object.keys(DATA_ROLE_META).map((r) => <option key={r} value={r}>{DATA_ROLE_META[r].label}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeAssetDataType(a.key, dataTypeId)}
                            aria-label={`Remove ${dt.name} from ${a.name || `Asset ${i + 1}`}`}
                            className="p-1 rounded"
                            style={{ color: C.muted }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg px-3 py-3 text-[11px]" style={{ border: `1px dashed ${C.border}`, color: C.muted }}>
                      No data types mapped to this asset yet.
                    </div>
                  )}
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

          {step === 5 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 5 of 6</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Derived scope</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                This is the live engine resolving classification, applicability, responsibility and initial coverage from your entries.
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
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Initial inherited assurance</div>
                      </div>
                      {dryRun.assurance != null && <AssuranceBadge pct={dryRun.assurance} size={34} />}
                    </div>
                    <div className="rounded-xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-lg font-bold" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>
                        {dryRun.coverage ? `${dryRun.coverage.assessed} / ${dryRun.coverage.applicable}` : "—"}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Controls initially assessed</div>
                    </div>
                  </div>
                  {dryRun.applicability && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: C.ink }}>{dryRun.applicability.applicable} applicable controls</div>
                          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                            Derived from framework scope, assets, exposure and declared operating characteristics.
                          </div>
                        </div>
                        <div className="text-[11px]" style={{ color: C.muted }}>
                          {dryRun.applicability.pending} pending applicability review
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          ["System owned", dryRun.applicability.byResponsibility.owned],
                          ["Shared", dryRun.applicability.byResponsibility.shared],
                          ["Enterprise", dryRun.applicability.byResponsibility.enterprise],
                          ["Vendor", dryRun.applicability.byResponsibility.vendor],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: C.panel }}>
                            <div className="text-lg font-bold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
                            <div className="text-[10.5px]" style={{ color: C.muted }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12.5px]" style={{ background: C.greenBg, color: C.green }}>
                    <Check size={16} className="shrink-0 mt-0.5" />
                    <div><b>Derived scope validated.</b> Continue to assign the assessment and set its target date.</div>
                  </div>
                </>
              )}

              {!checking && dryRun && dryRun.problems.length > 0 && (
                <>
                  <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12.5px] mb-3.5" style={{ background: C.redBg, color: C.red }}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div><b>{dryRun.problems.length} problem{dryRun.problems.length === 1 ? "" : "s"} found</b> — fix these before this system can be {editingSystemId ? "saved" : "created"}.</div>
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
        <span className="text-[11px] font-mono" style={{ color: C.muted }}>STEP {step} OF 6</span>
        <div className="flex gap-2.5">
          <button
            onClick={goBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
            style={{ border: `1px solid ${C.border}`, color: C.ink, opacity: step === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < 6 ? (
            <button
              onClick={goNext}
              disabled={nextDisabled}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
              style={{ background: C.accent, color: "#fff", opacity: nextDisabled ? 0.4 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!dryRun || dryRun.problems.length > 0 || !canLaunch || saving}
              className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
              style={{ background: C.accent, color: "#fff", opacity: (!dryRun || dryRun.problems.length > 0 || !canLaunch || saving) ? 0.4 : 1 }}
            >
              <Check size={14} /> {editingSystemId ? "Save Changes" : "Create System"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
