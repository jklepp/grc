import React from "react";
import { Database, ShieldAlert, Layers, Users, FileText, Fingerprint, KeyRound, Laptop } from "lucide-react";
import { C } from "../theme";
import {
  DATA_SOURCES, tierGradient, totalTB, formatTB, formatRecords,
  WORKFORCE_IDENTITIES, PRIVILEGED_IDENTITIES, DEVICES, TOTAL_DEVICES,
  CUSTOMER_ACCOUNT_COUNT, AVG_IDENTITIES_PER_CUSTOMER, TOTAL_CUSTOMER_IDENTITIES,
} from "../data/dataFootprint";

// Grid placement for a 4-tile layout sized by data volume: the largest holder gets
// a tile spanning both rows on the left, the second-largest spans the full top-right
// row, and the remaining two split the bottom-right row. Driven by rank (computed
// from actual totals at render time), not by which vendor happens to be biggest.
const TILE_PLACEMENT = [
  { gridColumn: "1", gridRow: "1 / 3" },
  { gridColumn: "2 / 4", gridRow: "1" },
  { gridColumn: "2", gridRow: "2" },
  { gridColumn: "3", gridRow: "2" },
];

export default function DataFootprint() {
  // Volume totals only cover sources we actually instrument (AWS, Azure) — Workday
  // and Stripe are SaaS third parties we don't have accurate storage figures for,
  // so they're excluded here to match what's shown on their individual tiles.
  const volumeSources = DATA_SOURCES.filter((s) => s.hasVolumeData);
  const totalLiveTB = volumeSources.reduce((a, s) => a + s.liveDataTB, 0);
  const totalBackupTB = volumeSources.reduce((a, s) => a + s.backupDataTB, 0);
  const totalDataTB = totalLiveTB + totalBackupTB;
  const totalRecords = DATA_SOURCES.reduce((a, s) => a + s.records, 0);
  const totalCustomers = DATA_SOURCES
    .filter((s) => s.countsTowardCustomerTotal)
    .reduce((a, s) => a + (s.entityCount || 0), 0);
  // Sources with known volume are ranked by size first; the rest keep their
  // original order (there's no reliable size to rank them by).
  const sourcesByVolume = [...DATA_SOURCES].sort((a, b) => {
    if (a.hasVolumeData && !b.hasVolumeData) return -1;
    if (!a.hasVolumeData && b.hasVolumeData) return 1;
    if (a.hasVolumeData && b.hasVolumeData) return totalTB(b) - totalTB(a);
    return 0;
  });

  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1" style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
              <Database size={13} /> Data Footprint
            </div>
            <h1 className="text-3xl" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif", fontWeight: 600 }}>Data Footprint</h1>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}>
            Data as of Jul 15, 2026
          </div>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: C.muted }}>
          Estimated volume of customer, employee, financial and operational data held across ACME's core vendors.
        </p>
      </div>

      <div className="px-8 flex items-center gap-2 mb-3" style={{ color: C.accent }}>
        <Layers size={13} />
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Operational Systems &amp; Services</span>
      </div>
      <div className="px-8 grid gap-5 mb-8" style={{ gridTemplateColumns: "1.6fr 1fr 1fr" }}>
        {sourcesByVolume.map((s, i) => {
          const Icon = s.icon;
          const big = i === 0;
          return (
            <div
              key={s.name}
              className="rounded-2xl p-5 flex flex-col relative overflow-hidden"
              style={{ background: tierGradient(s.tier), ...TILE_PLACEMENT[i] }}
            >
              <div style={{ position: "absolute", right: -40, bottom: -40, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)" }} />
              <div style={{ position: "absolute", right: -8, bottom: -8, width: 96, height: 96, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.16)" }} />

              <div className="relative flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <Icon size={big ? 22 : 18} color="#fff" />
                  <div className={big ? "text-base font-semibold" : "text-sm font-semibold"} style={{ color: "#fff" }}>{s.name}</div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
                  {s.role}
                </span>
              </div>
              <div className="relative text-xs mb-4" style={{ color: "rgba(255,255,255,0.78)" }}>{s.dataDescription}</div>

              <div className="relative space-y-2 pt-3 mt-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.22)" }}>
                {s.hasVolumeData && (
                  <>
                    <div className="flex items-end justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}><Database size={12} /> Total Data</span>
                      <span className={big ? "text-2xl font-bold" : "text-lg font-bold"} style={{ color: "#fff", fontFamily: "'Source Serif 4', serif" }}>{formatTB(totalTB(s))}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.22)" }}>
                      <div style={{ width: `${(s.liveDataTB / totalTB(s)) * 100}%`, background: "#fff" }} />
                      <div style={{ width: `${(s.backupDataTB / totalTB(s)) * 100}%`, background: "rgba(255,255,255,0.4)" }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <span>Live {formatTB(s.liveDataTB)}</span>
                      <span>Backup {formatTB(s.backupDataTB)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.78)" }}><Users size={12} /> {s.entityLabel}</span>
                  <span className="font-semibold" style={{ color: "#fff", fontFamily: "'IBM Plex Mono', monospace" }}>{s.entityCount ? s.entityCount.toLocaleString() : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.78)" }}><FileText size={12} /> {s.recordsLabel}</span>
                  <span className="font-semibold" style={{ color: "#fff", fontFamily: "'IBM Plex Mono', monospace" }}>{formatRecords(s.records)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-8 flex items-center gap-2 mb-3" style={{ color: C.accent }}>
        <Fingerprint size={13} />
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Identities &amp; Devices</span>
      </div>
      <div className="px-8 grid grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint size={18} color={C.accent} />
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Workforce Identities</div>
          </div>
          <div className="space-y-3">
            {WORKFORCE_IDENTITIES.map((w) => (
              <div key={w.name} className="flex items-center justify-between text-sm">
                <span style={{ color: C.muted }}>{w.name}</span>
                <span className="font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{w.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-4 pt-3" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
            <KeyRound size={12} /> Includes {PRIVILEGED_IDENTITIES} privileged accounts
          </div>
        </div>

        <div className="rounded-2xl p-5 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} color={C.accent} />
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Customer Identities</div>
          </div>
          <div className="text-3xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{TOTAL_CUSTOMER_IDENTITIES.toLocaleString()}</div>
          <div className="text-xs mt-2" style={{ color: C.muted }}>
            ~{AVG_IDENTITIES_PER_CUSTOMER} identities per customer across {CUSTOMER_ACCOUNT_COUNT.toLocaleString()} customer accounts
          </div>
        </div>

        <div className="rounded-2xl p-5 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Laptop size={18} color={C.accent} />
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Devices</div>
          </div>
          <div className="space-y-3">
            {DEVICES.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span style={{ color: C.muted }}>{d.name}</span>
                <span className="font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{d.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="text-xs mt-4 pt-3" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
            {TOTAL_DEVICES.toLocaleString()} total managed devices
          </div>
        </div>
      </div>

      <div className="px-8 mb-6">
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-6 flex-wrap" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Live Total</span>
            <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{formatTB(totalLiveTB)}</span>
            <span className="text-[10px] font-medium" style={{ color: C.accent }}>{Math.round((totalLiveTB / totalDataTB) * 100)}%</span>
          </div>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Backup Total</span>
            <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{formatTB(totalBackupTB)}</span>
            <span className="text-[10px] font-medium" style={{ color: C.muted }}>{Math.round((totalBackupTB / totalDataTB) * 100)}%</span>
          </div>
          <span className="text-[11px] ml-auto" style={{ color: C.muted }}>Live = actively served · Backup = snapshots &amp; DR copies · AWS &amp; Azure infrastructure only</span>
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="rounded-xl p-5 flex items-center flex-wrap gap-6" style={{ background: C.accentBg, border: `1px solid ${C.accent}4D` }}>
          <ShieldAlert size={28} color={C.accent} className="shrink-0" />
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold mb-1" style={{ color: C.accent }}>Key Takeaway</div>
            <div className="text-sm" style={{ color: C.ink }}>
              Our customers trust ACME with their most sensitive information. Protecting this data across our ecosystem is our highest priority.
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{formatTB(totalDataTB)}</div>
              <div className="text-[11px]" style={{ color: C.muted }}>Total Data (AWS + Azure)</div>
            </div>
            <div>
              <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{totalCustomers.toLocaleString()}+</div>
              <div className="text-[11px]" style={{ color: C.muted }}>Customers</div>
            </div>
            <div>
              <div className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}>{formatRecords(totalRecords)}+</div>
              <div className="text-[11px]" style={{ color: C.muted }}>Total Records</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
