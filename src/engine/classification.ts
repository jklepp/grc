// Classification, derived bottom-up from the data itself.
//
// Previously a system carried a hand-typed `classification` and every asset
// inside it inherited that value wholesale. That made an asset's tier
// unfalsifiable: it was correct by construction and told you nothing you didn't
// already know from the system.
//
// Now it's a two-step high-water mark — an asset is as sensitive as the most
// sensitive data it touches, and a system is as sensitive as its most sensitive
// asset. Every data-type role counts, including `accesses`: a service account
// holds no data at all, but compromising it reaches all of it, and a model that
// let it sit at a lower tier than the records it can read would be wrong in the
// direction that matters.
//
// A note on what this does and doesn't prove. The derived tiers land on exactly
// the values the register previously carried by hand, and systems.ts asserts
// that in EXPECTED_CLASSIFICATION. That agreement is the point: the rollup has
// to reproduce the human answer before it's trustworthy enough to replace it.
// What's gained isn't a different answer today — it's that the answer now moves
// on its own when the data edges change, instead of waiting for someone to
// remember to retype it.
import { ASSETS, ASSET_BY_ID, assetsForSystem, type Asset } from "../graph/nodes/assets";
import { DATA_TYPE_BY_ID, type DataType } from "../graph/nodes/dataTypes";
import { dataTypesForAsset, type AssetDataType } from "../graph/edges/assetDataTypes";
import { highestTier, CLASSIFICATION_TIERS } from "../graph/nodes/taxonomy";
import type { AssetId, SystemId, DataTypeId } from "../graph/ids";

export interface AssetDataHolding extends AssetDataType {
  dataType: DataType;
}

// The data types one asset touches, resolved to full nodes with their role.
export function dataForAsset(assetId: AssetId): AssetDataHolding[] {
  return dataTypesForAsset(assetId).map((edge) => ({
    ...edge,
    dataType: DATA_TYPE_BY_ID[edge.dataTypeId],
  }));
}

interface AssetClassificationEntry {
  tier: string | null;
  drivenBy: AssetDataHolding[];
}

const ASSET_CLASSIFICATION: Record<AssetId, AssetClassificationEntry> = {};
ASSETS.forEach((asset) => {
  const held = dataForAsset(asset.id);
  const tier = highestTier(held.map((h) => h.dataType.sensitivity));
  ASSET_CLASSIFICATION[asset.id] = {
    tier,
    // The specific data types that set the tier — what an asset's
    // classification actually rests on, rather than a bare label.
    drivenBy: held.filter((h) => h.dataType.sensitivity === tier),
  };
});

export function assetClassification(assetId: AssetId): string | null {
  return ASSET_CLASSIFICATION[assetId]?.tier ?? null;
}

export function assetClassificationDetail(assetId: AssetId): AssetClassificationEntry | null {
  return ASSET_CLASSIFICATION[assetId] ?? null;
}

export function systemClassification(systemId: SystemId): string | null {
  const assets = assetsForSystem(systemId);
  return highestTier(assets.map((a) => assetClassification(a.id)).filter((t): t is string => Boolean(t)));
}

export function systemClassificationDetail(systemId: SystemId): { tier: string | null; drivenBy: Asset[] } {
  const tier = systemClassification(systemId);
  return {
    tier,
    drivenBy: assetsForSystem(systemId).filter((a) => assetClassification(a.id) === tier),
  };
}

// Every data type flowing through a system, deduped — what `dataElements` used
// to assert directly, now reachable from the asset edges instead of maintained
// alongside them.
export function dataTypesForSystem(systemId: SystemId): DataType[] {
  const seen = new Map<DataTypeId, DataType>();
  assetsForSystem(systemId).forEach((asset) => {
    dataForAsset(asset.id).forEach((h) => seen.set(h.dataTypeId, h.dataType));
  });
  return [...seen.values()].sort((a, b) => CLASSIFICATION_TIERS.indexOf(b.sensitivity) - CLASSIFICATION_TIERS.indexOf(a.sensitivity));
}

// Which data kinds an asset touches, in any role — the input applicability
// rules use for conditions like "wherever personal data lands."
export function dataKindsForAsset(assetId: AssetId): string[] {
  return [...new Set(dataForAsset(assetId).map((h) => h.dataType.kind))];
}

export function assetsHoldingDataType(dataTypeId: DataTypeId): Asset[] {
  return ASSETS.filter((a) => dataTypesForAsset(a.id).some((e) => e.dataTypeId === dataTypeId)).map((a) => ASSET_BY_ID[a.id]);
}
