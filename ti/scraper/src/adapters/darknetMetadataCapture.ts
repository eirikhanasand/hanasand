import type { RawCapture } from "../types.ts";
import { hashContent, normalizeWhitespace } from "../utils.ts";

export function buildLeakSiteMetadata(url: string, fetched: any = {}) {
  const cleaned = normalizeWhitespace(fetched.description ?? fetched.text ?? "");
  return { urlHash: hashContent(url), title: fetched.title, actorName: fetched.actorName, victimName: fetched.victimName, claimedSector: fetched.claimedSector, claimedCountry: fetched.claimedCountry, claimedDataType: fetched.claimedDataType, sourceTimestamp: fetched.sourceTimestamp, summary: cleaned.slice(0, 500), metadataOnly: true };
}

export function darknetMetadataResultFromCapture(capture: RawCapture | undefined) {
  if (!capture) return undefined;
  const leakSite = (capture.metadata as any)?.leakSite ?? {};
  return { captureId: capture.id, sourceId: capture.sourceId, collectedAt: capture.collectedAt, title: capture.title, urlHash: leakSite.urlHash ?? hashContent(capture.url ?? ""), actorName: leakSite.actorName, victimName: leakSite.victimName, summary: leakSite.summary ?? normalizeWhitespace(capture.rawText ?? "").slice(0, 500), metadataOnly: true };
}

export function serializeLeakSite(leakSite: any, title?: string) {
  return normalizeWhitespace([title, leakSite.actorName, leakSite.victimName, leakSite.claimedSector, leakSite.claimedCountry, leakSite.summary].filter(Boolean).join("\n"));
}
