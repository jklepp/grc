import { useEffect, useMemo, useRef, useState } from "react";
import {
  Info, Gauge, Layers, ClipboardCheck, Check, AlertTriangle, ChevronLeft, ChevronRight, Network, Users, Bot,
  DatabaseBackup, Boxes, Cloud, Database, History, KeyRound, ListChecks, ShieldCheck, SlidersHorizontal, UserCheck, Code2,
} from "lucide-react";
import { C } from "../theme";
import Modal, { ModalCloseButton } from "./Modal";
import { ClassificationTag, AssuranceBadge } from "./SystemBadges";
import {
  AddButton, Button, Callout, CheckRow, Checkbox, ChoiceChip, EmptyState, EntityCard, EntityList, Field, FieldGrid,
  InlineHint, OptionCard, RailGroup, RailItem, RemoveButton, Section, Select, StatTile, StatusPill, StepBody,
  StepHeader, TextArea, TextInput, ToggleCard, TX, Well, WizardBody, WizardChrome, WizardFooter, WizardHeader,
  WizardRail,
} from "./wizard/WizardUI";
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
import { loadRuntimeFacts, nextSystemId, nextAssetId, nextActorId, nextActorAccessId, nextDataFlowId, nextAgenticIdentityId, nextDrTestId } from "../engine/runtimeFactsStore";
import type { BackupConfig, DrTest } from "../graph/nodes/resilience";
import type { SdlcPosture } from "../graph/nodes/sdlc";
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
  { id: 6, title: "Resilience & SDLC", detail: "Backup, DR & secure dev", icon: DatabaseBackup },
  { id: 7, title: "Derived Scope", detail: "What applies & why", icon: ClipboardCheck },
  { id: 8, title: "Launch", detail: "Start assessment", icon: Check },
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

interface DrTestDraft {
  key: string;
  saved: boolean;
  expanded: boolean;
  id?: string;
  conductedAt: string;
  cadenceDays: number | string;
  scope: string;
  restoreSuccessful: boolean;
  actualRpoMinutes: number | string;
  actualRtoMinutes: number | string;
  issues: string;
}

// The ten SdlcPosture safeguard booleans, grouped as one object (like
// securityCategory) rather than ten separate useState calls.
interface SdlcSafeguards {
  repoBranchProtection: boolean;
  prReviewRequired: boolean;
  sastEnabled: boolean;
  scaEnabled: boolean;
  dastEnabled: boolean;
  containerScanningEnabled: boolean;
  secretScanningEnabled: boolean;
  iacScanningEnabled: boolean;
  cicdIdentityHardened: boolean;
  deployApprovalRequired: boolean;
}

const SDLC_SAFEGUARD_GROUPS: { label: string; keys: (keyof SdlcSafeguards)[] }[] = [
  { label: "Source", keys: ["repoBranchProtection", "prReviewRequired", "secretScanningEnabled"] },
  { label: "Build & Test", keys: ["sastEnabled", "scaEnabled", "dastEnabled", "containerScanningEnabled", "iacScanningEnabled"] },
  { label: "Release", keys: ["cicdIdentityHardened", "deployApprovalRequired"] },
];
const SDLC_SAFEGUARD_LABELS: Record<keyof SdlcSafeguards, string> = {
  repoBranchProtection: "Branch Protection",
  prReviewRequired: "PR Review Required",
  secretScanningEnabled: "Secret Scanning",
  sastEnabled: "SAST",
  scaEnabled: "SCA",
  dastEnabled: "DAST",
  containerScanningEnabled: "Container Scanning",
  iacScanningEnabled: "IaC Scanning",
  cicdIdentityHardened: "CI/CD Identity Hardened",
  deployApprovalRequired: "Deploy Approval Required",
};

