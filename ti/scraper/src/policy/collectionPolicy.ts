import type { CollectionTask, SourceRecord } from "../types.ts";
import { requiresApproval, requiresMetadataOnly } from "../registry/sourceRegistry.ts";

export interface PolicyDecision {
  allowed: boolean;
  metadataOnly: boolean;
  reason: string;
}

export function evaluateSourceForCollection(source: SourceRecord): PolicyDecision {
  if (isMetadataSource(source)) {
    return evaluateMetadataOnlySource(source);
  }

  if (source.status !== "active" && source.status !== "probation" && source.status !== "degraded") {
    return { allowed: false, metadataOnly: false, reason: `source status is ${source.status}` };
  }

  if (source.accessMethod === "disabled") {
    return { allowed: false, metadataOnly: false, reason: "source access method is disabled" };
  }

  if (source.risk === "restricted") {
    return { allowed: false, metadataOnly: false, reason: "restricted source requires manual approval" };
  }

  if (source.type === "telegram_public") {
    if (source.accessMethod !== "official_api") {
      return { allowed: false, metadataOnly: false, reason: "public Telegram collection requires official API access" };
    }

    const telegramCompliance = evaluateTelegramPublicCompliance(source);
    if (!telegramCompliance.allowed) {
      return { allowed: false, metadataOnly: false, reason: telegramCompliance.reason };
    }

    if (!source.legalNotes.trim()) {
      return { allowed: false, metadataOnly: false, reason: "public Telegram source has no legal notes" };
    }

    if (!isApproved(source)) {
      return { allowed: false, metadataOnly: false, reason: "public Telegram source requires source review approval" };
    }

    return { allowed: true, metadataOnly: false, reason: "public Telegram source is collectable through official APIs" };
  }

  if (requiresApproval(source) && !isApproved(source)) {
    return { allowed: false, metadataOnly: requiresMetadataOnly(source), reason: "source approval is required" };
  }

  if (!source.legalNotes.trim()) {
    return { allowed: false, metadataOnly: false, reason: "source has no legal notes" };
  }

  return { allowed: true, metadataOnly: false, reason: "source is collectable" };
}

function isApproved(source: SourceRecord): boolean {
  if (source.governance) {
    return source.governance.approvalState === "approved" && Boolean(source.governance.approvedAt && source.governance.approvedBy);
  }

  return Boolean(source.approvedAt && source.approvedBy);
}

function isMetadataSource(source: SourceRecord): boolean {
  return source.type.endsWith("_metadata");
}

function evaluateMetadataOnlySource(source: SourceRecord): PolicyDecision {
  if (source.governance && !source.governance.metadataOnly) {
    return { allowed: false, metadataOnly: true, reason: "darknet metadata source requires metadata-only governance review" };
  }

  if (source.status === "retired" || source.status === "rejected") {
    return { allowed: false, metadataOnly: true, reason: `darknet metadata source status is ${source.status}` };
  }

  if (source.accessMethod === "disabled") {
    return { allowed: false, metadataOnly: true, reason: "darknet metadata source access is disabled pending metadata-only review" };
  }

  if (source.accessMethod !== "approved_proxy") {
    return { allowed: false, metadataOnly: true, reason: "darknet metadata sources require approved proxy access" };
  }

  if (!source.legalNotes.trim()) {
    return { allowed: false, metadataOnly: true, reason: "darknet metadata source has no legal notes" };
  }

  if (!isApproved(source)) {
    return { allowed: false, metadataOnly: true, reason: "darknet metadata source requires operator approval for metadata-only collection" };
  }

  if (source.status !== "active" && source.status !== "probation" && source.status !== "degraded") {
    return { allowed: false, metadataOnly: true, reason: `darknet metadata source status is ${source.status}` };
  }

  return { allowed: true, metadataOnly: true, reason: "darknet source is metadata-only" };
}

function evaluateTelegramPublicCompliance(source: SourceRecord): { allowed: true } | { allowed: false; reason: string } {
  const target = source.url.trim().toLowerCase();
  if (/\bt\.me\/(?:joinchat|\+|c\/)|\btelegram\.me\/(?:joinchat|\+|c\/)|^tg:\/\/join/i.test(target)) {
    return { allowed: false, reason: "public Telegram source uses prohibited invite, joinchat, or private-channel URL" };
  }

  const metadata = source.metadata ?? {};
  for (const key of [
    "accountAutomation",
    "autoJoin",
    "joinGroups",
    "joinChannels",
    "privateChannel",
    "inviteLink",
    "sessionString",
    "userSession",
    "phoneNumber",
    "password",
    "bypassAccessControls"
  ]) {
    const value = metadata[key];
    if (value === undefined || value === false || value === "") continue;
    return { allowed: false, reason: `public Telegram source config implies prohibited account automation or private access: ${key}` };
  }

  return { allowed: true };
}

export function evaluateTaskForCollection(source: SourceRecord, task: CollectionTask): PolicyDecision {
  const sourceDecision = evaluateSourceForCollection(source);
  if (!sourceDecision.allowed) return sourceDecision;

  if (task.retryCount > 5) {
    return { allowed: false, metadataOnly: sourceDecision.metadataOnly, reason: "retry budget exhausted" };
  }

  return sourceDecision;
}
