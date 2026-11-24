// Classification, derived bottom-up from the data itself.
//
// A two-step high-water mark — an asset is as sensitive as the most
// sensitive data it touches, and a system is as sensitive as its most sensitive
// asset. Every data-type role counts, including `accesses`: a service account
// holds no data at all, but compromising it reaches all of it, and a model that
// let it sit at a lower tier than the records it can read would be wrong in the
// direction that matters.
//
// The graph's expectedClassification asserts the derived tiers reproduce the
// human answer.
import type { Graph } from "../graph/types";
import type { Asset } from "../graph/nodes/assets";
import type { DataType } from "../graph/nodes/dataTypes";
import type { AssetDataType } from "../graph/edges/assetDataTypes";
import { highestTier, CLASSIFICATION_TIERS, type ClassificationTier } from "../graph/nodes/taxonomy";
import type { AssetId, SystemId, DataTypeId } from "../graph/ids";

export interface AssetDataHolding extends AssetDataType {
  dataType: DataType;
}

interface AssetClassificationEntry {
  tier: ClassificationTier | null;
  drivenBy: AssetDataHolding[];
}

export function createClassification(graph: Graph) {
  // The data types one asset touches, resolved to full nodes with their role.
  function dataForAsset(assetId: AssetId): AssetDataHolding[] {
    return (graph.dataTypesByAsset[assetId] ?? []).map((edge) => ({
      ...edge,
      dataType: graph.dataTypeById[edge.dataTypeId],
    }));
  }

  // Precomputed for the whole asset register, same as before — every rollup
  // walks this and the data edges don't change within one graph.
  const assetClassifications: Record<AssetId, AssetClassificationEntry> = {};
  graph.assets.forEach((asset) => {
    const held = dataForAsset(asset.id);
    const tier = highestTier(held.map((h) => h.dataType.sensitivity));
    assetClassifications[asset.id] = {
      tier,
      // The specific data types that set the tier — what an asset's
      // classification actually rests on, rather than a bare label.
      drivenBy: held.filter((h) => h.dataType.sensitivity === tier),
    };
  });

  function assetClassification(assetId: AssetId): ClassificationTier | null {
    return assetClassifications[assetId]?.tier ?? null;
  }

  function assetClassificationDetail(assetId: AssetId): AssetClassificationEntry | null {
    return assetClassifications[assetId] ?? null;
  }

  function assetsForSystem(systemId: SystemId): readonly Asset[] {
    return graph.assetsBySystem[systemId] ?? [];
  }

  function systemClassification(systemId: SystemId): ClassificationTier | null {
    const assets = assetsForSystem(systemId);
    return highestTier(assets.map((a) => assetClassification(a.id)).filter((t): t is ClassificationTier => Boolean(t)));
  }

  function systemClassificationDetail(systemId: SystemId): { tier: ClassificationTier | null; drivenBy: Asset[] } {
    const tier = systemClassification(systemId);
    return {
      tier,
      drivenBy: assetsForSystem(systemId).filter((a) => assetClassification(a.id) === tier),
    };
  }

  // Every data type flowing through a system, deduped, read off the asset edges.
  function dataTypesForSystem(systemId: SystemId): DataType[] {
    const seen = new Map<DataTypeId, DataType>();
    assetsForSystem(systemId).forEach((asset) => {
      dataForAsset(asset.id).forEach((h) => seen.set(h.dataTypeId, h.dataType));
    });
    return [...seen.values()].sort(
      (a, b) => CLASSIFICATION_TIERS.indexOf(b.sensitivity) - CLASSIFICATION_TIERS.indexOf(a.sensitivity)
    );
  }

  // Which data kinds an asset touches, in any role — the input applicability
  // rules use for conditions like "wherever personal data lands."
  function dataKindsForAsset(assetId: AssetId): string[] {
    return [...new Set(dataForAsset(assetId).map((h) => h.dataType.kind))];
  }

  function assetsHoldingDataType(dataTypeId: DataTypeId): Asset[] {
    return graph.assets.filter((a) =>
      (graph.dataTypesByAsset[a.id] ?? []).some((e) => e.dataTypeId === dataTypeId)
    ) as Asset[];
  }

  return {
    dataForAsset,
    assetClassification,
    assetClassificationDetail,
    systemClassification,
    systemClassificationDetail,
    dataTypesForSystem,
    dataKindsForAsset,
    assetsHoldingDataType,
  };
}

export type ClassificationApi = ReturnType<typeof createClassification>;
