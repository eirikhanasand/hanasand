import type { CollectedItem, ExtractedEntity, ExtractionProvenance } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import type { ExtractionContext } from "./extractors.ts";

export const SOURCE_SPECIFIC_EXTRACTOR_VERSION = "ti-source-specific-extractor-v1";

export function extractSourceSpecificEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const profile = item.metadata?.extractionProfile;
  if (profile === "ransomware_victim_blog") return victimBlogEntities(item, context);
  if (profile === "cisa_kev") return cisaKevEntities(item, context);
  if (profile === "cert_ua_public_channel") return certUaEntities(item, context);
  return [];
}

function victimBlogEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const fields = item.metadata?.leakSite ?? {};
  return compact([
    fieldEntity("actor", fields.actorName, 0.86, "actorName", item, context, "source_claim", []),
    fieldEntity("victim", fields.victimName, 0.78, "victimName", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("sector", fields.claimedSector, 0.68, "claimedSector", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("country", fields.claimedCountry, 0.68, "claimedCountry", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("dataset", fields.claimedDataType, 0.64, "claimedDataType", item, context, "source_claim", ["advertised data type is unverified"]),
    fieldEntity("publication_strategy", "public victim listing", 0.95, "channel", item, context, "observed", []),
    fieldEntity("channel_type", "dark web victim blog", 0.95, "channel", item, context, "observed", []),
    fieldEntity("victim_pressure_tactic", "public naming", 0.65, "channel", item, context, "inferred", ["inferred from publication channel"])
  ]);
}

function cisaKevEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const fields = item.metadata?.structuredFields ?? {};
  const ransomwareUse = String(fields.knownRansomwareCampaignUse ?? "").toLowerCase();
  return compact([
    fieldEntity("cve", fields.cveID, 0.99, "cveID", item, context, "observed", []),
    fieldEntity("vendor", fields.vendorProject, 0.94, "vendorProject", item, context, "observed", []),
    fieldEntity("product", fields.product, 0.94, "product", item, context, "observed", []),
    fieldEntity("ttp", fields.cveID ? "exploitation" : undefined, 0.9, "catalog", item, context, "observed", []),
    fieldEntity("impact", ransomwareUse === "known" ? "known ransomware campaign use" : undefined, 0.86, "knownRansomwareCampaignUse", item, context, "observed", [])
  ]);
}

function certUaEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  return [...item.rawText.matchAll(/\bUAC-\d{4,5}\b/gi)].map((match) => entity(
    "actor",
    match[0].toUpperCase(),
    0.9,
    "messageText",
    item,
    context,
    "source_attribution",
    [],
    match.index ?? 0
  ));
}

function fieldEntity(type: string, value: unknown, confidence: number, field: string, item: CollectedItem, context: ExtractionContext, assertionKind: string, reviewReasons: string[]): ExtractedEntity | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = normalizeWhitespace(value).slice(0, 240);
  return entity(type, normalized, confidence, field, item, context, assertionKind, reviewReasons, item.rawText.toLowerCase().indexOf(normalized.toLowerCase()));
}

function entity(type: string, value: string, confidence: number, field: string, item: CollectedItem, context: ExtractionContext, assertionKind: string, reviewReasons: string[], offset: number): ExtractedEntity {
  const startOffset = Math.max(0, offset);
  return {
    type,
    value,
    rawValue: value,
    normalizedValue: normalizeWhitespace(value),
    confidence,
    extractionMethod: "source_specific",
    extractionProfile: item.metadata?.extractionProfile,
    extractorVersion: SOURCE_SPECIFIC_EXTRACTOR_VERSION,
    sourceField: field,
    assertionKind,
    reviewReasons,
    provenance: [provenance(context, startOffset, startOffset + value.length, `${field}: ${value}`)]
  } as ExtractedEntity;
}

function provenance(context: ExtractionContext, startOffset: number, endOffset: number, evidenceText: string): ExtractionProvenance {
  return { ...context, extractorVersion: SOURCE_SPECIFIC_EXTRACTOR_VERSION, startOffset, endOffset, evidenceText: evidenceText.slice(0, 240) } as ExtractionProvenance;
}

function compact<T>(values: Array<T | undefined>): T[] { return values.filter((value): value is T => value !== undefined); }
