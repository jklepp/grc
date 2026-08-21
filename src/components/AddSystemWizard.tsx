import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
  Info, Gauge, Layers, ClipboardCheck, Check, AlertTriangle, Plus, Trash2, ChevronLeft, ChevronRight, Network, Users, Bot,
} from "lucide-react";
import { C } from "../theme";
import Modal, { ModalCloseButton } from "./Modal";
import { ClassificationTag, AssuranceBadge } from "./SystemBadges";
import {
  ORGS, VENDORS, PROVIDER_CERTIFICATIONS, HOSTING_TYPES, INHERITED_DOMAINS,
  AVAILABILITY_TIERS, DATA_SUBJECT_TYPES, ASSET_TYPE_CATEGORIES, ASSET_TYPES,
  DATA_ROLE_META, getAllDataTypes, CLOUD_REGIONS, RETENTION_OPTIONS, RESIDENCY_OPTIONS,
  SYSTEM_REGULATORY_CONTEXTS, IDENTITY_TYPES, NETWORK_EXPOSURES,
  IMPACT_LEVELS, IMPACT_LEVEL_LABELS, SECURITY_OBJECTIVES, SECURITY_OBJECTIVE_LABELS,
  defaultSecurityCategory, overallImpactLevel,
  engine as appEngine, commitRuntimeFacts,
} from "../engine";
import { buildLiveEngine } from "../engine/liveGraph";
import type { RuntimeFacts } from "../engine/liveGraph";
import { YAML_FACTS } from "../graph/sources/yaml";
import { loadRuntimeFacts, nextSystemId, nextAssetId, nextActorId, nextActorAccessId, nextDataFlowId, nextAgenticIdentityId } from "../engine/runtimeFactsStore";
import type { ActorId, AssetId, DataTypeId, OrgId, SystemId } from "../graph/ids";
import type { Asset, AssetKind, ImpactLevel } from "../graph/nodes/assets";
import type { AssetDataType, DataRole } from "../graph/edges/assetDataTypes";
import { DATA_ROLES } from "../graph/edges/assetDataTypes";
import type { IdentityType } from "../graph/nodes/identity";
import type {
  AvailabilityTier, DataSubjectType, HostingType, NetworkExposure, SecurityCategory, SecurityObjective, System, SystemRegulatoryContext,
} from "../graph/nodes/systems";
import type { ClassificationTier } from "../graph/nodes/taxonomy";
import type { AssessmentScope } from "../graph/nodes/assessmentScope";
import { ACTOR_KINDS, type Actor, type ActorKind } from "../graph/nodes/actors";
import { ACTOR_DIRECTIONS, type ActorAccess, type ActorDirection } from "../graph/edges/actorAccess";
import { FLOW_KINDS, type DataFlow, type FlowKind } from "../graph/edges/dataFlows";
import {
  AGENT_AUTONOMY_LEVELS, AGENT_CREDENTIAL_TYPES, AGENT_PRIVILEGE_LEVELS, AGENT_REVOCATION_MECHANISMS,
  type AgentAutonomyLevel, type AgentCredentialType, type AgenticIdentity, type AgentPrivilegeLevel, type AgentRevocationMechanism,
} from "../graph/nodes/agenticIdentities";

const STEPS = [
  { id: 1, title: "Basics", detail: "Purpose & ownership", icon: Info },
  { id: 2, title: "Technology", detail: "Hosting & exposure", icon: Gauge },
  { id: 3, title: "Data", detail: "What it processes", icon: Layers },
  { id: 4, title: "Assets", detail: "Where data lives", icon: Layers },
  { id: 5, title: "Architecture", detail: "Actors, flows & agents", icon: Network },
  { id: 6, title: "Derived Scope", detail: "What applies & why", icon: ClipboardCheck },
  { id: 7, title: "Launch", detail: "Start assessment", icon: Check },
] as const;
type WizardStep = (typeof STEPS)[number]["id"];
type AssetType = string;

interface AssetDraft {
  key: string;
  added: boolean;
  saved: boolean;
  expanded: boolean;
  id?: AssetId;
  name: string;
  assetType: AssetType;
  kind: AssetKind;
  provider: string;
  impactLevel: ImpactLevel;
  inherentLikelihood: number | string;
  dataTypes: Record<string, DataRole>;
  sourceType?: string | null;
  sourceKind?: AssetKind | null;
}

interface ActorDraft {
  key: string;
  added: boolean;
  saved: boolean;
  expanded: boolean;
  actorId?: ActorId;
  accessId?: string;
  name: string;
  kind: ActorKind;
  description: string;
  assetKey: string;
  direction: ActorDirection;
  note: string;
}

interface FlowDraft {
  key: string;
  added: boolean;
  saved: boolean;
  expanded: boolean;
  id?: string;
  fromKey: string;
  toKey: string;
  kind: FlowKind;
  dataTypeIds: DataTypeId[];
  note: string;
}

interface AgentDraft {
  key: string;
  added: boolean;
  saved: boolean;
  expanded: boolean;
  id?: string;
  name: string;
  purpose: string;
  ownerOrgId: OrgId | "";
  servicePrincipal: string;
  autonomyLevel: AgentAutonomyLevel;
  externalActions: boolean;
  canImpersonateUser: boolean;
  privilegeLevel: AgentPrivilegeLevel;
  credentialType: AgentCredentialType;
  loggingEnabled: boolean;
  revocationMechanism: AgentRevocationMechanism;
  tools: string;
}

function draftKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankActor(assetKey = ""): ActorDraft {
  return {
    key: draftKey("actor"), added: false, saved: false, expanded: true, name: "", kind: ACTOR_KINDS.HUMAN,
    description: "", assetKey, direction: ACTOR_DIRECTIONS.INBOUND, note: "",
  };
}

function blankFlow(fromKey = "", toKey = "", dataTypeIds: DataTypeId[] = []): FlowDraft {
  return {
    key: draftKey("flow"), added: false, saved: false, expanded: true, fromKey, toKey, kind: FLOW_KINDS.DATA,
    dataTypeIds, note: "",
  };
}

function blankAgent(ownerOrgId: OrgId | "" = ""): AgentDraft {
  return {
    key: draftKey("agent"), added: false, saved: false, expanded: true, name: "", purpose: "", ownerOrgId,
    servicePrincipal: "", autonomyLevel: "approval-gated", externalActions: false, canImpersonateUser: false,
    privilegeLevel: "standard", credentialType: "workload-identity", loggingEnabled: true,
    revocationMechanism: "automated", tools: "",
  };
}

function assetDraftLabel(assets: AssetDraft[], key: string): string {
  const index = assets.findIndex((asset) => asset.key === key);
  if (index < 0) return "Unknown asset";
  return assets[index].name.trim() || `Asset ${index + 1}`;
}

function actorDraftIsValid(actor: ActorDraft): boolean {
  return Boolean(actor.name.trim() && actor.description.trim() && actor.assetKey);
}

function flowDraftIsValid(flow: FlowDraft): boolean {
  return Boolean(flow.fromKey && flow.toKey && flow.fromKey !== flow.toKey && flow.dataTypeIds.length > 0);
}

function agentDraftIsValid(agent: AgentDraft, autonomousActions: boolean): boolean {
  return Boolean(
    agent.name.trim() && agent.purpose.trim() && agent.servicePrincipal.trim() && agent.tools.trim()
    && (agent.autonomyLevel !== "autonomous" || autonomousActions)
    && (agent.autonomyLevel !== "recommend" || !agent.externalActions)
  );
}

function assetDraftIsValid(asset: AssetDraft): boolean {
  return Boolean(asset.name.trim() && Object.keys(asset.dataTypes).length > 0);
}

interface DryRunResult {
  problems: string[];
  systemId: SystemId | null;
  classification?: ClassificationTier | null;
  assurance?: number | null;
  coverage?: { applicable: number; assessed: number; assessedPct: number; inherited: number } | null;
  applicability?: ReturnType<typeof appEngine.compliance.controlApplicabilitySummary>;
  proposedWaves?: { notApplicable: number; vendorInherited: number; companyLevel: number; remainingTechnical: number };
  readinessLabel?: string;
}

