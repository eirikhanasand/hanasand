import type { SourceRecord } from "../types.ts";
import type { PolicyDecision } from "./collectionPolicyTypes.ts";
import { isApproved } from "./collectionPolicyApproval.ts";

export function evaluateMetadataOnlySource(source: SourceRecord): PolicyDecision {
  if (source.metadata?.exposureQueueSource === true && source.accessMethod === "public_http") {
    if (!/^https:\/\//i.test(String(source.url ?? ""))) {
      return { allowed: false, metadataOnly: true, reason: "public exposure metadata source requires HTTPS" };
    }
    if (!source.legalNotes.trim()) {
      return { allowed: false, metadataOnly: true, reason: "public exposure metadata source has no legal notes" };
    }
    if (!["active", "probation", "degraded"].includes(source.status)) {
      return { allowed: false, metadataOnly: true, reason: `public exposure metadata source status is ${source.status}` };
    }
    return { allowed: true, metadataOnly: true, reason: "public exposure source is metadata-only" };
  }
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
