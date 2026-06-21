import type { CollectedItem } from "../types.ts";
import { nowIso } from "../utils.ts";

export function freshnessState(item?: CollectedItem, targetSeconds = 604800, generatedAt = nowIso()) {
  if (!item?.publishedAt) return { state: "unknown", targetSeconds };
  const ageSeconds = Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(item.publishedAt)) / 1000));
  return {
    state: !Number.isFinite(ageSeconds) ? "unknown" : ageSeconds <= targetSeconds ? "fresh" : ageSeconds <= targetSeconds * 2 ? "watch" : "stale",
    ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : undefined,
    targetSeconds
  };
}