function defaultAssessmentTarget(): string {
  return new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

// Providers eligible for a given hosting type: only ones whose certification
// coverage already spans every domain that hosting type inherits. Anything
// else would leave the system with zero assessed controls, which the
// validators treat as a build failure rather than a legitimate "just
// onboarded" state — see the plan doc / liveGraph.ts comment.
// A vendor whose certification happens to be a superset of a lighter hosting
// type's required domains (Workday's SaaS cert covers cloud's inherited domain)
// still isn't a real option for that hosting type — the vendor's own
// category has to match what the hosting type actually is.
const HOSTING_VENDOR_CATEGORY: Partial<Record<HostingType, string>> = { cloud: "cloud-infrastructure", saas: "saas" };

function eligibleProviders(hostingType: HostingType) {
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

function assetTypeForKind(kind: AssetKind): AssetType {
  return ASSET_TYPES.find((type) => ASSET_TYPE_CATEGORIES[type].includes(kind)) ?? ASSET_TYPES[0];
}

function blankAsset(index: number): AssetDraft {
  const assetType = ASSET_TYPES[0];
  return {
    key: `new-${index}-${Math.random().toString(36).slice(2, 8)}`,
    added: false,
    saved: false,
    expanded: true,
    name: "",
    assetType,
    kind: ASSET_TYPE_CATEGORIES[assetType][0],
    provider: "",
    impactLevel: "moderate",
    inherentLikelihood: 2,
    dataTypes: {}, // dataTypeId -> role ("" = not touched)
  };
}



function Field({ label, note, span2 = false, children }: { label: string; note?: string; span2?: boolean; children: ReactNode }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wide font-mono mb-1.5" style={{ color: C.muted }}>{label}</label>
      {children}
      {note && <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>{note}</div>}
    </div>
  );
}

const inputStyle: CSSProperties = { background: C.panel2, border: `1px solid ${C.border}`, color: C.ink };
function TextInput({ className = "", style, ...props }: ComponentProps<"input">) {
  return <input {...props} className={`w-full text-sm rounded-lg px-3 py-2 outline-none ${className}`} style={{ ...inputStyle, ...style }} />;
}
function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y" style={{ ...inputStyle, minHeight: 60 }} />;
}
function Select(props: ComponentProps<"select">) {
  return <select {...props} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />;
}

function ChoiceChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
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

