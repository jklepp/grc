import { useSyncExternalStore } from "react";
import { getLiveEngine, subscribeToLiveEngine } from "./index";

export function useLiveEngine() {
  return useSyncExternalStore(subscribeToLiveEngine, getLiveEngine, getLiveEngine);
}
