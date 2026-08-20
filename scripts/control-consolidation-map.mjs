// ACME common-control catalog: 20 domains, 100 surviving controls.
// Each group names the surviving id, the domain it lives in, and the in-scope
// SCF controls absorbed into it (including itself). Framework clauses are
// unioned from every absorbed control when the catalog is generated.

export const DOMAIN_ORDER = [
  "Governance",
  "Risk Management",
  "AI & Autonomous Technologies",
  "Asset Management",
  "Identity & Access",
  "Data Protection",
  "Privacy",
  "Configuration Management",
  "Change & Cloud Security",
  "Detection & Monitoring",
  "Endpoint Security",
  "Vulnerability Management",
  "Incident Response",
  "Business Continuity",
  "Capacity & Performance",
  "Physical & Maintenance",
  "Network & Web Security",
  "Secure Development",
  "People Security",
  "Third-Party Management",
];

/** @type {Array<{ id: string, domain: string, name?: string, absorbs: string[] }>} */
export const GROUPS = [
  // Governance (GOV + CPL + IAO + PRM)
  { id: "GOV-01", domain: "Governance", absorbs: ["GOV-01", "GOV-02", "GOV-03", "GOV-04", "GOV-08", "GOV-14", "GOV-15"] },
  { id: "GOV-05", domain: "Governance", absorbs: ["GOV-05", "GOV-17"] },
  { id: "GOV-09", domain: "Governance", absorbs: ["GOV-09", "GOV-10", "GOV-11"] },
  { id: "CPL-01", domain: "Governance", absorbs: ["CPL-01", "CPL-02", "CPL-12", "GOV-16", "GOV-06", "GOV-07"] },
  { id: "CPL-03", domain: "Governance", absorbs: ["CPL-03", "CPL-04", "IAO-02", "IAO-07"] },
  { id: "PRM-07", domain: "Governance", name: "Security Program Resourcing & SDLC", absorbs: ["PRM-01", "PRM-02", "PRM-03", "PRM-04", "PRM-05", "PRM-06", "PRM-07", "IAO-01", "IAO-03"] },
  { id: "IAO-04", domain: "Governance", absorbs: ["IAO-04", "IAO-05", "IAO-06"] },

  // Risk Management
  { id: "RSK-01", domain: "Risk Management", absorbs: ["RSK-01", "RSK-02", "RSK-03"] },
  { id: "RSK-04", domain: "Risk Management", absorbs: ["RSK-04", "RSK-05", "RSK-07"] },
  { id: "RSK-06", domain: "Risk Management", absorbs: ["RSK-06", "RSK-08", "RSK-09", "RSK-10"] },

  // AI
  { id: "AAT-01", domain: "AI & Autonomous Technologies", absorbs: ["AAT-01", "AAT-03", "AAT-04", "AAT-08", "AAT-14"] },
  { id: "AAT-07", domain: "AI & Autonomous Technologies", absorbs: ["AAT-07", "AAT-09", "AAT-18"] },
  { id: "AAT-10", domain: "AI & Autonomous Technologies", absorbs: ["AAT-10", "AAT-15"] },
  { id: "AAT-16", domain: "AI & Autonomous Technologies", absorbs: ["AAT-16", "AAT-02", "AAT-11"] },
  { id: "AAT-17", domain: "AI & Autonomous Technologies", absorbs: ["AAT-17", "AAT-05", "AAT-12", "AAT-13"] },

  // Asset Management
  { id: "AST-01", domain: "Asset Management", absorbs: ["AST-01", "AST-03"] },
  { id: "AST-02", domain: "Asset Management", absorbs: ["AST-02", "AST-04"] },
  { id: "AST-05", domain: "Asset Management", absorbs: ["AST-05", "AST-06", "AST-07", "AST-08", "AST-12", "AST-15"] },
  { id: "AST-09", domain: "Asset Management", absorbs: ["AST-09", "AST-10", "AST-11"] },

  // Identity & Access
  { id: "IAC-01", domain: "Identity & Access", absorbs: ["IAC-01", "IAC-02", "IAC-03", "IAC-09", "IAC-18"] },
  { id: "IAC-06", domain: "Identity & Access", absorbs: ["IAC-06", "IAC-13"] },
  { id: "IAC-07", domain: "Identity & Access", absorbs: ["IAC-07", "IAC-15", "IAC-28", "IAC-05"] },
  { id: "IAC-10", domain: "Identity & Access", absorbs: ["IAC-10", "IAC-12", "IAC-19"] },
  { id: "IAC-16", domain: "Identity & Access", absorbs: ["IAC-16"] },
  { id: "IAC-17", domain: "Identity & Access", absorbs: ["IAC-17"] },
  { id: "IAC-20", domain: "Identity & Access", absorbs: ["IAC-20", "IAC-14", "IAC-22", "IAC-24", "IAC-25"] },
  { id: "IAC-21", domain: "Identity & Access", absorbs: ["IAC-21", "IAC-08"] },
  { id: "MDM-01", domain: "Identity & Access", name: "Device Trust & Mobile Management", absorbs: ["MDM-01", "MDM-02", "MDM-03", "MDM-05", "IAC-04"] },

  // Data Protection
  { id: "DCH-01", domain: "Data Protection", absorbs: ["DCH-01", "DCH-14", "DCH-15", "DCH-17", "DCH-22", "DCH-23"] },
  { id: "DCH-02", domain: "Data Protection", absorbs: ["DCH-02", "DCH-11", "DCH-04"] },
  { id: "DCH-18", domain: "Data Protection", absorbs: ["DCH-18", "DCH-21"] },
  { id: "DCH-09", domain: "Data Protection", absorbs: ["DCH-03", "DCH-06", "DCH-07", "DCH-08", "DCH-09", "DCH-10", "DCH-12"] },
  { id: "DCH-19", domain: "Data Protection", absorbs: ["DCH-19", "DCH-13", "DCH-24"] },
  { id: "CRY-03", domain: "Data Protection", absorbs: ["CRY-03", "CRY-04", "CRY-07"] },
  { id: "CRY-05", domain: "Data Protection", absorbs: ["CRY-01", "CRY-05", "CRY-06"] },
  { id: "CRY-09", domain: "Data Protection", absorbs: ["CRY-08", "CRY-09", "CRY-02"] },

  // Privacy
  { id: "PRI-01", domain: "Privacy", absorbs: ["PRI-01", "PRI-08", "PRI-14"] },
  { id: "PRI-02", domain: "Privacy", absorbs: ["PRI-02", "PRI-03"] },
  { id: "PRI-04", domain: "Privacy", absorbs: ["PRI-04", "PRI-10", "PRI-12"] },
  { id: "PRI-05", domain: "Privacy", absorbs: ["PRI-05"] },
  { id: "PRI-06", domain: "Privacy", absorbs: ["PRI-06", "PRI-07", "PRI-17", "PRI-18"] },

  // Configuration Management
  { id: "CFG-01", domain: "Configuration Management", absorbs: ["CFG-01", "CFG-04", "CFG-05", "CFG-08"] },
  { id: "CFG-02", domain: "Configuration Management", absorbs: ["CFG-02"] },
  { id: "CFG-03", domain: "Configuration Management", absorbs: ["CFG-03"] },

  // Change & Cloud Security
  { id: "CHG-01", domain: "Change & Cloud Security", absorbs: ["CHG-01", "CHG-05"] },
  { id: "CHG-02", domain: "Change & Cloud Security", absorbs: ["CHG-02", "CHG-03", "CHG-04", "CHG-06"] },
  { id: "CLD-01", domain: "Change & Cloud Security", absorbs: ["CLD-01", "CLD-02", "CLD-09", "CLD-11"] },
  { id: "CLD-04", domain: "Change & Cloud Security", absorbs: ["CLD-04"] },
  { id: "CLD-06", domain: "Change & Cloud Security", absorbs: ["CLD-06", "CLD-12"] },

  // Detection & Monitoring
  { id: "MON-01", domain: "Detection & Monitoring", absorbs: ["MON-01", "MON-06", "MON-11", "MON-15", "MON-16"] },
  { id: "MON-02", domain: "Detection & Monitoring", absorbs: ["MON-02", "MON-05"] },
  { id: "MON-03", domain: "Detection & Monitoring", absorbs: ["MON-03", "MON-07"] },
  { id: "MON-08", domain: "Detection & Monitoring", absorbs: ["MON-08", "MON-10"] },
  { id: "THR-01", domain: "Detection & Monitoring", name: "Threat Intelligence", absorbs: ["THR-01", "THR-02", "THR-03", "THR-04", "THR-06", "THR-09", "THR-10"] },
  { id: "OPS-01", domain: "Detection & Monitoring", absorbs: ["OPS-01", "OPS-02", "OPS-03", "OPS-05"] },

  // Endpoint Security
  { id: "END-01", domain: "Endpoint Security", absorbs: ["END-01", "END-03", "END-16"] },
  { id: "END-02", domain: "Endpoint Security", absorbs: ["END-02", "END-04", "END-05"] },
  { id: "END-06", domain: "Endpoint Security", absorbs: ["END-06", "END-07"] },
  { id: "END-08", domain: "Endpoint Security", absorbs: ["END-08", "END-09"] },

  // Vulnerability Management
  { id: "VPM-01", domain: "Vulnerability Management", absorbs: ["VPM-01", "VPM-02", "VPM-03", "VPM-04"] },
  { id: "VPM-05", domain: "Vulnerability Management", absorbs: ["VPM-05"] },
  { id: "VPM-06", domain: "Vulnerability Management", absorbs: ["VPM-06"] },
  { id: "VPM-07", domain: "Vulnerability Management", absorbs: ["VPM-07"] },

  // Incident Response
  { id: "IRO-01", domain: "Incident Response", absorbs: ["IRO-01", "IRO-07", "IRO-09"] },
  { id: "IRO-02", domain: "Incident Response", absorbs: ["IRO-02", "IRO-08", "IRO-12"] },
  { id: "IRO-04", domain: "Incident Response", absorbs: ["IRO-04", "IRO-05"] },
  { id: "IRO-06", domain: "Incident Response", absorbs: ["IRO-06"] },
  { id: "IRO-10", domain: "Incident Response", absorbs: ["IRO-10", "IRO-11", "IRO-13", "IRO-14"] },

  // Business Continuity
  { id: "BCD-01", domain: "Business Continuity", absorbs: ["BCD-01", "BCD-02", "BCD-06"] },
  { id: "BCD-04", domain: "Business Continuity", absorbs: ["BCD-03", "BCD-04", "BCD-05"] },
  { id: "BCD-08", domain: "Business Continuity", absorbs: ["BCD-07", "BCD-08", "BCD-09", "BCD-10"] },
  { id: "BCD-11", domain: "Business Continuity", absorbs: ["BCD-11", "BCD-13"] },
  { id: "BCD-12", domain: "Business Continuity", absorbs: ["BCD-12"] },

  // Capacity
  { id: "CAP-01", domain: "Capacity & Performance", absorbs: ["CAP-01", "CAP-02", "CAP-03", "CAP-04"] },

  // Physical & Maintenance
  { id: "PES-01", domain: "Physical & Maintenance", absorbs: ["PES-01", "PES-04", "PES-07", "PES-08", "PES-09", "PES-12", "PES-13", "PES-15"] },
  { id: "PES-03", domain: "Physical & Maintenance", absorbs: ["PES-02", "PES-03", "PES-05", "PES-06", "PES-10", "PES-11"] },
  { id: "MNT-01", domain: "Physical & Maintenance", absorbs: ["MNT-01", "MNT-02", "MNT-03"] },
  { id: "MNT-05", domain: "Physical & Maintenance", absorbs: ["MNT-04", "MNT-05"] },

  // Network & Web
  { id: "NET-01", domain: "Network & Web Security", absorbs: ["NET-01", "NET-02", "NET-05", "NET-07", "NET-08", "NET-09"] },
  { id: "NET-03", domain: "Network & Web Security", absorbs: ["NET-03"] },
  { id: "NET-06", domain: "Network & Web Security", absorbs: ["NET-06", "NET-04"] },
  { id: "NET-14", domain: "Network & Web Security", absorbs: ["NET-14", "NET-12", "NET-15"] },
  { id: "NET-17", domain: "Network & Web Security", absorbs: ["NET-17", "NET-13", "NET-18"] },
  { id: "WEB-01", domain: "Network & Web Security", absorbs: ["WEB-01", "WEB-02", "WEB-10", "WEB-13"] },
  { id: "WEB-03", domain: "Network & Web Security", absorbs: ["WEB-03", "WEB-06"] },

  // Secure Development
  { id: "SEA-01", domain: "Secure Development", absorbs: ["SEA-01", "SEA-02", "SEA-03", "SEA-04", "SEA-07", "SEA-14", "SEA-17", "SEA-20"] },
  { id: "TDA-01", domain: "Secure Development", absorbs: ["TDA-01", "TDA-02", "TDA-04", "TDA-05"] },
  { id: "TDA-06", domain: "Secure Development", absorbs: ["TDA-06", "TDA-07", "TDA-08", "TDA-14"] },
  { id: "TDA-09", domain: "Secure Development", absorbs: ["TDA-09", "TDA-15"] },
  { id: "TDA-18", domain: "Secure Development", absorbs: ["TDA-18", "TDA-10"] },
  { id: "TDA-20", domain: "Secure Development", absorbs: ["TDA-13", "TDA-20"] },

  // People Security
  { id: "HRS-01", domain: "People Security", absorbs: ["HRS-01", "HRS-02", "HRS-03", "HRS-13"] },
  { id: "HRS-04", domain: "People Security", absorbs: ["HRS-04", "HRS-05", "HRS-06"] },
  { id: "HRS-09", domain: "People Security", name: "Personnel Lifecycle", absorbs: ["HRS-07", "HRS-08", "HRS-09", "HRS-10"] },
  { id: "HRS-11", domain: "People Security", absorbs: ["HRS-11", "HRS-12"] },
  { id: "SAT-02", domain: "People Security", name: "Security Awareness & Training", absorbs: ["SAT-01", "SAT-02", "SAT-03", "SAT-04"] },

  // Third-Party
  { id: "TPM-01", domain: "Third-Party Management", absorbs: ["TPM-01", "TPM-02", "TPM-03"] },
  { id: "TPM-04", domain: "Third-Party Management", absorbs: ["TPM-04", "TPM-05", "TPM-06"] },
  { id: "TPM-08", domain: "Third-Party Management", absorbs: ["TPM-07", "TPM-08", "TPM-09", "TPM-10"] },
  { id: "TPM-11", domain: "Third-Party Management", absorbs: ["TPM-11"] },
];

export function buildRemap() {
  /** @type {Record<string, string>} */
  const remap = {};
  const seenAbsorbed = new Set();
  for (const group of GROUPS) {
    if (!group.absorbs.includes(group.id)) {
      throw new Error(`${group.id} does not list itself in absorbs`);
    }
    for (const id of group.absorbs) {
      if (seenAbsorbed.has(id)) throw new Error(`${id} is absorbed by more than one survivor`);
      seenAbsorbed.add(id);
      remap[id] = group.id;
    }
  }
  return { remap, seenAbsorbed };
}