function ToggleCard({ checked, onChange, title, description, children }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string; children?: ReactNode }) {
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

function TechnologySection({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
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

interface AddSystemWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (systemId: SystemId) => void;
  editingSystemId?: SystemId | null;
  // Pre-fills every field from this system (basics, technology, data, assets,
  // architecture) exactly like editingSystemId does, but always mints a brand
  // new SystemId and fresh asset/actor/flow/agent ids rather than reusing the
  // source's — so the result is an independent duplicate, not an in-place edit.
  // Ignored whenever editingSystemId is set.
  cloneFromSystemId?: SystemId | null;
}

export default function AddSystemWizard({ open, onClose, onCreated, editingSystemId = null, cloneFromSystemId = null }: AddSystemWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const contentPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentPaneRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  const [hostingType, setHostingType] = useState<HostingType>("cloud");
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [boundary, setBoundary] = useState("");
  const [availabilityTier, setAvailabilityTier] = useState<AvailabilityTier>(AVAILABILITY_TIERS[1]);
  const [securityCategory, setSecurityCategory] = useState<SecurityCategory>(defaultSecurityCategory);
  const [userCount, setUserCount] = useState<number | string>(0);
  const [regions, setRegions] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<DataSubjectType[]>([]);
  const [approxRecords, setApproxRecords] = useState<number | string>(0);
  const [retention, setRetention] = useState<string>(RETENTION_OPTIONS[0]);
  const [residency, setResidency] = useState<string>(RESIDENCY_OPTIONS[0]);
  const [systemDataTypeIds, setSystemDataTypeIds] = useState<DataTypeId[]>([]);
  const [dataSearch, setDataSearch] = useState("");
  const [internetFacing, setInternetFacing] = useState(false);
  const [usesAI, setUsesAI] = useState(false);
  const [autonomousActions, setAutonomousActions] = useState(false);
  const [regulatoryContext, setRegulatoryContext] = useState<SystemRegulatoryContext[]>([]);
  const [identityTypes, setIdentityTypes] = useState<IdentityType[]>([]);
  const [networkExposure, setNetworkExposure] = useState<NetworkExposure[]>([]);
  const [hasThirdPartyIntegration, setHasThirdPartyIntegration] = useState(false);
  const [sdlcApplicable, setSdlcApplicable] = useState(false);
  const [ownerOrgId, setOwnerOrgId] = useState<OrgId | "">(ORGS[0]?.id ?? "");
  const [assessor, setAssessor] = useState("");
  const [assessmentTarget, setAssessmentTarget] = useState(defaultAssessmentTarget);

  const [assets, setAssets] = useState<AssetDraft[]>([blankAsset(0)]);
  const [actorDrafts, setActorDrafts] = useState<ActorDraft[]>([]);
  const [flowDrafts, setFlowDrafts] = useState<FlowDraft[]>([]);
  const [agentDrafts, setAgentDrafts] = useState<AgentDraft[]>([]);

  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
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

  const isClone = !editingSystemId && Boolean(cloneFromSystemId);

  useEffect(() => {
    const sourceSystemId = editingSystemId ?? cloneFromSystemId;
    if (!open || !sourceSystemId) return;
    const source = appEngine.graph.systemById[sourceSystemId];
    if (!source) return;
    const sourceAssets = appEngine.graph.assetsBySystem[sourceSystemId] ?? [];
    const sourceDataTypeIds = appEngine.classification.dataTypesForSystem(sourceSystemId).map((dt) => dt.id);
    // A clone starts a fresh assessment engagement — the source's scope,
    // assessor, and target date don't carry over the way its facts do.
    const scope = editingSystemId ? appEngine.graph.assessmentScopeBySystem[sourceSystemId] : null;

    setStep(1);
    setName(isClone ? `${source.name} (Copy)` : source.name);
    setMission(source.mission);
    setBoundary(source.boundary);
    setHostingType(source.hostingType);
    setProvider(source.provider);
    setAvailabilityTier(source.availabilityTier);
    setSecurityCategory(structuredClone(source.securityCategory));
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
    // A clone's assets/actors/flows/agents carry every field forward but none
    // of the source's real ids — draftKey() mints a synthetic key instead, and
    // omitting id/actorId/accessId leaves buildCandidateRuntimeFacts to mint
    // real ones scoped to the new system, so the duplicate never shares a
    // fact with (or corrupts) the system it was copied from.
    const assetKeyByOriginalId = new Map<string, string>();
    setAssets(sourceAssets.map((asset) => {
      const key = isClone ? draftKey("asset") : asset.id;
      assetKeyByOriginalId.set(asset.id, key);
      return {
        key,
        added: true,
        saved: true,
        expanded: false,
        id: isClone ? undefined : asset.id,
        name: asset.name,
        assetType: assetTypeForKind(asset.kind),
        sourceType: isClone ? undefined : asset.type,
        sourceKind: isClone ? undefined : asset.kind,
        kind: asset.kind,
        provider: asset.provider,
        impactLevel: IMPACT_LEVELS.find((level) => level === asset.impactLevel) ?? "moderate",
        inherentLikelihood: asset.inherentLikelihood,
        dataTypes: Object.fromEntries(appEngine.classification.dataForAsset(asset.id).map((holding) => [holding.dataTypeId, holding.role])),
      };
    }));
    const sourceAssetIds = new Set(sourceAssets.map((asset) => asset.id));
    setActorDrafts(appEngine.graph.actorAccess
      .filter((access) => sourceAssetIds.has(access.assetId))
      .map((access) => {
        const actor = appEngine.graph.actorById[access.actorId];
        return {
          key: isClone ? draftKey("actor") : access.id,
          added: true, saved: true, expanded: false,
          actorId: isClone ? undefined : access.actorId,
          accessId: isClone ? undefined : access.id,
          name: actor?.name ?? access.actorId, kind: actor?.kind ?? ACTOR_KINDS.MACHINE,
          description: actor?.description ?? "External system actor",
          assetKey: (isClone ? assetKeyByOriginalId.get(access.assetId) : access.assetId) ?? access.assetId,
          direction: access.direction, note: access.note ?? "",
        };
      }));
    setFlowDrafts(appEngine.graph.dataFlows
      .filter((flow) => sourceAssetIds.has(flow.from) && sourceAssetIds.has(flow.to))
      .map((flow) => ({
        key: isClone ? draftKey("flow") : flow.id,
        added: true, saved: true, expanded: false,
        id: isClone ? undefined : flow.id,
        fromKey: (isClone ? assetKeyByOriginalId.get(flow.from) : flow.from) ?? flow.from,
        toKey: (isClone ? assetKeyByOriginalId.get(flow.to) : flow.to) ?? flow.to,
        kind: flow.kind, dataTypeIds: [...flow.dataTypeIds], note: flow.note ?? "",
      })));
    setAgentDrafts((appEngine.graph.agenticIdentitiesBySystem[sourceSystemId] ?? []).map((agent) => ({
      key: isClone ? draftKey("agent") : agent.id,
      added: true, saved: true, expanded: false,
      id: isClone ? undefined : agent.id,
      name: agent.name, purpose: agent.purpose,
      ownerOrgId: agent.ownerOrgId ?? "", servicePrincipal: agent.servicePrincipal,
      autonomyLevel: agent.autonomyLevel, externalActions: agent.externalActions,
      canImpersonateUser: agent.canImpersonateUser, privilegeLevel: agent.privilegeLevel,
      credentialType: agent.credentialType, loggingEnabled: agent.loggingEnabled,
      revocationMechanism: agent.revocationMechanism, tools: agent.tools.join(", "),
    })));
    setDryRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSystemId, cloneFromSystemId, open]);

  function reset() {
    setStep(1); setHostingType("cloud"); setProvider(""); setName(""); setMission(""); setBoundary("");
    setAvailabilityTier(AVAILABILITY_TIERS[1]); setSecurityCategory(defaultSecurityCategory()); setUserCount(0); setRegions([]); setSubjects([]);
    setApproxRecords(0); setRetention(RETENTION_OPTIONS[0]); setResidency(RESIDENCY_OPTIONS[0]);
    setSystemDataTypeIds([]); setDataSearch(""); setInternetFacing(false);
    setUsesAI(false); setAutonomousActions(false); setRegulatoryContext([]);
    setIdentityTypes([]); setNetworkExposure([]); setHasThirdPartyIntegration(false); setSdlcApplicable(false);
    setOwnerOrgId(ORGS[0]?.id ?? ""); setAssessor(""); setAssessmentTarget(defaultAssessmentTarget());
    setAssets([blankAsset(0)]); setActorDrafts([]); setFlowDrafts([]); setAgentDrafts([]); setDryRun(null);
  }

  function close() { reset(); onClose(); }

  function updateAsset(key: string, patch: Partial<AssetDraft>) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch, saved: false } : a)));
  }
  function updateAssetType(key: string, assetType: AssetType) {
    const kinds = ASSET_TYPE_CATEGORIES[assetType] ?? ASSET_TYPE_CATEGORIES[ASSET_TYPES[0]];
    const kind = kinds?.[0];
    if (!kind) return;
    setAssets((prev) => prev.map((a) => (a.key === key
      ? { ...a, assetType, kind, sourceType: null, sourceKind: null, saved: false }
      : a)));
  }
  function updateSecurityCategory(objective: SecurityObjective, patch: Partial<SecurityCategory[SecurityObjective]>) {
    setSecurityCategory((current) => ({ ...current, [objective]: { ...current[objective], ...patch } }));
  }
  function toggleSystemDataType(dataTypeId: DataTypeId) {
    if (systemDataTypeIds.includes(dataTypeId)) {
      setSystemDataTypeIds((prev) => prev.filter((id) => id !== dataTypeId));
      setAssets((current) => current.map((a) => {
        const next = { ...a.dataTypes };
        delete next[dataTypeId];
        const remainsValid = Boolean(a.name.trim() && Object.keys(next).length > 0);
        return { ...a, dataTypes: next, saved: remainsValid ? a.saved : false, expanded: remainsValid ? a.expanded : true };
      }));
      return;
    }
    setSystemDataTypeIds((prev) => [...prev, dataTypeId]);
  }
  function addAssetDataType(key: string, dataTypeId: DataTypeId | "") {
    if (!dataTypeId) return;
    setAssets((prev) => prev.map((a) => {
      if (a.key !== key) return a;
      return { ...a, dataTypes: { ...a.dataTypes, [dataTypeId]: a.dataTypes[dataTypeId] || "processes" }, saved: false };
    }));
  }
  function removeAssetDataType(key: string, dataTypeId: DataTypeId) {
    setAssets((prev) => prev.map((a) => {
      if (a.key !== key) return a;
      const next = { ...a.dataTypes };
      delete next[dataTypeId];
      return { ...a, dataTypes: next, saved: false };
    }));
  }
  function setDataTypeRole(key: string, dataTypeId: DataTypeId, role: DataRole) {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, dataTypes: { ...a.dataTypes, [dataTypeId]: role }, saved: false } : a)));
  }
  function addAsset() { setAssets((prev) => [...prev, blankAsset(prev.length)]); }
  function saveAsset(key: string) {
    setAssets((current) => current.map((asset) => asset.key === key && assetDraftIsValid(asset)
      ? { ...asset, added: true, saved: true, expanded: false }
      : asset));
  }
  function expandAsset(key: string) {
    setAssets((current) => current.map((asset) => asset.key === key ? { ...asset, expanded: true } : asset));
  }
  function removeAsset(key: string) {
    if (assets.length <= 1) return;
    setAssets((prev) => prev.filter((a) => a.key !== key));
    setActorDrafts((current) => current.filter((actor) => actor.assetKey !== key));
    setFlowDrafts((current) => current.filter((flow) => flow.fromKey !== key && flow.toKey !== key));
  }

  function updateActor(key: string, patch: Partial<ActorDraft>) {
    setActorDrafts((current) => current.map((actor) => actor.key === key ? { ...actor, ...patch, saved: false } : actor));
  }
  function updateFlow(key: string, patch: Partial<FlowDraft>) {
    setFlowDrafts((current) => current.map((flow) => flow.key === key ? { ...flow, ...patch, saved: false } : flow));
  }
  function updateAgent(key: string, patch: Partial<AgentDraft>) {
    setAgentDrafts((current) => current.map((agent) => agent.key === key ? { ...agent, ...patch, saved: false } : agent));
  }
  function addActor() {
    setActorDrafts((current) => [...current, blankActor(assets[0]?.key ?? "")]);
  }
  function addFlow() {
    setFlowDrafts((current) => [...current, blankFlow(assets[0]?.key ?? "", assets[1]?.key ?? "", [...systemDataTypeIds])]);
  }
  function addAgent() {
    setAgentDrafts((current) => [...current, blankAgent(ownerOrgId)]);
  }
  function expandActor(key: string) {
    setActorDrafts((current) => current.map((actor) => actor.key === key ? { ...actor, expanded: true } : actor));
  }
  function expandFlow(key: string) {
    setFlowDrafts((current) => current.map((flow) => flow.key === key ? { ...flow, expanded: true } : flow));
  }
  function expandAgent(key: string) {
    setAgentDrafts((current) => current.map((agent) => agent.key === key ? { ...agent, expanded: true } : agent));
  }
  function saveActor(key: string) {
    setActorDrafts((current) => current.map((actor) => actor.key === key && actorDraftIsValid(actor)
      ? { ...actor, added: true, saved: true, expanded: false }
      : actor));
  }
  function saveFlow(key: string) {
    setFlowDrafts((current) => current.map((flow) => flow.key === key && flowDraftIsValid(flow)
      ? { ...flow, added: true, saved: true, expanded: false }
      : flow));
  }
  function saveAgent(key: string) {
    setAgentDrafts((current) => current.map((agent) => agent.key === key && agentDraftIsValid(agent, autonomousActions)
      ? { ...agent, added: true, saved: true, expanded: false }
      : agent));
  }
  function removeActor(key: string) {
    setActorDrafts((current) => current.filter((actor) => actor.key !== key));
  }
  function removeFlow(key: string) {
    setFlowDrafts((current) => current.filter((flow) => flow.key !== key));
  }
  function removeAgent(key: string) {
    setAgentDrafts((current) => current.filter((agent) => agent.key !== key));
  }

  // Builds an upsert candidate for either a new or existing system. Nothing is
  // wired into the real store until the complete graph validates.
  function buildCandidateRuntimeFacts(): { runtime: RuntimeFacts; systemId: SystemId } {
    const existing = loadRuntimeFacts();
    const systemId = editingSystemId ?? nextSystemId(existing);
    // A clone copies the source's connections/standards/roles same as an edit
    // would, but never its assessment scope — that's a fresh engagement on a
    // system with its own new id, not a continuation of the source's.
    const sourceSystem = (editingSystemId ?? cloneFromSystemId)
      ? appEngine.graph.systemById[(editingSystemId ?? cloneFromSystemId)!]
      : null;
    const sourceScope = editingSystemId ? appEngine.graph.assessmentScopeBySystem[editingSystemId] : null;
    const today = new Date().toISOString().slice(0, 10);
    const ownerRole = ownerOrgId ? [{ role: "System Owner", ownerId: ownerOrgId }] : [];

    const system: System = {
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
      securityCategory,
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
    function assetIdForDraft(asset: AssetDraft): AssetId {
      if (asset.id) return asset.id;
      let candidate: AssetId;
      do {
        candidate = nextAssetId(systemId, nextAssetIndex);
        nextAssetIndex += 1;
      } while (usedAssetIds.has(candidate));
      usedAssetIds.add(candidate);
      return candidate;
    }
    const newAssets: Asset[] = assets.map((a, i) => ({
      id: assetIdForDraft(a),
      systemId,
      name: a.name.trim() || `Asset ${i + 1}`,
      type: a.sourceType && a.kind === a.sourceKind ? a.sourceType : a.assetType,
      kind: a.kind,
      provider: a.provider.trim() || provider,
      code: `A${i + 1}`,
      impactLevel: IMPACT_LEVELS.find((level) => level === a.impactLevel) ?? "moderate",
      inherentLikelihood: Number(a.inherentLikelihood) || 1,
    }));
    const assetIdByKey = new Map(assets.map((draft, index) => [draft.key, newAssets[index]?.id]));

    const newAssetDataTypes: AssetDataType[] = assets.flatMap((draft, index) => {
      const asset = newAssets[index];
      if (!asset) return [];
      return Object.entries(draft.dataTypes).flatMap(([dataTypeId, role]) => {
        const dataType = dataTypes.find((candidate) => candidate.id === dataTypeId);
        return dataType ? [{ assetId: asset.id, dataTypeId: dataType.id, role }] : [];
      });
    });

    let idFacts = existing;
    const newActors: Actor[] = [];
    const newActorAccess: ActorAccess[] = [];
    actorDrafts.forEach((draft) => {
      const assetId = assetIdByKey.get(draft.assetKey);
      if (!assetId) return;
      const actorId = draft.actorId ?? nextActorId(idFacts);
      if (!newActors.some((actor) => actor.id === actorId)) {
        const actor: Actor = { id: actorId, name: draft.name.trim(), kind: draft.kind, description: draft.description.trim() };
        newActors.push(actor);
        idFacts = { ...idFacts, actors: [...idFacts.actors, actor] };
      }
      const access: ActorAccess = {
        id: draft.accessId ?? nextActorAccessId(idFacts), actorId, assetId,
        direction: draft.direction, note: draft.note.trim() || undefined,
      };
      newActorAccess.push(access);
      idFacts = { ...idFacts, actorAccess: [...idFacts.actorAccess, access] };
    });

    const newDataFlows: DataFlow[] = [];
    flowDrafts.forEach((draft) => {
      const from = assetIdByKey.get(draft.fromKey);
      const to = assetIdByKey.get(draft.toKey);
      if (!from || !to) return;
      const flow: DataFlow = {
        id: draft.id ?? nextDataFlowId(idFacts), from, to, kind: draft.kind,
        dataTypeIds: [...draft.dataTypeIds], note: draft.note.trim() || undefined,
      };
      newDataFlows.push(flow);
      idFacts = { ...idFacts, dataFlows: [...idFacts.dataFlows, flow] };
    });

    const newAgenticIdentities: AgenticIdentity[] = [];
    (usesAI ? agentDrafts : []).forEach((draft) => {
      const agent: AgenticIdentity = {
        id: draft.id ?? nextAgenticIdentityId(idFacts), systemId, name: draft.name.trim(), purpose: draft.purpose.trim(),
        ownerOrgId: draft.ownerOrgId || undefined, servicePrincipal: draft.servicePrincipal.trim(),
        autonomyLevel: draft.autonomyLevel, humanApprovalRequired: draft.autonomyLevel !== "autonomous",
        externalActions: draft.externalActions, canImpersonateUser: draft.canImpersonateUser,
        privilegeLevel: draft.privilegeLevel, credentialType: draft.credentialType,
        loggingEnabled: draft.loggingEnabled, revocationMechanism: draft.revocationMechanism,
        tools: draft.tools.split(",").map((tool) => tool.trim()).filter(Boolean), active: true,
      };
      newAgenticIdentities.push(agent);
      idFacts = { ...idFacts, agenticIdentities: [...idFacts.agenticIdentities, agent] };
    });

    const assessmentScope: AssessmentScope = {
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
    const replacedActorIds = new Set([
      ...appEngine.graph.actorAccess.filter((edge) => replacedAssetIds.has(edge.assetId)).map((edge) => edge.actorId),
      ...existing.actorAccess.filter((edge) => replacedAssetIds.has(edge.assetId)).map((edge) => edge.actorId),
    ]);
    const expectedClassification = { ...existing.expectedClassification };
    delete expectedClassification[systemId];

    const runtime: RuntimeFacts = {
      systems: [...existing.systems.filter((s) => s.id !== systemId), system],
      assets: [...existing.assets.filter((a) => a.systemId !== systemId), ...newAssets],
      assetDataTypes: [...existing.assetDataTypes.filter((edge) => !replacedAssetIds.has(edge.assetId)), ...newAssetDataTypes],
      actors: [...existing.actors.filter((actor) => !replacedActorIds.has(actor.id)), ...newActors],
      actorAccess: [...existing.actorAccess.filter((edge) => !replacedAssetIds.has(edge.assetId)), ...newActorAccess],
      dataFlows: [...existing.dataFlows.filter((flow) => !replacedAssetIds.has(flow.from) && !replacedAssetIds.has(flow.to)), ...newDataFlows],
      agenticIdentities: [...existing.agenticIdentities.filter((agent) => agent.systemId !== systemId), ...newAgenticIdentities],
      assessmentScopes: [...existing.assessmentScopes.filter((scope) => scope.systemId !== systemId), assessmentScope],
      expectedClassification,
      // This wizard only ever adds a system — it never evaluates a control —
      // so these collections just carry forward whatever runtimeMutations.ts has
      // already recorded for earlier systems, unchanged.
      implementationMechanisms: [...existing.implementationMechanisms],
      evidence: [...existing.evidence],
      evidenceArtifacts: [...existing.evidenceArtifacts],
      evidenceReviews: [...existing.evidenceReviews],
      notImplemented: [...existing.notImplemented],
      prismaOverrides: [...existing.prismaOverrides],
      controlReviews: [...existing.controlReviews],
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
    const walk = engine.review.wavesForSystem(systemId);
    const readiness = engine.review.auditReadinessForSystem(systemId);
    setDryRun({
      problems: [],
      systemId,
      classification: rollup?.classification ?? null,
      assurance: rollup?.overallAssurance ?? null,
      coverage: rollup?.coverage ?? null,
      applicability,
      proposedWaves: {
        notApplicable: walk.waves["not-applicable"].remaining.length,
        vendorInherited: walk.waves["vendor-inherited"].remaining.length,
        companyLevel: walk.waves.enterprise.remaining.length,
        remainingTechnical: walk.waves["system-owned"].remaining.length,
      },
      readinessLabel: readiness.overall,
    });
    setChecking(false);
  }

  function goNext() {
    if (step === 5) { runDryRun(); setStep(6); return; }
    const nextStep = STEPS.find((candidate) => candidate.id === step + 1)?.id;
    if (nextStep) setStep(nextStep);
  }
  function goBack() {
    const previousStep = STEPS.find((candidate) => candidate.id === step - 1)?.id;
    if (previousStep) setStep(previousStep);
  }
  function jumpTo(n: WizardStep) {
    if (n < step) { setStep(n); return; }
    if (n === 2 && canAdvanceFrom1) { setStep(2); return; }
    if (n === 3 && canAdvanceFrom1 && canAdvanceFrom2) { setStep(3); return; }
    if (n === 4 && canAdvanceFrom1 && canAdvanceFrom2 && canAdvanceFrom3) { setStep(4); return; }
    if (n === 5 && canAdvanceFrom4) { setStep(5); return; }
    if (n === 6 && canAdvanceFrom5) { runDryRun(); setStep(6); return; }
    if (n === 7 && dryRun && dryRun.problems.length === 0) setStep(7);
  }

  function handleCreate() {
    if (!dryRun || dryRun.problems.length > 0 || !canLaunch) return;
    setSaving(true);
    const { runtime, systemId } = buildCandidateRuntimeFacts();
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setDryRun((current) => ({ ...(current ?? { systemId: null }), problems }));
      setSaving(false);
      setStep(6);
      return;
    }
    setSaving(false);
    onCreated?.(systemId);
    close();
  }

  const canAdvanceFrom1 = Boolean(name.trim() && boundary.trim() && mission.trim() && ownerOrgId);
  const canAdvanceFrom2 = Boolean(provider && regions.length > 0);
  const canAdvanceFrom3 = systemDataTypeIds.length > 0;
  const canAdvanceFrom4 = assets.every((asset) => asset.saved && assetDraftIsValid(asset)) && unmappedSystemDataTypeIds.length === 0;
  const actorsValid = actorDrafts.length > 0 && actorDrafts.every((actor) => actor.saved && actorDraftIsValid(actor));
  const flowsValid = assets.length <= 1 || (flowDrafts.length > 0 && flowDrafts.every((flow) => flow.saved && flowDraftIsValid(flow)));
  const agentsValid = !usesAI || agentDrafts.every((agent) => agent.saved && agentDraftIsValid(agent, autonomousActions));
  const canAdvanceFrom5 = actorsValid && flowsValid && agentsValid;
  const canLaunch = Boolean(assessor.trim() && assessmentTarget);
  const nextDisabled =
    (step === 1 && !canAdvanceFrom1) ||
    (step === 2 && !canAdvanceFrom2) ||
    (step === 3 && !canAdvanceFrom3) ||
    (step === 4 && !canAdvanceFrom4) ||
    (step === 5 && !canAdvanceFrom5) ||
    (step === 6 && (!dryRun || dryRun.problems.length > 0));

  return (
    <Modal open={open} onClose={close} width={960} height={700}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2.5" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>
            <ClipboardCheck size={19} color={C.accent} />
            {editingSystemId ? "Edit System" : isClone ? "Duplicate System" : "Add System"}
          </h1>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {editingSystemId
              ? "Update declared facts; classification, scope, and assurance will be recalculated before anything is saved."
              : isClone
                ? "Every asset, actor, data flow, and agent is prefilled from the source system with new ids of its own — review and adjust, then launch a fresh assessment for it."
                : "The engine proposes what applies and what can be inherited. You confirm and grade those controls on the system screen after create."}
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
        <div ref={contentPaneRef} className="p-6 overflow-y-auto">
          {step === 1 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 1 of 7</div>
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
                  <Select
                    value={ownerOrgId}
                    onChange={(e) => setOwnerOrgId(ORGS.find((org) => org.id === e.target.value)?.id ?? "")}
                  >
                    {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
                <Field label="Availability tier">
                  <Select
                    value={availabilityTier}
                    onChange={(e) => {
                      const tier = AVAILABILITY_TIERS.find((candidate) => candidate === e.target.value);
                      if (tier) setAvailabilityTier(tier);
                    }}
                  >
                    {AVAILABILITY_TIERS.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
                  </Select>
                </Field>
                <Field label="Users" note="Approximate active population for this boundary.">
                  <TextInput type="number" min={0} value={userCount} onChange={(e) => setUserCount(e.target.value)} />
                </Field>
              </div>

              <div className="text-[10px] uppercase tracking-wide font-mono mt-5 mb-2" style={{ color: C.muted }}>FIPS 199 security category</div>
              <p className="text-[10.5px] mb-3 max-w-[64ch]" style={{ color: C.muted }}>
                Rate confidentiality, integrity, and availability for this information system. The overall category is the high water mark of the three.
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "128px 110px 1fr" }}>
                {SECURITY_OBJECTIVES.map((objective) => (
                  <React.Fragment key={objective}>
                    <div className="text-xs flex items-center" style={{ color: C.ink }}>{SECURITY_OBJECTIVE_LABELS[objective]}</div>
                    <Select
                      value={securityCategory[objective].impact}
                      aria-label={`${SECURITY_OBJECTIVE_LABELS[objective]} impact`}
                      onChange={(e) => {
                        const level = IMPACT_LEVELS.find((candidate) => candidate === e.target.value);
                        if (level) updateSecurityCategory(objective, { impact: level });
                      }}
                    >
                      {IMPACT_LEVELS.map((level) => (
                        <option key={level} value={level}>{IMPACT_LEVEL_LABELS[level]}</option>
                      ))}
                    </Select>
                    <input
                      value={securityCategory[objective].reason}
                      onChange={(e) => updateSecurityCategory(objective, { reason: e.target.value })}
                      placeholder="reason"
                      className="text-xs rounded px-2 py-1"
                      style={inputStyle}
                    />
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10.5px] mt-2" style={{ color: C.muted }}>
                Overall category: {IMPACT_LEVEL_LABELS[overallImpactLevel(securityCategory)]}
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 2 of 7</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Technology & exposure</h2>
              <p className="text-xs mb-5 max-w-[64ch]" style={{ color: C.muted }}>
                Capture the system's operating environment. Your choices determine which controls apply and which ones may be inherited from a provider.
              </p>

              <div className="space-y-4">
                <TechnologySection number={1} title="Choose the hosting environment" description="Start with where the system runs, then select its provider and deployment region.">
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

                <TechnologySection number={2} title="Describe access and exposure" description="Choose every identity and network path that can reach the system.">
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

                <TechnologySection number={3} title="Flag operational characteristics" description="These choices add targeted vendor, development, AI, and regulatory requirements.">
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

          {step === 7 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 7 of 7</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Launch assessment</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Assign the assessment and set its target date. {editingSystemId ? "Saving recalculates the system's scope without changing its recorded evidence." : "Creating the system opens Scope Review. External- and internal-inherited coverage stay unclaimed until an assessor confirms them."}
              </p>

              <div className="rounded-xl p-4 mb-5 flex gap-3" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <Gauge size={18} color={C.accent} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: C.ink }}>Initial assessment plan</div>
                  <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
                    Controls in {provider || "the chosen provider"}'s certified domains are proposed as vendor-inherited from its
                    reports. They are not a standing claim until an assessor confirms that split on the system screen.
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
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 3 of 7</div>
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
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 4 of 7</div>
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
                <div key={a.key} className="rounded-xl p-4 mb-3.5" style={{ background: a.expanded ? C.panel2 : C.panel, border: `1px solid ${a.saved ? C.green : C.border}` }}>
                  <div className={`flex items-center justify-between gap-3 ${a.expanded ? "mb-3.5" : ""}`}>
                    <div>
                      <div className="text-[13px] font-bold flex items-center gap-2" style={{ color: C.ink }}>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                          {`A${i + 1}`}
                        </span>
                        {a.name || `Asset ${i + 1}`}
                      </div>
                      {!a.expanded && (
                        <div className="text-[10.5px] mt-1 ml-8" style={{ color: C.muted }}>
                          {a.assetType} · {a.kind.replace(/-/g, " ")} · {IMPACT_LEVEL_LABELS[a.impactLevel]} impact · {Object.keys(a.dataTypes).length} data type{Object.keys(a.dataTypes).length === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!a.expanded && a.saved && <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.green }}><Check size={12} /> Added</span>}
                      {!a.expanded && <button type="button" onClick={() => expandAsset(a.key)} className="rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ color: C.accent, border: `1px solid ${C.border}` }}>View / edit</button>}
                      {assets.length > 1 && <button type="button" onClick={() => removeAsset(a.key)} aria-label={`Remove ${a.name || `Asset ${i + 1}`}`} className="p-1.5 rounded" style={{ color: C.muted }}><Trash2 size={14} /></button>}
                    </div>
                  </div>

                  {a.expanded && (
                  <>
                  <div className="grid grid-cols-3 gap-3 mb-3.5">
                    <Field label="Name"><TextInput value={a.name} onChange={(e) => updateAsset(a.key, { name: e.target.value })} /></Field>
                    <Field label="Type">
                      <Select value={a.assetType} onChange={(e) => updateAssetType(a.key, e.target.value)}>
                        {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                    <Field label="Kind">
                      <Select
                        value={a.kind}
                        onChange={(e) => {
                          const kind = ASSET_TYPE_CATEGORIES[a.assetType]?.find((candidate) => candidate === e.target.value);
                          if (kind) updateAsset(a.key, { kind, sourceType: null, sourceKind: null });
                        }}
                      >
                        {ASSET_TYPE_CATEGORIES[a.assetType].map((k) => <option key={k} value={k}>{k.replace(/-/g, " ")}</option>)}
                      </Select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3.5">
                    <Field
                      label="Impact level"
                      note="FIPS 199 potential impact for this component — Low, Moderate, or High. The system's security category is scored on the boundary, not here."
                    >
                      <Select
                        value={a.impactLevel}
                        aria-label={`Impact level for ${a.name || `Asset ${i + 1}`}`}
                        onChange={(e) => {
                          const level = IMPACT_LEVELS.find((candidate) => candidate === e.target.value);
                          if (level) updateAsset(a.key, { impactLevel: level });
                        }}
                      >
                        {IMPACT_LEVELS.map((level) => (
                          <option key={level} value={level}>{IMPACT_LEVEL_LABELS[level]}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="flex items-end justify-between gap-4 mt-4 mb-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide font-mono" style={{ color: C.muted }}>Data processed by this asset</div>
                      <div className="text-[10.5px] mt-0.5" style={{ color: C.muted }}>Add from the system inventory selected on the previous step.</div>
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const dataTypeId = systemDataTypeIds.find((candidate) => candidate === e.target.value) ?? "";
                        addAssetDataType(a.key, dataTypeId);
                      }}
                      className="text-[11px] rounded-lg px-2.5 py-2"
                      style={{ ...inputStyle, width: 210 }}
                      aria-label={`Add data type to ${a.name || `Asset ${i + 1}`}`}
                    >
                      <option value="">+ Add data type…</option>
                      {systemDataTypeIds
                        .filter((id) => !Object.hasOwn(a.dataTypes, id))
                        .flatMap((id) => {
                          const dataType = dataTypes.find((candidate) => candidate.id === id);
                          return dataType ? [dataType] : [];
                        })
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
                            onChange={(e) => {
                              const nextRole = Object.values(DATA_ROLES).find((candidate) => candidate === e.target.value);
                              if (nextRole) setDataTypeRole(a.key, dt.id, nextRole);
                            }}
                            className="text-[11px] rounded px-2 py-1"
                            style={{ ...inputStyle, width: 120 }}
                          >
                            {Object.values(DATA_ROLES).map((roleOption) => (
                              <option key={roleOption} value={roleOption}>{DATA_ROLE_META[roleOption].label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeAssetDataType(a.key, dt.id)}
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
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    {!assetDraftIsValid(a) && <span className="mr-auto text-[10.5px]" style={{ color: C.amber }}>Enter an asset name and map at least one data type.</span>}
                    <button
                      type="button"
                      disabled={!assetDraftIsValid(a)}
                      onClick={() => saveAsset(a.key)}
                      className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[11.5px] font-semibold"
                      style={{ background: C.accent, color: "#fff", opacity: assetDraftIsValid(a) ? 1 : 0.45 }}
                    >
                      <Check size={13} /> {a.added ? "Save changes" : "Add asset"}
                    </button>
                  </div>
                  </>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addAsset}
                disabled={assets.some((asset) => !asset.saved)}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12.5px] font-semibold disabled:cursor-default"
                style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg, opacity: assets.some((asset) => !asset.saved) ? 0.45 : 1 }}
              >
                <Plus size={14} /> Add another asset
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 5 of 7</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>System architecture</h2>
              <p className="text-xs mb-5 max-w-[70ch]" style={{ color: C.muted }}>
                Connect the boundary you just described: who reaches it, how data and control relationships move between assets, and which authenticated agents operate inside it.
              </p>

              <section className="mb-6">
                <div className="flex items-start gap-2 mb-3">
                  <Users size={16} color={C.accent} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: C.ink }}>Actors and access</div>
                    <div className="text-[10.5px]" style={{ color: C.muted }}>At least one human or machine actor must identify where it touches the boundary.</div>
                  </div>
                </div>
                {actorDrafts.map((actor, i) => (
                  <div key={actor.key} className="rounded-xl p-4 mb-3.5" style={{ background: actor.expanded ? C.panel2 : C.panel, border: `1px solid ${actor.saved ? C.green : C.border}` }}>
                    <div className={`flex items-center justify-between gap-3 ${actor.expanded ? "mb-3.5" : ""}`}>
                      <div>
                        <div className="text-[13px] font-bold flex items-center gap-2" style={{ color: C.ink }}>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                            {`U${i + 1}`}
                          </span>
                          {actor.name || `Actor ${i + 1}`}
                        </div>
                        {!actor.expanded && (
                          <div className="text-[10.5px] mt-1 ml-8" style={{ color: C.muted }}>
                            {actor.kind} · {actor.direction} · {assetDraftLabel(assets, actor.assetKey)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!actor.expanded && actor.saved && <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.green }}><Check size={12} /> Added</span>}
                        {!actor.expanded && <button type="button" onClick={() => expandActor(actor.key)} className="rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ color: C.accent, border: `1px solid ${C.border}` }}>View / edit</button>}
                        <button type="button" onClick={() => removeActor(actor.key)} aria-label={`Remove ${actor.name || `Actor ${i + 1}`}`} className="p-1.5 rounded" style={{ color: C.muted }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {actor.expanded && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="Actor name"><TextInput value={actor.name} onChange={(e) => updateActor(actor.key, { name: e.target.value })} placeholder="Customer, administrator, integration" /></Field>
                          <Field label="Type"><Select value={actor.kind} onChange={(e) => updateActor(actor.key, { kind: Object.values(ACTOR_KINDS).find((value) => value === e.target.value) ?? actor.kind })}>{Object.values(ACTOR_KINDS).map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                          <Field label="Direction"><Select value={actor.direction} onChange={(e) => updateActor(actor.key, { direction: Object.values(ACTOR_DIRECTIONS).find((value) => value === e.target.value) ?? actor.direction })}>{Object.values(ACTOR_DIRECTIONS).map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                          <Field label="Touches asset"><Select value={actor.assetKey} onChange={(e) => updateActor(actor.key, { assetKey: e.target.value })}><option value="">Select asset</option>{assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}</Select></Field>
                          <Field label="Description"><TextInput value={actor.description} onChange={(e) => updateActor(actor.key, { description: e.target.value })} placeholder="Role in the architecture" /></Field>
                          <Field label="Access note"><TextInput value={actor.note} onChange={(e) => updateActor(actor.key, { note: e.target.value })} placeholder="Authentication or path detail" /></Field>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                          {!actorDraftIsValid(actor) && <span className="mr-auto text-[10.5px]" style={{ color: C.amber }}>Name, description, and touched asset are required.</span>}
                          <button
                            type="button"
                            disabled={!actorDraftIsValid(actor)}
                            onClick={() => saveActor(actor.key)}
                            className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[11.5px] font-semibold"
                            style={{ background: C.accent, color: "#fff", opacity: actorDraftIsValid(actor) ? 1 : 0.45 }}
                          >
                            <Check size={13} /> {actor.added ? "Save changes" : "Add actor"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {actorDrafts.length === 0 && (
                  <div className="rounded-lg px-3 py-3 text-[11px] mb-3.5" style={{ border: `1px dashed ${C.amber}`, color: C.amber }}>
                    Add at least one actor so the architecture has a real entry, exit, or administrative path.
                  </div>
                )}
                <button
                  type="button"
                  onClick={addActor}
                  disabled={actorDrafts.some((actor) => !actor.saved)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12.5px] font-semibold disabled:cursor-default"
                  style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg, opacity: actorDrafts.some((actor) => !actor.saved) ? 0.45 : 1 }}
                >
                  <Plus size={14} /> {actorDrafts.length === 0 ? "Add actor" : "Add another actor"}
                </button>
              </section>

              <section className="mb-6">
                <div className="flex items-start gap-2 mb-3">
                  <Network size={16} color={C.accent} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: C.ink }}>Asset relationships</div>
                    <div className="text-[10.5px]" style={{ color: C.muted }}>Flows drive architecture lanes and make data movement traceable.</div>
                  </div>
                </div>
                {flowDrafts.map((flow, i) => (
                  <div key={flow.key} className="rounded-xl p-4 mb-3.5" style={{ background: flow.expanded ? C.panel2 : C.panel, border: `1px solid ${flow.saved ? C.green : C.border}` }}>
                    <div className={`flex items-center justify-between gap-3 ${flow.expanded ? "mb-3.5" : ""}`}>
                      <div>
                        <div className="text-[13px] font-bold flex items-center gap-2" style={{ color: C.ink }}>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                            {`F${i + 1}`}
                          </span>
                          {`${assetDraftLabel(assets, flow.fromKey)} → ${assetDraftLabel(assets, flow.toKey)}`}
                        </div>
                        {!flow.expanded && (
                          <div className="text-[10.5px] mt-1 ml-8" style={{ color: C.muted }}>
                            {flow.kind.replace(/-/g, " ")} · {flow.dataTypeIds.length} data type{flow.dataTypeIds.length === 1 ? "" : "s"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!flow.expanded && flow.saved && <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.green }}><Check size={12} /> Added</span>}
                        {!flow.expanded && <button type="button" onClick={() => expandFlow(flow.key)} className="rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ color: C.accent, border: `1px solid ${C.border}` }}>View / edit</button>}
                        <button type="button" onClick={() => removeFlow(flow.key)} aria-label={`Remove relationship ${i + 1}`} className="p-1.5 rounded" style={{ color: C.muted }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {flow.expanded && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="From"><Select value={flow.fromKey} onChange={(e) => updateFlow(flow.key, { fromKey: e.target.value })}>{assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}</Select></Field>
                          <Field label="Relationship"><Select value={flow.kind} onChange={(e) => updateFlow(flow.key, { kind: Object.values(FLOW_KINDS).find((value) => value === e.target.value) ?? flow.kind })}>{Object.values(FLOW_KINDS).map((value) => <option key={value} value={value}>{value.replace(/-/g, " ")}</option>)}</Select></Field>
                          <Field label="To"><Select value={flow.toKey} onChange={(e) => updateFlow(flow.key, { toKey: e.target.value })}>{assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}</Select></Field>
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                          <div className="flex-1"><Field label="Data carried"><div className="flex flex-wrap gap-1.5">{systemDataTypeIds.map((id) => { const dataType = dataTypes.find((item) => item.id === id); const selected = flow.dataTypeIds.includes(id); return <ChoiceChip key={id} selected={selected} onClick={() => updateFlow(flow.key, { dataTypeIds: selected ? flow.dataTypeIds.filter((item) => item !== id) : [...flow.dataTypeIds, id] })}>{dataType?.name ?? id}</ChoiceChip>; })}</div></Field></div>
                          <div className="w-[34%]"><Field label="Relationship note"><TextInput value={flow.note} onChange={(e) => updateFlow(flow.key, { note: e.target.value })} placeholder="What moves or is protected" /></Field></div>
                        </div>
                        {flow.fromKey === flow.toKey && <div className="text-[10px] mt-1" style={{ color: C.red }}>A relationship must connect two different assets.</div>}
                        <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                          {!flowDraftIsValid(flow) && <span className="mr-auto text-[10.5px]" style={{ color: C.amber }}>Choose different assets and at least one data type.</span>}
                          <button
                            type="button"
                            disabled={!flowDraftIsValid(flow)}
                            onClick={() => saveFlow(flow.key)}
                            className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[11.5px] font-semibold"
                            style={{ background: C.accent, color: "#fff", opacity: flowDraftIsValid(flow) ? 1 : 0.45 }}
                          >
                            <Check size={13} /> {flow.added ? "Save changes" : "Add relationship"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {assets.length > 1 && flowDrafts.length === 0 && (
                  <div className="rounded-lg px-3 py-3 text-[11px] mb-3.5" style={{ border: `1px dashed ${C.amber}`, color: C.amber }}>
                    Add at least one relationship between the assets in this boundary.
                  </div>
                )}
                {assets.length === 1 && <div className="text-[11px]" style={{ color: C.muted }}>A one-asset boundary does not require an internal relationship.</div>}
                {assets.length > 1 && (
                  <button
                    type="button"
                    onClick={addFlow}
                    disabled={flowDrafts.some((flow) => !flow.saved)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12.5px] font-semibold disabled:cursor-default"
                    style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg, opacity: flowDrafts.some((flow) => !flow.saved) ? 0.45 : 1 }}
                  >
                    <Plus size={14} /> {flowDrafts.length === 0 ? "Add relationship" : "Add another relationship"}
                  </button>
                )}
              </section>

              {usesAI && (
                <section>
                  <div className="flex items-start gap-2 mb-3">
                    <Bot size={16} color={C.accent} className="mt-0.5" />
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: C.ink }}>Agentic identities</div>
                      <div className="text-[10.5px]" style={{ color: C.muted }}>Optional: record authenticated AI agents that can invoke tools or affect resources.</div>
                    </div>
                  </div>
                  {agentDrafts.map((agent, i) => (
                    <div key={agent.key} className="rounded-xl p-4 mb-3.5" style={{ background: agent.expanded ? C.panel2 : C.panel, border: `1px solid ${agent.saved ? C.green : C.border}` }}>
                      <div className={`flex items-center justify-between gap-3 ${agent.expanded ? "mb-3.5" : ""}`}>
                        <div>
                          <div className="text-[13px] font-bold flex items-center gap-2" style={{ color: C.ink }}>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.accentBg, color: C.accent }}>
                              {`G${i + 1}`}
                            </span>
                            {agent.name || `Agent ${i + 1}`}
                          </div>
                          {!agent.expanded && (
                            <div className="text-[10.5px] mt-1 ml-8" style={{ color: C.muted }}>
                              {agent.autonomyLevel} · {agent.privilegeLevel} privilege · {agent.credentialType.replace(/-/g, " ")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!agent.expanded && agent.saved && <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.green }}><Check size={12} /> Added</span>}
                          {!agent.expanded && <button type="button" onClick={() => expandAgent(agent.key)} className="rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ color: C.accent, border: `1px solid ${C.border}` }}>View / edit</button>}
                          <button type="button" onClick={() => removeAgent(agent.key)} aria-label={`Remove ${agent.name || `Agent ${i + 1}`}`} className="p-1.5 rounded" style={{ color: C.muted }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {agent.expanded && (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <Field label="Agent name"><TextInput value={agent.name} onChange={(e) => updateAgent(agent.key, { name: e.target.value })} /></Field>
                            <Field label="Service principal"><TextInput value={agent.servicePrincipal} onChange={(e) => updateAgent(agent.key, { servicePrincipal: e.target.value })} placeholder="spn://system/agent" /></Field>
                            <Field label="Owner"><Select value={agent.ownerOrgId} onChange={(e) => updateAgent(agent.key, { ownerOrgId: e.target.value })}><option value="">Unassigned</option>{ORGS.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</Select></Field>
                            <Field label="Autonomy"><Select value={agent.autonomyLevel} onChange={(e) => updateAgent(agent.key, { autonomyLevel: AGENT_AUTONOMY_LEVELS.find((value) => value === e.target.value) ?? agent.autonomyLevel, externalActions: e.target.value === "recommend" ? false : agent.externalActions })}>{AGENT_AUTONOMY_LEVELS.filter((value) => value !== "autonomous" || autonomousActions).map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                            <Field label="Privilege"><Select value={agent.privilegeLevel} onChange={(e) => updateAgent(agent.key, { privilegeLevel: AGENT_PRIVILEGE_LEVELS.find((value) => value === e.target.value) ?? agent.privilegeLevel })}>{AGENT_PRIVILEGE_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                            <Field label="Credential"><Select value={agent.credentialType} onChange={(e) => updateAgent(agent.key, { credentialType: AGENT_CREDENTIAL_TYPES.find((value) => value === e.target.value) ?? agent.credentialType })}>{AGENT_CREDENTIAL_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                            <Field label="Purpose"><TextInput value={agent.purpose} onChange={(e) => updateAgent(agent.key, { purpose: e.target.value })} /></Field>
                            <Field label="Tools / resources"><TextInput value={agent.tools} onChange={(e) => updateAgent(agent.key, { tools: e.target.value })} placeholder="Search, tickets, deployment" /></Field>
                            <Field label="Revocation"><Select value={agent.revocationMechanism} onChange={(e) => updateAgent(agent.key, { revocationMechanism: AGENT_REVOCATION_MECHANISMS.find((value) => value === e.target.value) ?? agent.revocationMechanism })}>{AGENT_REVOCATION_MECHANISMS.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: C.ink }}>
                            <label className="flex items-center gap-1.5"><input type="checkbox" checked={agent.externalActions} disabled={agent.autonomyLevel === "recommend"} onChange={(e) => updateAgent(agent.key, { externalActions: e.target.checked })} /> External actions</label>
                            <label className="flex items-center gap-1.5"><input type="checkbox" checked={agent.canImpersonateUser} onChange={(e) => updateAgent(agent.key, { canImpersonateUser: e.target.checked })} /> Can impersonate user</label>
                            <label className="flex items-center gap-1.5"><input type="checkbox" checked={agent.loggingEnabled} onChange={(e) => updateAgent(agent.key, { loggingEnabled: e.target.checked })} /> Activity logging</label>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                            {!agentDraftIsValid(agent, autonomousActions) && <span className="mr-auto text-[10.5px]" style={{ color: C.amber }}>Name, purpose, service principal, and tools are required.</span>}
                            <button
                              type="button"
                              disabled={!agentDraftIsValid(agent, autonomousActions)}
                              onClick={() => saveAgent(agent.key)}
                              className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[11.5px] font-semibold"
                              style={{ background: C.accent, color: "#fff", opacity: agentDraftIsValid(agent, autonomousActions) ? 1 : 0.45 }}
                            >
                              <Check size={13} /> {agent.added ? "Save changes" : "Add agent"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {agentDrafts.length === 0 && (
                    <div className="text-[11px] mb-3.5" style={{ color: C.muted }}>
                      No agentic identity declared. AI use alone does not imply an agent can take action.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addAgent}
                    disabled={agentDrafts.some((agent) => !agent.saved)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12.5px] font-semibold disabled:cursor-default"
                    style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentBg, opacity: agentDrafts.some((agent) => !agent.saved) ? 0.45 : 1 }}
                  >
                    <Plus size={14} /> {agentDrafts.length === 0 ? "Add agent" : "Add another agent"}
                  </button>
                </section>
              )}
            </div>
          )}

          {step === 6 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: C.accent }}>Step 6 of 7</div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>Derived scope</h2>
              <p className="text-xs mb-5 max-w-[60ch]" style={{ color: C.muted }}>
                Classification and the four review buckets are derived from your entries. Nothing here is a claimed assessment — an assessor confirms and grades these controls on the system screen after create.
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
                        <div className="text-lg font-bold" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>{dryRun.assurance ?? "—"}{dryRun.assurance != null ? "%" : ""}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Proposed assurance (unconfirmed)</div>
                      </div>
                      {dryRun.assurance != null && <AssuranceBadge pct={dryRun.assurance} size={34} />}
                    </div>
                    <div className="rounded-xl p-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-lg font-bold capitalize" style={{ fontFamily: "'Source Serif 4', serif", color: C.ink }}>
                        {(dryRun.readinessLabel ?? "scope-unconfirmed").replace(/-/g, " ")}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Audit-ready preview</div>
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
                  {dryRun.proposedWaves && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Proposed review queues</div>
                      <div className="text-[11px] mb-3" style={{ color: C.muted }}>
                        After create, the assessor walks these in Scope Review. The wizard does not grade controls.
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          ["Not applicable", dryRun.proposedWaves.notApplicable, "Confirm the derived exclusions"],
                          ["External inherited", dryRun.proposedWaves.vendorInherited, "Confirm the provider split"],
                          ["Internal inherited", dryRun.proposedWaves.companyLevel, "Confirm program incorporation"],
                          ["Remaining technical", dryRun.proposedWaves.remainingTechnical, "PRISMA grade what ACME still owns"],
                        ].map(([label, value, hint]) => (
                          <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: C.panel }}>
                            <div className="text-lg font-bold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{value}</div>
                            <div className="text-[10.5px] font-semibold" style={{ color: C.ink }}>{label}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{hint}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12.5px]" style={{ background: C.greenBg, color: C.green }}>
                    <Check size={16} className="shrink-0 mt-0.5" />
                    <div><b>Derived scope validated.</b> Continue to assign the assessor, then confirm and grade controls on the system screen.</div>
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
        <span className="text-[11px] font-mono" style={{ color: C.muted }}>STEP {step} OF 7</span>
        <div className="flex gap-2.5">
          <button
            onClick={goBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2"
            style={{ border: `1px solid ${C.border}`, color: C.ink, opacity: step === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < 7 ? (
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
