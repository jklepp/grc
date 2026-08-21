import type { AssetId } from "../../graph/ids";

export interface AssetOption { assetId: AssetId; label: string }

export function selectedValue<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}
