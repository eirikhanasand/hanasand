import type { RawCapture, SafeCaptureDto } from "../types.ts";

export interface CaptureDtoOptions {
  includeBody?: boolean;
  tenantId?: string;
}

export function toSafeCaptureDto(capture: RawCapture, options: CaptureDtoOptions = {}): SafeCaptureDto {
  if (options.tenantId && capture.tenantId && capture.tenantId !== options.tenantId) {
    throw new Error(`Capture is outside tenant scope: ${capture.id}`);
  }
  const canIncludeBody = Boolean(options.includeBody && !capture.sensitive && capture.body && capture.storageKind !== "metadata_only");
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
    url: capture.url,
    canonicalUrl: capture.canonicalUrl,
    collectedAt: capture.collectedAt,
    publishedAt: capture.publishedAt,
    contentHash: capture.contentHash,
    normalizedTextHash: capture.normalizedTextHash,
    mediaType: capture.mediaType,
    storageKind: capture.storageKind,
    metadata: capture.metadata,
    sensitive: capture.sensitive,
    sensitivityFlags: capture.sensitivityFlags ?? (capture.sensitive ? ["sensitive_source"] : ["public"]),
    redaction: capture.redaction,
    retentionClass: capture.retentionClass ?? (capture.sensitive ? "restricted_metadata" : "standard"),
    provenance: capture.provenance,
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

export function maybeSafeCaptureDto(capture: RawCapture, options: CaptureDtoOptions = {}): SafeCaptureDto | undefined {
  if (options.tenantId && capture.tenantId && capture.tenantId !== options.tenantId) return undefined;
  return toSafeCaptureDto(capture, options);
}
