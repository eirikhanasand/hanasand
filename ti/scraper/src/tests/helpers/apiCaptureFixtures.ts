import type { RawCapture } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export function telegramCapture(input: { id: string; sourceId: string; url: string; channel: string; messageId: number; body: string; messageState?: "available" | "deleted" | "unavailable"; editDate?: string }): RawCapture {
  return {
    id: input.id,
    sourceId: input.sourceId,
    url: input.url,
    collectedAt: "2026-05-24T00:00:00.000Z",
    publishedAt: "2026-05-24T00:00:00.000Z",
    contentHash: hashContent(`${input.url}:${input.body}:${input.messageState ?? "available"}:${input.editDate ?? ""}`),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: input.body,
    metadata: {
      adapter: "telegram_public",
      channel: input.channel,
      messageId: input.messageId,
      messageState: input.messageState ?? "available",
      editDate: input.editDate,
      urlMentions: [],
      media: { retention: "metadata_only", items: [] },
      extractionHandoff: { actorAliases: input.body.includes("APT29") ? ["APT29"] : [], cves: [], victims: [], uncertaintyMarkers: [] },
      provenance: { confidence: 0.9 }
    },
    sensitive: false
  };
}

export function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const bodyText = overrides.body ?? "APT29 public evidence CVE-2026-1234.";
  return {
    id: "cap_api_fixture",
    tenantId: "tenant_api",
    sourceId: "src_api",
    url: "https://example.test/api-evidence",
    collectedAt: "2026-05-24T21:00:00.000Z",
    contentHash: hashContent(bodyText),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: bodyText,
    metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_api" },
    sensitive: false,
    ...overrides
  };
}
