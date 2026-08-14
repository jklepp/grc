// Key controls — the subset of the SCF library ACME operates and evidences
// individually, rather than covering at the domain level through a procedure.
//
// This file is the answer to a sizing problem with a real integrity dimension.
// The full crosswalk is 518 controls; 323 are in scope for the standards ACME
// certifies against. Authoring an implementation record for every one of those
// against all 15 assets would mean ~4,800 rows that nobody assessed — the
// machine-generated posture this app has always refused to ship. So the model
// draws an explicit line instead:
//
//   - 26 key controls are implemented and evidenced PER ASSET (or per program,
//     see `scope`), and produce numbers with a "measured" basis.
//   - Every other in-scope control resolves through its domain's assurance
//     category to the asset's category-level assessment, and produces numbers
//     with an "assessed" basis.
//
// Both are honest; they're just different strengths of claim, and the engine
// reports which one you're looking at. engine/rollups.js also emits
// controlBackedPct per asset, so "how much of this score rests on control-level
// evidence" is itself a visible number rather than an assumption.
//
// The six controls systemRegister.js previously tracked by array index
// (TRACKED_CONTROL_SCF_IDS, paired positionally with a CONTROLS name array)
// are all here, keeping continuity with the figures those pages showed. They're
// marked `legacyTracked` so the migration can be checked rather than trusted.
//
// `scope` matters more than it looks. Some controls are genuinely per-resource
// ("is this bucket encrypted"); others are program-level and asking each asset
// to answer them separately would be theatre ("does ACME run a risk assessment
// process"). Program-scoped controls carry exactly one implementation record
// for the enterprise. Getting this wrong in the other direction — treating a
// program control as per-asset — is how control matrices end up with hundreds
// of duplicate rows that all mean the same thing.
//
// `category` and `domain` are NOT typed here. They're read from the control's
// own SCF definition, so a key control can't claim a category its domain
// doesn't actually map to.
import { CONTROL_BY_ID } from "./controls";

export const CONTROL_SCOPES = { ASSET: "asset", PROGRAM: "program" };

const KEY_CONTROL_DEFS = [
  // ---- Data Protection -------------------------------------------------------
  { id: "CRY-05", friendlyName: "Encryption at Rest", scope: "asset", legacyTracked: true },
  { id: "CRY-03", friendlyName: "Encryption in Transit", scope: "asset", legacyTracked: true },
  { id: "CRY-09", friendlyName: "Cryptographic Key Management", scope: "asset" },
  { id: "DCH-18", friendlyName: "Retention & Disposal", scope: "asset", legacyTracked: true },
  { id: "DCH-02", friendlyName: "Data & Asset Classification", scope: "program" },
  { id: "PRI-05", friendlyName: "Personal Data Retention & Disposal", scope: "program" },

  // ---- Configuration ---------------------------------------------------------
  { id: "CFG-02", friendlyName: "Secure Baseline Configuration", scope: "asset" },
  { id: "CFG-03", friendlyName: "Least Functionality", scope: "asset" },
  { id: "CHG-02", friendlyName: "Configuration Change Control", scope: "asset" },
  { id: "CLD-06", friendlyName: "Multi-Tenant Isolation", scope: "asset" },
  { id: "AST-02", friendlyName: "Asset Inventory", scope: "program" },

  // ---- Detection -------------------------------------------------------------
  { id: "MON-02", friendlyName: "Access Logging & Review", scope: "asset", legacyTracked: true },
  { id: "MON-03", friendlyName: "Event Log Content", scope: "asset" },
  { id: "MON-08", friendlyName: "Protection of Event Logs", scope: "asset" },
  { id: "VPM-05", friendlyName: "Software & Firmware Patching", scope: "asset" },
  { id: "IRO-02", friendlyName: "Incident Handling", scope: "program" },

  // ---- Identity & Access -----------------------------------------------------
  { id: "IAC-21", friendlyName: "Least-Privilege Access", scope: "asset", legacyTracked: true },
  { id: "IAC-17", friendlyName: "Periodic Access Review", scope: "asset" },
  { id: "IAC-10", friendlyName: "Authenticator Management", scope: "asset" },
  { id: "IAC-20", friendlyName: "Access Enforcement", scope: "asset" },
  { id: "NET-03", friendlyName: "Boundary Protection", scope: "asset" },
  { id: "NET-17", friendlyName: "DLP Monitoring", scope: "asset", legacyTracked: true },

  // ---- Governance ------------------------------------------------------------
  // Every Governance key control is program-scoped, and that is the honest
  // answer rather than an omission: running a risk assessment or governing the
  // AI lifecycle is something ACME does once, not something each S3 bucket does
  // separately. The consequence is real and worth stating — no asset's
  // Governance category is ever control-backed, so every asset carries an
  // "assessed" basis there. Model Health surfaces that rather than hiding it.
  { id: "RSK-04", friendlyName: "Risk Assessment", scope: "program" },
  { id: "TPM-04", friendlyName: "Third-Party Services", scope: "program" },
  { id: "AAT-01", friendlyName: "AI & Autonomous Technology Governance", scope: "program" },

  // ---- Resilience ------------------------------------------------------------
  { id: "BCD-11", friendlyName: "Data Backups", scope: "asset" },
  { id: "CAP-01", friendlyName: "Capacity & Performance Management", scope: "asset" },
];

export const KEY_CONTROLS = KEY_CONTROL_DEFS.map((def) => {
  const control = CONTROL_BY_ID[def.id];
  if (!control) {
    throw new Error(`keyControls.js: "${def.id}" is not a control in scfControls.json — a key control must reference a real SCF id`);
  }
  return {
    ...def,
    domain: control.domain,
    category: control.category,
    name: control.name,
    description: control.description,
    frameworks: control.frameworks,
    implementationType: control.implementationType,
    toolHint: control.toolHint,
  };
});

export const KEY_CONTROL_BY_ID = Object.fromEntries(KEY_CONTROLS.map((c) => [c.id, c]));
export const KEY_CONTROL_IDS = KEY_CONTROLS.map((c) => c.id);

export const ASSET_SCOPED_CONTROLS = KEY_CONTROLS.filter((c) => c.scope === CONTROL_SCOPES.ASSET);
export const PROGRAM_SCOPED_CONTROLS = KEY_CONTROLS.filter((c) => c.scope === CONTROL_SCOPES.PROGRAM);

export function isKeyControl(controlId) {
  return Object.hasOwn(KEY_CONTROL_BY_ID, controlId);
}

export function keyControlsForCategory(category) {
  return KEY_CONTROLS.filter((c) => c.category === category);
}
