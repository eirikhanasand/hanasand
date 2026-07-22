import type { CollectionTask, SourceRecord } from "../types.ts";
import { requiresApproval, requiresMetadataOnly } from "../registry/sourceRegistry.ts";
import { isApproved, isMetadataSource } from "./collectionPolicyApproval.ts";
import { evaluateMetadataOnlySource } from "./metadataCollectionPolicy.ts";
import { evaluateTelegramPublicCompliance } from "./telegramCollectionPolicy.ts";
export type { PolicyDecision } from "./collectionPolicyTypes.ts";
import type { PolicyDecision } from "./collectionPolicyTypes.ts";

export function evaluateSourceForCollection(source: SourceRecord): PolicyDecision {
  if (isMetadataSource(source)) return evaluateMetadataOnlySource(source);
  if (!["active", "canary", "probation", "degraded"].includes(source.status)) {
    return { allowed: false, metadataOnly: false, reason: `source status is ${source.status}` };
  }
  if (source.accessMethod === "disabled") return { allowed: false, metadataOnly: false, reason: "source access method is disabled" };
  if (source.risk === "restricted") return { allowed: false, metadataOnly: false, reason: "restricted source requires manual approval" };
  if (source.type === "telegram_public") return evaluateTelegramSource(source);
  if (requiresApproval(source) && !isApproved(source)) {
    return { allowed: false, metadataOnly: requiresMetadataOnly(source), reason: "source approval is required" };
  }
  if (!source.legalNotes.trim()) return { allowed: false, metadataOnly: false, reason: "source has no legal notes" };
  return { allowed: true, metadataOnly: false, reason: "source is collectable" };
}

export function sourceCollectionLane(source: SourceRecord): "public" | "restricted_metadata" | undefined {
  try {
    if (source.metadata?.productionCollection === false || !evaluateSourceForCollection(source).allowed) return undefined;
    if (source.type === "tor_metadata") return "restricted_metadata";
    if (source.type.endsWith("_metadata") || source.accessMethod !== "public_http" || ["high", "restricted"].includes(source.risk)) return undefined;
    return ["http:", "https:"].includes(new URL(source.url).protocol) ? "public" : undefined;
  } catch {
    return undefined;
  }
}

export const isExecutableSource = (source: SourceRecord) => sourceCollectionLane(source) !== undefined;

export function evaluateTaskForCollection(source: SourceRecord, task: CollectionTask): PolicyDecision {
  const sourceDecision = evaluateSourceForCollection(source);
  if (!sourceDecision.allowed) return sourceDecision;
  if (task.retryCount > 5) return { allowed: false, metadataOnly: sourceDecision.metadataOnly, reason: "retry budget exhausted" };
  return sourceDecision;
}

function evaluateTelegramSource(source: SourceRecord): PolicyDecision {
  const telegramCompliance = evaluateTelegramPublicCompliance(source);
  if (!telegramCompliance.allowed) return { allowed: false, metadataOnly: false, reason: telegramCompliance.reason };
  if (!source.legalNotes.trim()) return { allowed: false, metadataOnly: false, reason: "public Telegram source has no legal notes" };
  if (!isApproved(source)) return { allowed: false, metadataOnly: false, reason: "public Telegram source requires source review approval" };
  if (source.accessMethod === "public_http" && source.metadata?.collectionMode === "public_web_preview") {
    return { allowed: true, metadataOnly: false, reason: "public Telegram source is collectable through the approved public web preview" };
  }
  if (source.accessMethod !== "official_api") {
    return { allowed: false, metadataOnly: false, reason: "public Telegram collection requires official API or approved public web preview access" };
  }
  return { allowed: true, metadataOnly: false, reason: "public Telegram source is collectable through official APIs" };
}