function blankSdlcSafeguards(): SdlcSafeguards {
  return {
    repoBranchProtection: false, prReviewRequired: false, sastEnabled: false, scaEnabled: false,
    dastEnabled: false, containerScanningEnabled: false, secretScanningEnabled: false,
    iacScanningEnabled: false, cicdIdentityHardened: false, deployApprovalRequired: false,
  };
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

function blankDrTestDraft(): DrTestDraft {
  return {
    key: draftKey("drtest"), saved: false, expanded: true,
    conductedAt: new Date().toISOString().slice(0, 10), cadenceDays: 180, scope: "",
    restoreSuccessful: true, actualRpoMinutes: 0, actualRtoMinutes: 0, issues: "",
  };
}

function drTestDraftIsValid(draft: DrTestDraft): boolean {
  return Boolean(
    draft.conductedAt && !Number.isNaN(Date.parse(draft.conductedAt))
    && Number(draft.cadenceDays) > 0
    && draft.scope.trim()
    && Number(draft.actualRpoMinutes) >= 0 && Number(draft.actualRtoMinutes) >= 0
    && (draft.restoreSuccessful || draft.issues.trim())
  );
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

  // Backup & Recovery — a system either has a backup configuration on record
  // or it doesn't; there's nothing to fabricate for one that hasn't been set
  // up yet.
  const [trackBackup, setTrackBackup] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupCoveragePct, setBackupCoveragePct] = useState<number | string>(100);
  const [backupImmutable, setBackupImmutable] = useState(false);
  const [backupCrossRegion, setBackupCrossRegion] = useState(false);
  const [backupRpoTargetMinutes, setBackupRpoTargetMinutes] = useState<number | string>(60);
  const [backupRtoTargetMinutes, setBackupRtoTargetMinutes] = useState<number | string>(240);

  // Disaster recovery test history — any number of records, same
  // add/edit/save card pattern as assets/actors/flows/agents above.
  const [drTestDrafts, setDrTestDrafts] = useState<DrTestDraft[]>([]);

  // Secure development posture. `sdlcApplicable` (declared above, asked in
  // Technology as "Custom software") already IS the fact SdlcPosture.applicable
  // records, so it's reused rather than asked twice; this section only adds
  // the safeguard detail behind that answer.
  const [trackSdlc, setTrackSdlc] = useState(false);
  const [sdlcNotApplicableReason, setSdlcNotApplicableReason] = useState("");
  const [sdlcSafeguards, setSdlcSafeguards] = useState<SdlcSafeguards>(blankSdlcSafeguards);
  const [lastThreatModelAt, setLastThreatModelAt] = useState("");

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

    const sourceBackup = appEngine.graph.backupConfigBySystem[sourceSystemId];
    setTrackBackup(Boolean(sourceBackup));
    setBackupEnabled(sourceBackup?.enabled ?? true);
    setBackupCoveragePct(sourceBackup?.coveragePct ?? 100);
    setBackupImmutable(sourceBackup?.immutable ?? false);
    setBackupCrossRegion(sourceBackup?.crossRegion ?? false);
    setBackupRpoTargetMinutes(sourceBackup?.rpoTargetMinutes ?? 60);
    setBackupRtoTargetMinutes(sourceBackup?.rtoTargetMinutes ?? 240);

    setDrTestDrafts((appEngine.graph.drTestsBySystem[sourceSystemId] ?? []).map((test) => ({
      key: isClone ? draftKey("drtest") : test.id,
      saved: true, expanded: false,
      id: isClone ? undefined : test.id,
      conductedAt: test.conductedAt, cadenceDays: test.cadenceDays, scope: test.scope,
      restoreSuccessful: test.restoreSuccessful, actualRpoMinutes: test.actualRpoMinutes,
      actualRtoMinutes: test.actualRtoMinutes, issues: test.issues ?? "",
    })));

    const sourceSdlc = appEngine.graph.sdlcPostureBySystem[sourceSystemId];
    setTrackSdlc(Boolean(sourceSdlc));
    setSdlcNotApplicableReason(sourceSdlc?.notApplicableReason ?? "");
    setSdlcSafeguards(sourceSdlc ? {
      repoBranchProtection: sourceSdlc.repoBranchProtection, prReviewRequired: sourceSdlc.prReviewRequired,
      sastEnabled: sourceSdlc.sastEnabled, scaEnabled: sourceSdlc.scaEnabled, dastEnabled: sourceSdlc.dastEnabled,
      containerScanningEnabled: sourceSdlc.containerScanningEnabled, secretScanningEnabled: sourceSdlc.secretScanningEnabled,
      iacScanningEnabled: sourceSdlc.iacScanningEnabled, cicdIdentityHardened: sourceSdlc.cicdIdentityHardened,
      deployApprovalRequired: sourceSdlc.deployApprovalRequired,
    } : blankSdlcSafeguards());
    setLastThreatModelAt(sourceSdlc?.lastThreatModelAt ?? "");

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
    setTrackBackup(false); setBackupEnabled(true); setBackupCoveragePct(100); setBackupImmutable(false);
    setBackupCrossRegion(false); setBackupRpoTargetMinutes(60); setBackupRtoTargetMinutes(240);
    setDrTestDrafts([]);
    setTrackSdlc(false); setSdlcNotApplicableReason(""); setSdlcSafeguards(blankSdlcSafeguards()); setLastThreatModelAt("");
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

  function addDrTest() {
    setDrTestDrafts((current) => [...current, blankDrTestDraft()]);
  }
  function updateDrTest(key: string, patch: Partial<DrTestDraft>) {
    setDrTestDrafts((current) => current.map((t) => (t.key === key ? { ...t, ...patch, saved: false } : t)));
  }
  function expandDrTest(key: string) {
    setDrTestDrafts((current) => current.map((t) => (t.key === key ? { ...t, expanded: true } : t)));
  }
  function saveDrTest(key: string) {
    setDrTestDrafts((current) => current.map((t) => t.key === key && drTestDraftIsValid(t)
      ? { ...t, saved: true, expanded: false } : t));
  }
  function removeDrTest(key: string) {
    setDrTestDrafts((current) => current.filter((t) => t.key !== key));
  }
  function updateSdlcSafeguard(key: keyof SdlcSafeguards, value: boolean) {
    setSdlcSafeguards((current) => ({ ...current, [key]: value }));
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

    // Backup configuration, DR test history, and SDLC posture live in their
    // own System Register cockpit fact domains, keyed purely by system id —
    // they are not part of the architecture (assets/flows) built above. The
    // Resilience & SDLC step (6) is what the user actually edited; a clone or
    // edit only pre-filled that step's state (see the prefill useEffect), so
    // by the time we get here it already reflects whatever the user changed
    // or left as-is. A from-scratch new system that never turns these
    // sections on correctly ends up with none of these rows — it hasn't run
    // a DR test yet.
    const newBackupConfigs: BackupConfig[] = trackBackup ? [{
      systemId,
      enabled: backupEnabled,
      coveragePct: Math.max(0, Math.min(100, Number(backupCoveragePct) || 0)),
      immutable: backupImmutable,
      crossRegion: backupCrossRegion,
      rpoTargetMinutes: Math.max(1, Number(backupRpoTargetMinutes) || 1),
      rtoTargetMinutes: Math.max(1, Number(backupRtoTargetMinutes) || 1),
    }] : [];
    const newSdlcPostures: SdlcPosture[] = trackSdlc ? [{
      systemId,
      applicable: sdlcApplicable,
      notApplicableReason: sdlcApplicable ? undefined : (sdlcNotApplicableReason.trim() || "Not applicable"),
      ...sdlcSafeguards,
      lastThreatModelAt: lastThreatModelAt || undefined,
    }] : [];
    const newDrTests: DrTest[] = [];
    drTestDrafts.filter((t) => t.saved).forEach((draft) => {
      const id = draft.id ?? nextDrTestId(idFacts);
      const drTest: DrTest = {
        id, systemId,
        conductedAt: draft.conductedAt,
        cadenceDays: Math.max(1, Number(draft.cadenceDays) || 1),
        scope: draft.scope.trim(),
        restoreSuccessful: draft.restoreSuccessful,
        actualRpoMinutes: Math.max(0, Number(draft.actualRpoMinutes) || 0),
        actualRtoMinutes: Math.max(0, Number(draft.actualRtoMinutes) || 0),
        issues: draft.restoreSuccessful ? undefined : (draft.issues.trim() || undefined),
      };
      newDrTests.push(drTest);
      idFacts = { ...idFacts, drTests: [...idFacts.drTests, drTest] };
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
      backupConfigs: [...existing.backupConfigs.filter((b) => b.systemId !== systemId), ...newBackupConfigs],
      drTests: [...existing.drTests.filter((t) => t.systemId !== systemId), ...newDrTests],
      sdlcPostures: [...existing.sdlcPostures.filter((p) => p.systemId !== systemId), ...newSdlcPostures],
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
    if (step === 6) { runDryRun(); setStep(7); return; }
    const nextStep = STEPS.find((candidate) => candidate.id === step + 1)?.id;
    if (nextStep) setStep(nextStep);
  }
  function goBack() {
    const previousStep = STEPS.find((candidate) => candidate.id === step - 1)?.id;
    if (previousStep) setStep(previousStep);
  }
  // Jumping forward requires every step in between to be complete, not just
  // the one immediately before — otherwise the rail offers (say) Derived Scope
  // on a system that has no assets yet, which is a dead end.
  function jumpTo(n: WizardStep) {
    if (!stepReachable(n)) return;
    if (n === 7 && step < 7) runDryRun();
    setStep(n);
  }

  function handleCreate() {
    if (!dryRun || dryRun.problems.length > 0 || !canLaunch) return;
    setSaving(true);
    const { runtime, systemId } = buildCandidateRuntimeFacts();
    const { engine, problems } = commitRuntimeFacts(runtime);
    if (!engine) {
      setDryRun((current) => ({ ...(current ?? { systemId: null }), problems }));
      setSaving(false);
      setStep(7);
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
  const backupValid = !trackBackup || (
    Number(backupCoveragePct) >= 0 && Number(backupCoveragePct) <= 100
    && Number(backupRpoTargetMinutes) > 0 && Number(backupRtoTargetMinutes) > 0
  );
  const drTestsValid = drTestDrafts.every((t) => t.saved && drTestDraftIsValid(t));
  const sdlcValid = !trackSdlc || sdlcApplicable || Boolean(sdlcNotApplicableReason.trim());
  const canAdvanceFrom6 = backupValid && drTestsValid && sdlcValid;
  const canLaunch = Boolean(assessor.trim() && assessmentTarget);
  const nextDisabled =
    (step === 1 && !canAdvanceFrom1) ||
    (step === 2 && !canAdvanceFrom2) ||
    (step === 3 && !canAdvanceFrom3) ||
    (step === 4 && !canAdvanceFrom4) ||
    (step === 5 && !canAdvanceFrom5) ||
    (step === 6 && !canAdvanceFrom6) ||
    (step === 7 && (!dryRun || dryRun.problems.length > 0));

  const total = STEPS.length;
  const isLastStep = step === total;

  // Whether a step has everything the next one depends on. `jumpTo` and the
  // rail's disabled state both read this, so what looks clickable and what is
  // clickable can never drift apart.
  function stepComplete(target: WizardStep): boolean {
    if (target === 1) return canAdvanceFrom1;
    if (target === 2) return canAdvanceFrom2;
    if (target === 3) return canAdvanceFrom3;
    if (target === 4) return canAdvanceFrom4;
    if (target === 5) return canAdvanceFrom5;
    if (target === 6) return canAdvanceFrom6;
    if (target === 7) return Boolean(dryRun && dryRun.problems.length === 0);
    return true;
  }
  function stepReachable(target: WizardStep): boolean {
    if (target <= step) return true;
    return STEPS.every((candidate) => candidate.id >= target || stepComplete(candidate.id));
  }

  // Step-level validation lives in exactly one place — the footer, next to the
  // control it blocks. Field-level problems stay on their own Field/EntityCard.
  function blockingReason(): string | null {
    if (step === 1 && !canAdvanceFrom1) return "Name, mission, boundary and system owner are all required.";
    if (step === 2 && !canAdvanceFrom2) return "Select a provider and at least one deployment region.";
    if (step === 3 && !canAdvanceFrom3) return "Select at least one data type this system handles.";
    if (step === 4 && !canAdvanceFrom4) {
      return unmappedSystemDataTypeIds.length > 0
        ? `${unmappedSystemDataTypeIds.length} selected data type${unmappedSystemDataTypeIds.length === 1 ? " still needs" : "s still need"} an asset.`
        : "Every asset needs a name, one data type, and to be saved.";
    }
    if (step === 5 && !canAdvanceFrom5) {
      if (!actorsValid) return "Add and save at least one actor.";
      if (!flowsValid) return "Add and save at least one relationship between assets.";
      return "Save or remove every agentic identity draft.";
    }
    if (step === 6 && !canAdvanceFrom6) {
      if (!backupValid) return "Backup coverage must be 0–100% with positive RPO and RTO targets.";
      if (!drTestsValid) return "Save or remove every disaster-recovery test draft.";
      return "Secure development needs a not-applicable reason.";
    }
    if (step === 7 && (!dryRun || dryRun.problems.length > 0)) return "Resolve the problems listed above before continuing.";
    if (step === 8 && !canLaunch) return "Assign an assessor of record and a target completion date.";
    return null;
  }
  const blockReason = blockingReason();

  const coverageError = trackBackup && (Number(backupCoveragePct) < 0 || Number(backupCoveragePct) > 100)
    ? "Enter a value between 0 and 100." : null;
  const rpoError = trackBackup && !(Number(backupRpoTargetMinutes) > 0) ? "Enter a positive number of minutes." : null;
  const rtoError = trackBackup && !(Number(backupRtoTargetMinutes) > 0) ? "Enter a positive number of minutes." : null;

  return (
    <Modal open={open} onClose={close} width={1000} height={720}>
      <WizardChrome>
        <WizardHeader
          icon={ClipboardCheck}
          title={editingSystemId ? "Edit System" : isClone ? "Duplicate System" : "Add System"}
          description={editingSystemId
            ? "Update declared facts; classification, scope, and assurance are recalculated before anything is saved."
            : isClone
              ? "Every asset, actor, data flow, and agent is prefilled from the source system with new ids of its own — review and adjust, then launch a fresh assessment for it."
              : "The engine proposes what applies and what can be inherited. You confirm and grade those controls on the system screen after create."}
          onClose={<ModalCloseButton onClose={close} />}
        />

        <WizardBody>
          <WizardRail>
            <RailGroup connected>
              {STEPS.map((s) => (
                <RailItem
                  key={s.id}
                  marker={s.id}
                  title={s.title}
                  detail={s.detail}
                  state={s.id === step ? "active" : s.id < step ? "done" : "pending"}
                  disabled={!stepReachable(s.id)}
                  ariaLabel={`Step ${s.id}: ${s.title} — ${s.detail}`}
                  onClick={() => jumpTo(s.id)}
                />
              ))}
            </RailGroup>
          </WizardRail>

          {/* ---- Content pane ---- */}
          <div ref={contentPaneRef} className="p-6 overflow-y-auto" style={{ background: C.bg }}>
            {step === 1 && (
              <>
                <StepHeader
                  step={1}
                  total={total}
                  title="System basics"
                  description="Core facts about the system. Its classification, assurance and PRISMA level are never entered here — they are computed from the technology, data and assets you add later."
                />
                <StepBody>
                  <Section icon={Info} title="Identity & ownership" description="What this boundary is, what it does, and who is accountable for it.">
                    <FieldGrid cols={1}>
                      <Field label="System name">
                        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Analytics Data Lake" />
                      </Field>
                      <Field label="Mission">
                        <TextArea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="What does this system do, and for whom?" />
                      </Field>
                      <Field label="Boundary">
                        <TextArea value={boundary} onChange={(e) => setBoundary(e.target.value)} placeholder="What's inside this boundary, and what isn't?" />
                      </Field>
                    </FieldGrid>
                    <FieldGrid cols={3}>
                      <Field label="System owner">
                        <Select value={ownerOrgId} onChange={(e) => setOwnerOrgId(ORGS.find((org) => org.id === e.target.value)?.id ?? "")}>
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
                    </FieldGrid>
                  </Section>

                  <Section
                    icon={ShieldCheck}
                    title="FIPS 199 security category"
                    description="Rate confidentiality, integrity, and availability for this information system. The overall category is the high-water mark of the three."
                    aside={<StatusPill tone="info">Overall · {IMPACT_LEVEL_LABELS[overallImpactLevel(securityCategory)]}</StatusPill>}
                  >
                    {SECURITY_OBJECTIVES.map((objective) => (
                      <Well key={objective} className="flex flex-col gap-3.5">
                        <div className={TX.itemTitle} style={{ color: C.ink }}>{SECURITY_OBJECTIVE_LABELS[objective]}</div>
                        <FieldGrid cols={2}>
                          <Field label="Potential impact">
                            <Select
                              value={securityCategory[objective].impact}
                              aria-label={`${SECURITY_OBJECTIVE_LABELS[objective]} impact`}
                              onChange={(e) => {
                                const level = IMPACT_LEVELS.find((candidate) => candidate === e.target.value);
                                if (level) updateSecurityCategory(objective, { impact: level });
                              }}
                            >
                              {IMPACT_LEVELS.map((level) => <option key={level} value={level}>{IMPACT_LEVEL_LABELS[level]}</option>)}
                            </Select>
                          </Field>
                          <Field label="Rationale">
                            <TextInput
                              value={securityCategory[objective].reason}
                              aria-label={`${SECURITY_OBJECTIVE_LABELS[objective]} rationale`}
                              onChange={(e) => updateSecurityCategory(objective, { reason: e.target.value })}
                              placeholder="Why this level?"
                            />
                          </Field>
                        </FieldGrid>
                      </Well>
                    ))}
                  </Section>
                </StepBody>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeader
                  step={2}
                  total={total}
                  title="Technology & exposure"
                  description="Capture the system's operating environment. Your choices determine which controls apply and which ones may be inherited from a provider."
                />
                <StepBody>
                  <Section icon={Cloud} title="Hosting environment" description="Where the system runs, who provides it, and in which regions.">
                    <div role="radiogroup" aria-label="Hosting type" className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                      {HOSTING_TYPES.map((h) => {
                        const count = eligibleProviders(h).length;
                        return (
                          <OptionCard
                            key={h}
                            selected={hostingType === h}
                            disabled={count === 0}
                            disabledTitle="No certified provider covers this hosting type's inherited domains yet"
                            onClick={() => { setHostingType(h); setProvider(""); }}
                            title={h.replace("-", " ")}
                            hint={count === 0 ? "Not configured" : `${count} eligible provider${count === 1 ? "" : "s"}`}
                          />
                        );
                      })}
                    </div>
                    <FieldGrid cols={2}>
                      <Field label="Provider" note="Limited to providers with qualifying assurance on file.">
                        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                          <option value="">Select a provider…</option>
                          {providers.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </Select>
                      </Field>
                      <Field label="Deployment regions" note="Select every region in this system boundary.">
                        <div className="flex flex-wrap gap-2">
                          {CLOUD_REGIONS.map((r) => (
                            <ChoiceChip
                              key={r}
                              selected={regions.includes(r)}
                              ariaLabel={r}
                              onClick={() => setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
                            >
                              <span className="font-mono normal-case">{r}</span>
                            </ChoiceChip>
                          ))}
                        </div>
                      </Field>
                    </FieldGrid>
                  </Section>

                  <Section icon={KeyRound} title="Access & exposure" description="Every identity and network path that can reach the system.">
                    <ToggleCard
                      checked={internetFacing}
                      onChange={setInternetFacing}
                      title="Publicly reachable"
                      description="The system, an endpoint, or a login surface is reachable from the open internet."
                    />
                    <FieldGrid cols={2}>
                      <Field label="Identity types" note="Who or what can authenticate to this boundary.">
                        <div className="flex flex-wrap gap-2">
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
                        <div className="flex flex-wrap gap-2">
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
                    </FieldGrid>
                  </Section>

                  <Section icon={SlidersHorizontal} title="Operational characteristics" description="These choices add targeted vendor, development, AI, and regulatory requirements.">
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
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
                          <CheckRow checked={autonomousActions} onChange={setAutonomousActions} label="Can act without human approval" />
                        )}
                      </ToggleCard>
                    </div>
                    <Field label="Regulatory context" note="Business obligations that apply beyond the data profile captured on the next step.">
                      <div className="flex flex-wrap gap-2">
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
                  </Section>
                </StepBody>
              </>
            )}

            {step === 3 && (
              <>
                <StepHeader
                  step={3}
                  total={total}
                  title="System data inventory"
                  description="Identify every type of data this system stores, transmits, or processes. You will map these data types to individual assets next."
                />
                <StepBody>
                  <Section icon={Layers} title="Boundary data profile" description="Who the data is about, roughly how much of it there is, and where it is kept.">
                    <Field label="Data subjects">
                      <div className="flex flex-wrap gap-2">
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
                    <FieldGrid cols={3}>
                      <Field label="Approx. records">
                        <TextInput type="number" min={0} value={approxRecords} onChange={(e) => setApproxRecords(e.target.value)} />
                      </Field>
                      <Field label="Retention">
                        <Select value={retention} onChange={(e) => setRetention(e.target.value)}>
                          {RETENTION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </Select>
                      </Field>
                      <Field label="Residency">
                        <Select value={residency} onChange={(e) => setResidency(e.target.value)}>
                          {RESIDENCY_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </Select>
                      </Field>
                    </FieldGrid>
                  </Section>

                  <Section
                    icon={Database}
                    title="Data types processed"
                    description="Choose everything that applies to the system boundary."
                    aside={<StatusPill tone={systemDataTypeIds.length > 0 ? "success" : "neutral"}>{systemDataTypeIds.length} selected</StatusPill>}
                  >
                    <TextInput
                      value={dataSearch}
                      onChange={(e) => setDataSearch(e.target.value)}
                      placeholder="Search data types…"
                      aria-label="Search data types"
                      className="md:max-w-[300px]"
                    />
                    <Well padded={false} className="overflow-hidden">
                      {filteredDataTypes.map((dt, index) => {
                        const selected = systemDataTypeIds.includes(dt.id);
                        return (
                          <label
                            key={dt.id}
                            className={`${selected ? "wz-lift" : "wz-hover"} flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors`}
                            style={{
                              background: selected ? C.accentBg : undefined,
                              borderBottom: index < filteredDataTypes.length - 1 ? `1px solid ${C.border}` : undefined,
                            }}
                          >
                            <Checkbox
                              checked={selected}
                              ariaLabel={dt.name}
                              onChange={() => toggleSystemDataType(dt.id)}
                              className="mt-0.5"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-2">
                                <span className={TX.body} style={{ color: C.ink, fontWeight: 600 }}>{dt.name}</span>
                                <span className={`${TX.tag} capitalize`} style={{ color: C.muted }}>{dt.kind.replace(/-/g, " ")}</span>
                              </span>
                              <span className={`block ${TX.help} mt-1`} style={{ color: C.muted }}>{dt.description}</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              {dt.regulatoryFlags.slice(0, 2).map((flag) => (
                                <span key={flag} className={TX.tag} style={{ color: C.muted }}>{flag}</span>
                              ))}
                              <ClassificationTag level={dt.sensitivity} />
                            </span>
                          </label>
                        );
                      })}
                      {filteredDataTypes.length === 0 && (
                        <div className={`${TX.help} text-center py-8`} style={{ color: C.muted }}>No data types match that search.</div>
                      )}
                    </Well>
                  </Section>
                </StepBody>
              </>
            )}

            {step === 4 && (
              <>
                <StepHeader
                  step={4}
                  total={total}
                  title="Assets & data mapping"
                  description="Add the assets inside this boundary and map only the system data types each asset stores, transmits, or processes."
                />
                <StepBody>
                  <Section
                    icon={Boxes}
                    title="Assets in this boundary"
                    description="Every asset is saved before you can add the next one, so the inventory always reflects a complete record."
                    aside={<StatusPill tone={canAdvanceFrom4 ? "success" : "neutral"}>{assets.length} asset{assets.length === 1 ? "" : "s"}</StatusPill>}
                  >
                    {unmappedSystemDataTypeIds.length > 0 && (
                      <Callout
                        tone="warning"
                        title={`${unmappedSystemDataTypeIds.length} data type${unmappedSystemDataTypeIds.length === 1 ? " still needs" : "s still need"} an asset.`}
                      >
                        Use each asset's “Add data type” menu to identify where that data is stored, processed, or transmitted.
                      </Callout>
                    )}

                    <EntityList>
                      {assets.map((a, i) => {
                        const mapped = Object.keys(a.dataTypes).length;
                        const label = a.name.trim() || `Asset ${i + 1}`;
                        return (
                          <EntityCard
                            key={a.key}
                            code={`A${i + 1}`}
                            title={label}
                            summary={`${a.assetType} · ${a.kind.replace(/-/g, " ")} · ${IMPACT_LEVEL_LABELS[a.impactLevel]} impact · ${mapped} data type${mapped === 1 ? "" : "s"}`}
                            expanded={a.expanded}
                            saved={a.saved}
                            onExpand={() => expandAsset(a.key)}
                            onSave={() => saveAsset(a.key)}
                            saveLabel={a.added ? "Save changes" : "Add asset"}
                            canSave={assetDraftIsValid(a)}
                            invalidReason="Enter an asset name and map at least one data type."
                            onRemove={assets.length > 1 ? () => removeAsset(a.key) : undefined}
                            removeLabel={`Remove ${label}`}
                          >
                            <FieldGrid cols={2}>
                              <Field label="Name">
                                <TextInput value={a.name} onChange={(e) => updateAsset(a.key, { name: e.target.value })} aria-label={`Name for asset ${i + 1}`} />
                              </Field>
                              <Field label="Type">
                                <Select value={a.assetType} aria-label={`Type for ${label}`} onChange={(e) => updateAssetType(a.key, e.target.value)}>
                                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </Select>
                              </Field>
                              <Field label="Kind">
                                <Select
                                  value={a.kind}
                                  aria-label={`Kind for ${label}`}
                                  onChange={(e) => {
                                    const kind = ASSET_TYPE_CATEGORIES[a.assetType]?.find((candidate) => candidate === e.target.value);
                                    if (kind) updateAsset(a.key, { kind, sourceType: null, sourceKind: null });
                                  }}
                                >
                                  {ASSET_TYPE_CATEGORIES[a.assetType].map((k) => <option key={k} value={k}>{k.replace(/-/g, " ")}</option>)}
                                </Select>
                              </Field>
                              <Field label="Impact level" note="FIPS 199 potential impact for this component. The system's security category is scored on the boundary, not here.">
                                <Select
                                  value={a.impactLevel}
                                  aria-label={`Impact level for ${label}`}
                                  onChange={(e) => {
                                    const level = IMPACT_LEVELS.find((candidate) => candidate === e.target.value);
                                    if (level) updateAsset(a.key, { impactLevel: level });
                                  }}
                                >
                                  {IMPACT_LEVELS.map((level) => <option key={level} value={level}>{IMPACT_LEVEL_LABELS[level]}</option>)}
                                </Select>
                              </Field>
                            </FieldGrid>

                            <div>
                              <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                                <div className="min-w-0">
                                  <div className={TX.label} style={{ color: C.muted }}>Data processed by this asset</div>
                                  <div className={`${TX.help} mt-1.5`} style={{ color: C.muted }}>Add from the system inventory selected on the previous step.</div>
                                </div>
                                <Select
                                  value=""
                                  onChange={(e) => {
                                    const dataTypeId = systemDataTypeIds.find((candidate) => candidate === e.target.value) ?? "";
                                    addAssetDataType(a.key, dataTypeId);
                                  }}
                                  className="sm:max-w-[220px]"
                                  aria-label={`Add data type to ${label}`}
                                >
                                  <option value="">+ Add data type…</option>
                                  {systemDataTypeIds
                                    .filter((id) => !Object.hasOwn(a.dataTypes, id))
                                    .flatMap((id) => {
                                      const dataType = dataTypes.find((candidate) => candidate.id === id);
                                      return dataType ? [dataType] : [];
                                    })
                                    .map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                                </Select>
                              </div>
                              {Object.keys(a.dataTypes).length > 0 ? (
                                <Well hollow padded={false} className="overflow-hidden">
                                  {Object.entries(a.dataTypes).map(([dataTypeId, role], di, entries) => {
                                    const dt = dataTypes.find((item) => item.id === dataTypeId);
                                    if (!dt) return null;
                                    return (
                                      <div
                                        key={dataTypeId}
                                        className="flex items-center gap-2.5 px-3 py-2"
                                        style={{ borderBottom: di < entries.length - 1 ? `1px solid ${C.border}` : undefined }}
                                      >
                                        <span className={`${TX.body} flex-1 min-w-0 truncate`} style={{ color: C.ink }}>{dt.name}</span>
                                        <span className="shrink-0"><ClassificationTag level={dt.sensitivity} /></span>
                                        <Select
                                          value={role}
                                          aria-label={`Role of ${dt.name} in ${label}`}
                                          onChange={(e) => {
                                            const nextRole = Object.values(DATA_ROLES).find((candidate) => candidate === e.target.value);
                                            if (nextRole) setDataTypeRole(a.key, dt.id, nextRole);
                                          }}
                                          style={{ width: 132, flex: "0 0 auto" }}
                                        >
                                          {Object.values(DATA_ROLES).map((roleOption) => (
                                            <option key={roleOption} value={roleOption}>{DATA_ROLE_META[roleOption].label}</option>
                                          ))}
                                        </Select>
                                        <RemoveButton
                                          label={`Remove ${dt.name} from ${label}`}
                                          onClick={() => removeAssetDataType(a.key, dt.id)}
                                        />
                                      </div>
                                    );
                                  })}
                                </Well>
                              ) : (
                                <EmptyState>No data types mapped to this asset yet.</EmptyState>
                              )}
                            </div>
                          </EntityCard>
                        );
                      })}
                    </EntityList>

                    <AddButton onClick={addAsset} disabled={assets.some((asset) => !asset.saved)}>Add another asset</AddButton>
                  </Section>
                </StepBody>
              </>
            )}

            {step === 5 && (
              <>
                <StepHeader
                  step={5}
                  total={total}
                  title="System architecture"
                  description="Connect the boundary you just described: who reaches it, how data and control relationships move between assets, and which authenticated agents operate inside it."
                />
                <StepBody>
                  <Section
                    icon={Users}
                    title="Actors & access"
                    description="At least one human or machine actor must identify where it touches the boundary."
                    aside={<StatusPill tone={actorsValid ? "success" : "neutral"}>{actorDrafts.length} actor{actorDrafts.length === 1 ? "" : "s"}</StatusPill>}
                  >
                    {actorDrafts.length === 0
                      ? <EmptyState>No actors yet — add at least one so the architecture has a real entry, exit, or administrative path.</EmptyState>
                      : (
                        <EntityList>
                          {actorDrafts.map((actor, i) => {
                            const label = actor.name.trim() || `Actor ${i + 1}`;
                            return (
                              <EntityCard
                                key={actor.key}
                                code={`U${i + 1}`}
                                title={label}
                                summary={`${actor.kind} · ${actor.direction} · ${assetDraftLabel(assets, actor.assetKey)}`}
                                expanded={actor.expanded}
                                saved={actor.saved}
                                onExpand={() => expandActor(actor.key)}
                                onSave={() => saveActor(actor.key)}
                                saveLabel={actor.added ? "Save changes" : "Add actor"}
                                canSave={actorDraftIsValid(actor)}
                                invalidReason="Name, description, and touched asset are required."
                                onRemove={() => removeActor(actor.key)}
                                removeLabel={`Remove ${label}`}
                              >
                                <FieldGrid cols={3}>
                                  <Field label="Actor name">
                                    <TextInput value={actor.name} onChange={(e) => updateActor(actor.key, { name: e.target.value })} placeholder="Customer, administrator, integration" />
                                  </Field>
                                  <Field label="Type">
                                    <Select value={actor.kind} aria-label={`Type for ${label}`} onChange={(e) => updateActor(actor.key, { kind: Object.values(ACTOR_KINDS).find((value) => value === e.target.value) ?? actor.kind })}>
                                      {Object.values(ACTOR_KINDS).map((value) => <option key={value} value={value}>{value}</option>)}
                                    </Select>
                                  </Field>
                                  <Field label="Direction">
                                    <Select value={actor.direction} aria-label={`Direction for ${label}`} onChange={(e) => updateActor(actor.key, { direction: Object.values(ACTOR_DIRECTIONS).find((value) => value === e.target.value) ?? actor.direction })}>
                                      {Object.values(ACTOR_DIRECTIONS).map((value) => <option key={value} value={value}>{value}</option>)}
                                    </Select>
                                  </Field>
                                  <Field label="Touches asset">
                                    <Select value={actor.assetKey} aria-label={`Asset touched by ${label}`} onChange={(e) => updateActor(actor.key, { assetKey: e.target.value })}>
                                      <option value="">Select asset</option>
                                      {assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}
                                    </Select>
                                  </Field>
                                  <Field label="Description">
                                    <TextInput value={actor.description} onChange={(e) => updateActor(actor.key, { description: e.target.value })} placeholder="Role in the architecture" />
                                  </Field>
                                  <Field label="Access note">
                                    <TextInput value={actor.note} onChange={(e) => updateActor(actor.key, { note: e.target.value })} placeholder="Authentication or path detail" />
                                  </Field>
                                </FieldGrid>
                              </EntityCard>
                            );
                          })}
                        </EntityList>
                      )}
                    <AddButton onClick={addActor} disabled={actorDrafts.some((actor) => !actor.saved)}>
                      {actorDrafts.length === 0 ? "Add actor" : "Add another actor"}
                    </AddButton>
                  </Section>

                  <Section
                    icon={Network}
                    title="Asset relationships"
                    description="Flows drive architecture lanes and make data movement traceable."
                    aside={<StatusPill tone={flowsValid ? "success" : "neutral"}>{flowDrafts.length} relationship{flowDrafts.length === 1 ? "" : "s"}</StatusPill>}
                  >
                    {assets.length === 1 ? (
                      <EmptyState>A one-asset boundary does not require an internal relationship.</EmptyState>
                    ) : (
                      <>
                        {flowDrafts.length === 0
                          ? <EmptyState>No relationships yet — add at least one between the assets in this boundary.</EmptyState>
                          : (
                            <EntityList>
                              {flowDrafts.map((flow, i) => (
                                <EntityCard
                                  key={flow.key}
                                  code={`F${i + 1}`}
                                  title={`${assetDraftLabel(assets, flow.fromKey)} → ${assetDraftLabel(assets, flow.toKey)}`}
                                  summary={`${flow.kind.replace(/-/g, " ")} · ${flow.dataTypeIds.length} data type${flow.dataTypeIds.length === 1 ? "" : "s"}`}
                                  expanded={flow.expanded}
                                  saved={flow.saved}
                                  onExpand={() => expandFlow(flow.key)}
                                  onSave={() => saveFlow(flow.key)}
                                  saveLabel={flow.added ? "Save changes" : "Add relationship"}
                                  canSave={flowDraftIsValid(flow)}
                                  invalidReason="Connect two different assets and carry at least one data type."
                                  onRemove={() => removeFlow(flow.key)}
                                  removeLabel={`Remove relationship ${i + 1}`}
                                >
                                  <FieldGrid cols={3}>
                                    <Field label="From" error={flow.fromKey === flow.toKey ? "A relationship must connect two different assets." : null}>
                                      <Select value={flow.fromKey} aria-label={`Source asset for relationship ${i + 1}`} onChange={(e) => updateFlow(flow.key, { fromKey: e.target.value })}>
                                        {assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="Relationship">
                                      <Select value={flow.kind} aria-label={`Kind for relationship ${i + 1}`} onChange={(e) => updateFlow(flow.key, { kind: Object.values(FLOW_KINDS).find((value) => value === e.target.value) ?? flow.kind })}>
                                        {Object.values(FLOW_KINDS).map((value) => <option key={value} value={value}>{value.replace(/-/g, " ")}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="To">
                                      <Select value={flow.toKey} aria-label={`Target asset for relationship ${i + 1}`} onChange={(e) => updateFlow(flow.key, { toKey: e.target.value })}>
                                        {assets.map((asset, index) => <option key={asset.key} value={asset.key}>{asset.name || `Asset ${index + 1}`}</option>)}
                                      </Select>
                                    </Field>
                                  </FieldGrid>
                                  <FieldGrid cols={1}>
                                    <Field label="Data carried">
                                      <div className="flex flex-wrap gap-2">
                                        {systemDataTypeIds.map((id) => {
                                          const dataType = dataTypes.find((item) => item.id === id);
                                          const selected = flow.dataTypeIds.includes(id);
                                          return (
                                            <ChoiceChip
                                              key={id}
                                              selected={selected}
                                              ariaLabel={dataType?.name ?? id}
                                              onClick={() => updateFlow(flow.key, { dataTypeIds: selected ? flow.dataTypeIds.filter((item) => item !== id) : [...flow.dataTypeIds, id] })}
                                            >
                                              <span className="normal-case">{dataType?.name ?? id}</span>
                                            </ChoiceChip>
                                          );
                                        })}
                                      </div>
                                    </Field>
                                    <Field label="Relationship note">
                                      <TextInput value={flow.note} onChange={(e) => updateFlow(flow.key, { note: e.target.value })} placeholder="What moves or is protected" />
                                    </Field>
                                  </FieldGrid>
                                </EntityCard>
                              ))}
                            </EntityList>
                          )}
                        <AddButton onClick={addFlow} disabled={flowDrafts.some((flow) => !flow.saved)}>
                          {flowDrafts.length === 0 ? "Add relationship" : "Add another relationship"}
                        </AddButton>
                      </>
                    )}
                  </Section>

                  {usesAI && (
                    <Section
                      icon={Bot}
                      title="Agentic identities"
                      description="Optional: record authenticated AI agents that can invoke tools or affect resources."
                      aside={<StatusPill tone={agentDrafts.length > 0 && agentsValid ? "success" : "neutral"}>{agentDrafts.length} agent{agentDrafts.length === 1 ? "" : "s"}</StatusPill>}
                    >
                      {agentDrafts.length === 0
                        ? <EmptyState>No agentic identity declared. AI use alone does not imply an agent can take action.</EmptyState>
                        : (
                          <EntityList>
                            {agentDrafts.map((agent, i) => {
                              const label = agent.name.trim() || `Agent ${i + 1}`;
                              return (
                                <EntityCard
                                  key={agent.key}
                                  code={`G${i + 1}`}
                                  title={label}
                                  summary={`${agent.autonomyLevel} · ${agent.privilegeLevel} privilege · ${agent.credentialType.replace(/-/g, " ")}`}
                                  expanded={agent.expanded}
                                  saved={agent.saved}
                                  onExpand={() => expandAgent(agent.key)}
                                  onSave={() => saveAgent(agent.key)}
                                  saveLabel={agent.added ? "Save changes" : "Add agent"}
                                  canSave={agentDraftIsValid(agent, autonomousActions)}
                                  invalidReason="Name, purpose, service principal, and tools are required."
                                  onRemove={() => removeAgent(agent.key)}
                                  removeLabel={`Remove ${label}`}
                                >
                                  <FieldGrid cols={3}>
                                    <Field label="Agent name">
                                      <TextInput value={agent.name} onChange={(e) => updateAgent(agent.key, { name: e.target.value })} aria-label={`Name for agent ${i + 1}`} />
                                    </Field>
                                    <Field label="Service principal">
                                      <TextInput value={agent.servicePrincipal} onChange={(e) => updateAgent(agent.key, { servicePrincipal: e.target.value })} placeholder="spn://system/agent" />
                                    </Field>
                                    <Field label="Owner">
                                      <Select value={agent.ownerOrgId} aria-label={`Owner for ${label}`} onChange={(e) => updateAgent(agent.key, { ownerOrgId: e.target.value })}>
                                        <option value="">Unassigned</option>
                                        {ORGS.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="Autonomy">
                                      <Select
                                        value={agent.autonomyLevel}
                                        aria-label={`Autonomy for ${label}`}
                                        onChange={(e) => updateAgent(agent.key, {
                                          autonomyLevel: AGENT_AUTONOMY_LEVELS.find((value) => value === e.target.value) ?? agent.autonomyLevel,
                                          externalActions: e.target.value === "recommend" ? false : agent.externalActions,
                                        })}
                                      >
                                        {AGENT_AUTONOMY_LEVELS.filter((value) => value !== "autonomous" || autonomousActions).map((value) => <option key={value} value={value}>{value}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="Privilege">
                                      <Select value={agent.privilegeLevel} aria-label={`Privilege for ${label}`} onChange={(e) => updateAgent(agent.key, { privilegeLevel: AGENT_PRIVILEGE_LEVELS.find((value) => value === e.target.value) ?? agent.privilegeLevel })}>
                                        {AGENT_PRIVILEGE_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="Credential">
                                      <Select value={agent.credentialType} aria-label={`Credential for ${label}`} onChange={(e) => updateAgent(agent.key, { credentialType: AGENT_CREDENTIAL_TYPES.find((value) => value === e.target.value) ?? agent.credentialType })}>
                                        {AGENT_CREDENTIAL_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                                      </Select>
                                    </Field>
                                    <Field label="Purpose">
                                      <TextInput value={agent.purpose} onChange={(e) => updateAgent(agent.key, { purpose: e.target.value })} placeholder="What this agent is for" />
                                    </Field>
                                    <Field label="Tools / resources">
                                      <TextInput value={agent.tools} onChange={(e) => updateAgent(agent.key, { tools: e.target.value })} placeholder="Search, tickets, deployment" />
                                    </Field>
                                    <Field label="Revocation">
                                      <Select value={agent.revocationMechanism} aria-label={`Revocation for ${label}`} onChange={(e) => updateAgent(agent.key, { revocationMechanism: AGENT_REVOCATION_MECHANISMS.find((value) => value === e.target.value) ?? agent.revocationMechanism })}>
                                        {AGENT_REVOCATION_MECHANISMS.map((value) => <option key={value} value={value}>{value}</option>)}
                                      </Select>
                                    </Field>
                                  </FieldGrid>
                                  <Well hollow className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                                    <CheckRow
                                      checked={agent.externalActions}
                                      onChange={(checked) => updateAgent(agent.key, { externalActions: checked })}
                                      label="External actions"
                                    />
                                    <CheckRow
                                      checked={agent.canImpersonateUser}
                                      onChange={(checked) => updateAgent(agent.key, { canImpersonateUser: checked })}
                                      label="Can impersonate user"
                                    />
                                    <CheckRow
                                      checked={agent.loggingEnabled}
                                      onChange={(checked) => updateAgent(agent.key, { loggingEnabled: checked })}
                                      label="Activity logging"
                                    />
                                  </Well>
                                </EntityCard>
                              );
                            })}
                          </EntityList>
                        )}
                      <AddButton onClick={addAgent} disabled={agentDrafts.some((agent) => !agent.saved)}>
                        {agentDrafts.length === 0 ? "Add agent" : "Add another agent"}
                      </AddButton>
                    </Section>
                  )}
                </StepBody>
              </>
            )}

            {step === 6 && (
              <>
                <StepHeader
                  step={6}
                  total={total}
                  title="Resilience & secure development"
                  description="Optional operational posture: backup configuration, proven disaster-recovery tests, and secure-development safeguards. Leave a section off if it hasn't actually been set up yet — an absent record reads honestly as “not yet on record”, not a fabricated zero."
                />
                <StepBody>
                  <Section icon={DatabaseBackup} title="Backup & recovery" description="How durable this system's data is, and how quickly it can be restored.">
                    <ToggleCard
                      checked={trackBackup}
                      onChange={setTrackBackup}
                      title="Backup configuration on record"
                      description="Turn this on once a backup job actually exists for this system."
                    >
                      {trackBackup && (
                        <div className="flex flex-col gap-4">
                          <FieldGrid cols={3}>
                            <Field label="Coverage %" note="Share of in-scope assets actually covered by a backup job." error={coverageError}>
                              <TextInput type="number" min={0} max={100} value={backupCoveragePct} onChange={(e) => setBackupCoveragePct(e.target.value)} />
                            </Field>
                            <Field label="RPO target (minutes)" error={rpoError}>
                              <TextInput type="number" min={1} value={backupRpoTargetMinutes} onChange={(e) => setBackupRpoTargetMinutes(e.target.value)} />
                            </Field>
                            <Field label="RTO target (minutes)" error={rtoError}>
                              <TextInput type="number" min={1} value={backupRtoTargetMinutes} onChange={(e) => setBackupRtoTargetMinutes(e.target.value)} />
                            </Field>
                          </FieldGrid>
                          <Well hollow className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                            <CheckRow checked={backupEnabled} onChange={setBackupEnabled} label="Backups enabled" />
                            <CheckRow checked={backupImmutable} onChange={setBackupImmutable} label="Immutable backups" />
                            <CheckRow checked={backupCrossRegion} onChange={setBackupCrossRegion} label="Cross-region copy" />
                          </Well>
                        </div>
                      )}
                    </ToggleCard>
                  </Section>

                  <Section
                    icon={History}
                    title="Disaster recovery tests"
                    description="Proven restores, not just a green backup job — add one row per test conducted."
                    aside={<StatusPill tone={drTestDrafts.length > 0 && drTestsValid ? "success" : "neutral"}>{drTestDrafts.length} test{drTestDrafts.length === 1 ? "" : "s"}</StatusPill>}
                  >
                    {drTestDrafts.length === 0
                      ? <EmptyState>No disaster-recovery test on record yet.</EmptyState>
                      : (
                        <EntityList>
                          {drTestDrafts.map((t, i) => (
                            <EntityCard
                              key={t.key}
                              code={`DR${i + 1}`}
                              title={`DR test ${i + 1}`}
                              summary={`${t.conductedAt || "no date"} · ${t.restoreSuccessful ? "restore succeeded" : "restore failed"} · every ${t.cadenceDays} days`}
                              expanded={t.expanded}
                              saved={t.saved}
                              onExpand={() => expandDrTest(t.key)}
                              onSave={() => saveDrTest(t.key)}
                              saveLabel="Save test"
                              canSave={drTestDraftIsValid(t)}
                              invalidReason="Enter a scope, a valid date, and — if the restore failed — what went wrong."
                              onRemove={() => removeDrTest(t.key)}
                              removeLabel={`Remove DR test ${i + 1}`}
                            >
                              <FieldGrid cols={3}>
                                <Field label="Conducted">
                                  <TextInput type="date" value={t.conductedAt} aria-label={`Date of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { conductedAt: e.target.value })} />
                                </Field>
                                <Field label="Cadence (days)">
                                  <TextInput type="number" min={1} value={t.cadenceDays} aria-label={`Cadence of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { cadenceDays: e.target.value })} />
                                </Field>
                                <Field label="Restore successful">
                                  <Select value={t.restoreSuccessful ? "yes" : "no"} aria-label={`Restore outcome of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { restoreSuccessful: e.target.value === "yes" })}>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </Select>
                                </Field>
                                <Field label="Actual RPO (minutes)">
                                  <TextInput type="number" min={0} value={t.actualRpoMinutes} aria-label={`Actual RPO of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { actualRpoMinutes: e.target.value })} />
                                </Field>
                                <Field label="Actual RTO (minutes)">
                                  <TextInput type="number" min={0} value={t.actualRtoMinutes} aria-label={`Actual RTO of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { actualRtoMinutes: e.target.value })} />
                                </Field>
                                <Field label="Scope">
                                  <TextInput value={t.scope} aria-label={`Scope of DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { scope: e.target.value })} placeholder="What this test exercised" />
                                </Field>
                              </FieldGrid>
                              {!t.restoreSuccessful && (
                                <FieldGrid cols={1}>
                                  <Field
                                    label="Issues"
                                    note="Required when the restore didn't succeed — what went wrong."
                                    error={t.issues.trim() ? null : "Describe what went wrong."}
                                  >
                                    <TextArea value={t.issues} aria-label={`Issues from DR test ${i + 1}`} onChange={(e) => updateDrTest(t.key, { issues: e.target.value })} />
                                  </Field>
                                </FieldGrid>
                              )}
                            </EntityCard>
                          ))}
                        </EntityList>
                      )}
                    <AddButton onClick={addDrTest} disabled={drTestDrafts.some((t) => !t.saved)}>
                      {drTestDrafts.length === 0 ? "Add DR test" : "Add another DR test"}
                    </AddButton>
                  </Section>

                  <Section icon={Code2} title="Secure development posture" description={`Only meaningful if ACME writes code for this system — see “Custom software” on the Technology step.`}>
                    <ToggleCard
                      checked={trackSdlc}
                      onChange={setTrackSdlc}
                      title="Secure-development posture on record"
                      description="Turn this on once someone has actually reviewed this system's SDLC safeguards."
                    >
                      {trackSdlc && (sdlcApplicable ? (
                        <div className="flex flex-col gap-4">
                          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                            {SDLC_SAFEGUARD_GROUPS.map((group) => (
                              <Well key={group.label} className="flex flex-col gap-2.5">
                                <div className={TX.label} style={{ color: C.muted }}>{group.label}</div>
                                {group.keys.map((key) => (
                                  <CheckRow
                                    key={key}
                                    checked={sdlcSafeguards[key]}
                                    onChange={(checked) => updateSdlcSafeguard(key, checked)}
                                    label={SDLC_SAFEGUARD_LABELS[key]}
                                  />
                                ))}
                              </Well>
                            ))}
                          </div>
                          <FieldGrid cols={3}>
                            <Field label="Last threat model" note="Optional — leave blank if none is on record.">
                              <TextInput type="date" value={lastThreatModelAt} onChange={(e) => setLastThreatModelAt(e.target.value)} />
                            </Field>
                          </FieldGrid>
                        </div>
                      ) : (
                        <FieldGrid cols={1}>
                          <Field
                            label="Not-applicable reason"
                            note="Required — why secure-development controls don't apply to this system."
                            error={sdlcValid ? null : "A reason is required."}
                          >
                            <TextArea value={sdlcNotApplicableReason} onChange={(e) => setSdlcNotApplicableReason(e.target.value)} />
                          </Field>
                        </FieldGrid>
                      ))}
                    </ToggleCard>
                  </Section>
                </StepBody>
              </>
            )}

            {step === 7 && (
              <>
                <StepHeader
                  step={7}
                  total={total}
                  title="Derived scope"
                  description="Classification and the four review buckets are derived from your entries. Nothing here is a claimed assessment — an assessor confirms and grades these controls on the system screen after create."
                />

                {checking && <Callout tone="info" title="Checking…">Recomputing the derived scope from your entries.</Callout>}

                {!checking && dryRun && dryRun.problems.length === 0 && (
                  <StepBody>
                    <Section icon={Gauge} title="Derived posture" description="Computed from the facts you entered — not a recorded assessment result.">
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                        <StatTile
                          label="Classification"
                          value={dryRun.classification ?? "—"}
                          aside={dryRun.classification ? <ClassificationTag level={dryRun.classification} /> : undefined}
                        />
                        <StatTile
                          label="Proposed assurance"
                          hint="Unconfirmed"
                          value={`${dryRun.assurance ?? "—"}${dryRun.assurance != null ? "%" : ""}`}
                          aside={dryRun.assurance != null ? <AssuranceBadge pct={dryRun.assurance} size={34} /> : undefined}
                        />
                        <StatTile
                          label="Audit-ready preview"
                          value={<span className="capitalize">{(dryRun.readinessLabel ?? "scope-unconfirmed").replace(/-/g, " ")}</span>}
                        />
                      </div>
                    </Section>

                    {dryRun.applicability && (
                      <Section
                        icon={ClipboardCheck}
                        title={`${dryRun.applicability.applicable} applicable controls`}
                        description="Derived from framework scope, assets, exposure and declared operating characteristics."
                        aside={<StatusPill tone="neutral">{dryRun.applicability.pending} pending review</StatusPill>}
                      >
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                          {([
                            ["System owned", dryRun.applicability.byResponsibility.owned],
                            ["Shared", dryRun.applicability.byResponsibility.shared],
                            ["Enterprise", dryRun.applicability.byResponsibility.enterprise],
                            ["Vendor", dryRun.applicability.byResponsibility.vendor],
                          ] as const).map(([label, value]) => (
                            <StatTile key={label} label={label} value={value} />
                          ))}
                        </div>
                      </Section>
                    )}

                    {dryRun.proposedWaves && (
                      <Section
                        icon={ListChecks}
                        title="Proposed review queues"
                        description="After create, the assessor walks these in Scope Review. The wizard does not grade controls."
                      >
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                          {([
                            ["Not applicable", dryRun.proposedWaves.notApplicable, "Confirm the derived exclusions"],
                            ["External inherited", dryRun.proposedWaves.vendorInherited, "Confirm the provider split"],
                            ["Internal inherited", dryRun.proposedWaves.companyLevel, "Confirm program incorporation"],
                            ["Remaining technical", dryRun.proposedWaves.remainingTechnical, "PRISMA grade what ACME still owns"],
                          ] as const).map(([label, value, hint]) => (
                            <StatTile key={label} label={label} value={value} hint={hint} />
                          ))}
                        </div>
                      </Section>
                    )}

                    <Callout tone="success" title="Derived scope validated.">
                      Continue to assign the assessor, then confirm and grade controls on the system screen.
                    </Callout>
                  </StepBody>
                )}

                {!checking && dryRun && dryRun.problems.length > 0 && (
                  <StepBody>
                    <Callout tone="danger" title={`${dryRun.problems.length} problem${dryRun.problems.length === 1 ? "" : "s"} found.`}>
                      Fix these before this system can be {editingSystemId ? "saved" : "created"}.
                    </Callout>
                    <Section icon={AlertTriangle} title="What the graph rejected" description="Each line comes from the same validators that guard the committed graph.">
                      <Well padded={false} className="overflow-hidden">
                        {dryRun.problems.map((p, i) => (
                          <div
                            key={i}
                            className="px-3.5 py-2.5"
                            style={{ borderBottom: i < dryRun.problems.length - 1 ? `1px solid ${C.border}` : undefined }}
                          >
                            <InlineHint tone="danger">{p}</InlineHint>
                          </div>
                        ))}
                      </Well>
                    </Section>
                  </StepBody>
                )}
              </>
            )}

            {step === 8 && (
              <>
                <StepHeader
                  step={8}
                  total={total}
                  title="Launch assessment"
                  description={`Assign the assessment and set its target date. ${editingSystemId ? "Saving recalculates the system's scope without changing its recorded evidence." : "Creating the system opens Scope Review. External- and internal-inherited coverage stay unclaimed until an assessor confirms them."}`}
                />
                <StepBody>
                  <Section icon={Gauge} title="Initial assessment plan" description="What the engine will propose the moment this system exists.">
                    <Callout tone="info" title="Proposed, not claimed.">
                      Controls in {provider || "the chosen provider"}'s certified domains are proposed as vendor-inherited from its
                      reports. They are not a standing claim until an assessor confirms that split on the system screen.
                    </Callout>
                  </Section>

                  <Section icon={UserCheck} title="Assessment assignment" description="Who is accountable for the evidence, and when the assessment period ends.">
                    <FieldGrid cols={2}>
                      <Field label="Assessor of record" note="The person accountable for reviewing the evidence and recording the assessment.">
                        <TextInput value={assessor} onChange={(e) => setAssessor(e.target.value)} placeholder="e.g. J. Ortiz — Security Engineering" />
                      </Field>
                      <Field label="Target completion" note="The assessment period ends on this date.">
                        <TextInput type="date" value={assessmentTarget} onChange={(e) => setAssessmentTarget(e.target.value)} />
                      </Field>
                    </FieldGrid>
                  </Section>
                </StepBody>
              </>
            )}
          </div>
        </WizardBody>

        <WizardFooter
          position={`Step ${step} of ${total}`}
          hint={blockReason ? <InlineHint tone="warning">{blockReason}</InlineHint> : undefined}
        >
          <Button icon={ChevronLeft} onClick={goBack} disabled={step === 1}>Back</Button>
          {!isLastStep ? (
            <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={nextDisabled}>Next</Button>
          ) : (
            <Button
              variant="primary"
              icon={Check}
              onClick={handleCreate}
              disabled={!dryRun || dryRun.problems.length > 0 || !canLaunch || saving}
            >
              {saving ? "Saving…" : editingSystemId ? "Save changes" : "Create system"}
            </Button>
          )}
        </WizardFooter>
      </WizardChrome>
    </Modal>
  );
}
