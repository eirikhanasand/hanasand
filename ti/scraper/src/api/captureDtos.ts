import type { RawCapture, SafeCaptureDto } from "../types.ts";
import { sanitizeDwmApiPayload } from "../product/dwmCustomerDisplay.ts";
import { hashContent } from "../utils.ts";

export interface CaptureDtoOptions {
  includeBody?: boolean;
  tenantId?: string;
}

export function toSafeCaptureDto(capture: RawCapture, options: CaptureDtoOptions = {}): SafeCaptureDto {
  if (options.tenantId && capture.tenantId && capture.tenantId !== options.tenantId) {
    throw new Error(`Capture is outside tenant scope: ${capture.id}`);
  }
  const canIncludeBody = Boolean(options.includeBody && !capture.sensitive && capture.body && capture.storageKind !== "metadata_only");
  const url = safePublicUrl(capture.url, capture);
  const canonicalUrl = safePublicUrl(capture.canonicalUrl, capture);
  const objectRef = capture.objectRef
    ? {
      bucket: capture.objectRef.bucket,
      versionId: capture.objectRef.versionId,
      sizeBytes: capture.objectRef.sizeBytes,
      sha256: capture.objectRef.sha256,
      keyRedacted: true as const
    }
    : undefined;

  return {
    id: capture.id,
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url,
    canonicalUrl,
    urlHash: hashContent(String(capture.canonicalUrl ?? capture.url ?? capture.id)),
    locatorRedacted: !url,
    collectedAt: capture.collectedAt,
    publishedAt: capture.publishedAt,
    contentHash: capture.contentHash,
    normalizedTextHash: capture.normalizedTextHash,
    mediaType: capture.mediaType,
    storageKind: capture.storageKind,
    metadata: sanitizeDwmApiPayload(capture.metadata ?? {}),
    sensitive: capture.sensitive,
    sensitivityFlags: capture.sensitivityFlags ?? (capture.sensitive ? ["sensitive_source"] : ["public"]),
    redaction: sanitizeDwmApiPayload(capture.redaction),
    retentionClass: capture.retentionClass ?? (capture.sensitive ? "restricted_metadata" : "standard"),
    provenance: sanitizeDwmApiPayload({ ...capture.provenance, url: url ?? undefined }),
    objectRef,
    body: canIncludeBody ? capture.body : undefined,
    bodyRedacted: !canIncludeBody,
    redactionReason: canIncludeBody
      ? undefined
      : capture.sensitive
        ? "sensitive capture body is never exposed by API DTOs"
      : "body omitted; request explicit includeBody for non-sensitive inline captures"
  };
}

function safePublicUrl(value: unknown, capture: RawCapture): string | undefined {
  if (capture.sensitive || capture.storageKind === "metadata_only" || capture.metadata?.adapter === "darknet_metadata") return undefined;
  try {
    const url = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /(?:\.onion|\.i2p)$/i.test(url.hostname)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /(?:token|secret|password|authorization|cookie|api[_-]?key|signature)/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function maybeSafeCaptureDto(capture: RawCapture, options: CaptureDtoOptions = {}): SafeCaptureDto | undefined {
  if (options.tenantId && capture.tenantId && capture.tenantId !== options.tenantId) return undefined;
  return toSafeCaptureDto(capture, options);
}
