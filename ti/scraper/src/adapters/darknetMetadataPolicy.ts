import type { SourceRecord } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { BLOCKED_OPERATIONS } from "./darknetMetadataConstants.ts";
import type { ApprovedProxyBoundary, DarknetMetadataSourceType, DarknetNetwork } from "./darknetMetadataTypes.ts";

const SENSITIVE = /(?:download|dump|leak|sample|archive|database|backup|fullz|combo|credentials?|passwords?|files?|\.(?:7z|rar|zip|sql|db|csv|xlsx?|docx?|pdf|bak|dump))(?:$|[/?#&=._-])/i;
const INTERACTION = /(?:login|auth|signin|signup|register|contact|payment|pay|wallet|comment|reply|upload|submit|form|chat|message|dm)(?:$|[/?#&=._-])/i;

export const isSensitivePayloadTarget = (url: string) => SENSITIVE.test(url);
export const isUnsafeInteractionTarget = (url: string) => INTERACTION.test(url);
export const networkForSourceType = (type?: string): DarknetNetwork => type === "i2p_metadata" ? "i2p" : type === "freenet_metadata" ? "freenet" : "tor";
export const sourceTypeForNetwork = (network: DarknetNetwork): DarknetMetadataSourceType => `${network}_metadata` as DarknetMetadataSourceType;
export const sanitizeLinks = (links: string[]) => links.filter((link) => !isSensitivePayloadTarget(link) && !isUnsafeInteractionTarget(link)).slice(0, 20);

export function evaluateDarknetMetadataPolicy(source: SourceRecord, url: string, proxyBoundary?: ApprovedProxyBoundary) {
  const network = networkForSourceType(source.type as DarknetMetadataSourceType);
  const fail = (reason: string, message: string) => policy(source, url, proxyBoundary, false, reason, message, network);
  if (!String(source.type).endsWith("_metadata")) return fail("not_darknet_metadata_source", "source is not a darknet metadata source");
  if (source.accessMethod !== "approved_proxy" && source.accessMethod !== "darknet_metadata") return fail("wrong_access_method", "source must use an approved metadata proxy");
  if (!proxyBoundary) return fail("missing_proxy_boundary", "approved proxy boundary is missing");
  if (isSensitivePayloadTarget(url)) return fail("sensitive_payload_target_blocked", "payload or credential-like target blocked");
  if (isUnsafeInteractionTarget(url)) return fail("interaction_affordance_blocked", "interactive target blocked");
  return policy(source, url, proxyBoundary, true, "allowed_metadata_only", "metadata-only collection allowed", network);
}

function policy(source: SourceRecord, url: string, proxyBoundary: any, allowed: boolean, reason: string, message: string, network?: DarknetNetwork) {
  return { id: stableId("policy", `${source.id}:${url}:${proxyBoundary?.id ?? "none"}`), allowed, reason, message, network, sourceId: source.id, sourceType: source.type, urlHash: hashContent(url), proxyBoundaryId: proxyBoundary?.id, metadataOnly: true, blockedOperations: BLOCKED_OPERATIONS, decidedAt: nowIso() };
}
