import type { CollectedItem, ExtractedEntity, ExtractionProvenance } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import type { ExtractionContext } from "./extractors.ts";

export const SOURCE_SPECIFIC_EXTRACTOR_VERSION = "ti-source-specific-extractor-v2";

export function extractSourceSpecificEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const profile = item.metadata?.extractionProfile;
  if (profile === "ransomware_victim_blog") return victimBlogEntities(item, context);
  if (profile === "ransomware_group_metadata") return ransomwareGroupEntities(item, context);
  if (profile === "cisa_kev") return cisaKevEntities(item, context);
  if (profile === "cert_ua_public_channel") return certUaEntities(item, context);
  return [];
}

function ransomwareGroupEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const fields = item.metadata?.ransomwareGroup ?? {}, channels = Array.isArray(fields.channelTypes) ? fields.channelTypes.map(meaningful).filter(Boolean) : [];
  const actor = fieldEntity("ransomware_family", fields.actorName, 0.88, "actorName", item, context, "observed", []);
  if (actor) (actor as any).aliases = Array.isArray(fields.aliases) ? fields.aliases.map(meaningful).filter(Boolean) : [];
  const has = (type: string) => channels.some((channel: string) => channel.toLowerCase() === type.toLowerCase());
  return compact([
    actor,
    ...channels.map((channel: string) => fieldEntity("channel_type", channel, 0.9, "channelTypes", item, context, "observed", [])),
    fieldEntity("publication_strategy", has("DLS") ? "dedicated leak-site publication" : undefined, 0.9, "channelTypes", item, context, "observed", []),
    fieldEntity("publicity_tactic", has("DLS") ? "public victim listing infrastructure" : undefined, 0.86, "channelTypes", item, context, "observed", []),
    fieldEntity("communication_channel", has("Chat") ? "listed actor chat endpoint" : undefined, 0.82, "channelTypes", item, context, "observed", ["counterparties, purpose, and conversation content are not stated"]),
    fieldEntity("extortion_type", has("DLS") ? "leak-site extortion infrastructure" : undefined, 0.62, "channelTypes", item, context, "inferred", ["infrastructure does not prove a specific extortion event"])
  ]);
}

function victimBlogEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const fields = item.metadata?.leakSite ?? {};
  const actor = meaningful(fields.actorName), victims = [...new Set([fields.victimName, ...(Array.isArray(fields.victimNames) ? fields.victimNames : [])].map(meaningful).filter(Boolean))], dataType = meaningful(fields.claimedDataType);
  const summary = meaningful(fields.summary) ?? "";
  const countdown = signalEntity("victim_pressure_tactic", "countdown to publication", 0.9, "summary", summary, /\b(?:publishes? after|\d+[dhms]\s+remaining|countdown)\b/i, item, context);
  return compact([
    fieldEntity("ransomware_family", actor, 0.86, "actorName", item, context, "source_claim", []),
    ...victims.map((victim) => fieldEntity("victim", victim, 0.78, "victimName", item, context, "source_claim", ["unverified threat-actor claim"])),
    fieldEntity("sector", fields.claimedSector, 0.68, "claimedSector", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("country", fields.claimedCountry, 0.68, "claimedCountry", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("dataset", dataType, 0.64, "claimedDataType", item, context, "source_claim", ["advertised data type is unverified"]),
    fieldEntity("extortion_type", fields.extortionType ?? (actor && victims.length ? "ransomware/extortion victim claim" : undefined), fields.extortionType ? 0.8 : 0.55, "extortionType", item, context, fields.extortionType ? "source_claim" : "inferred", fields.extortionType ? ["unverified threat-actor claim"] : ["inferred from publication in a governed victim-claim feed"]),
    fieldEntity("monetization_path", fields.monetizationPath, 0.72, "monetizationPath", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("publicity_tactic", fields.publicityTactic ?? "public victim naming", fields.publicityTactic ? 0.8 : 0.7, "publicityTactic", item, context, fields.publicityTactic ? "source_claim" : "observed", fields.publicityTactic ? ["unverified threat-actor claim"] : []),
    fieldEntity("publication_strategy", fields.publicationStrategy ?? "public victim listing", fields.publicationStrategy ? 0.8 : 0.95, "publicationStrategy", item, context, fields.publicationStrategy ? "source_claim" : "observed", fields.publicationStrategy ? ["unverified threat-actor claim"] : []),
    signalEntity("publication_strategy", "staged publication status", 0.86, "summary", summary, /\b(?:PENDING|RELEASED|Publishes? after)\b/, item, context),
    signalEntity("publication_strategy", "public data release link", 0.9, "summary", summary, /\bDownload\s*:/i, item, context),
    fieldEntity("channel_type", fields.channelType ?? "metadata-only victim source", 0.95, "channel", item, context, "observed", []),
    fieldEntity("victim_pressure_tactic", fields.victimPressureTactic, 0.75, "victimPressureTactic", item, context, "source_claim", ["unverified threat-actor claim"]),
    countdown,
    fieldEntity("buyer_seller_communication", fields.buyerSellerCommunication, 0.7, "buyerSellerCommunication", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("intermediary_communication", fields.intermediaryCommunication, 0.7, "intermediaryCommunication", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("profitability_signal", fields.profitabilitySignal, 0.65, "profitabilitySignal", item, context, "source_claim", ["signal does not establish realized profit"])
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
  const meaningfulValue = meaningful(value);
  if (!meaningfulValue) return undefined;
  const normalized = normalizeWhitespace(meaningfulValue).slice(0, 240);
  return entity(type, normalized, confidence, field, item, context, assertionKind, reviewReasons, item.rawText.toLowerCase().indexOf(normalized.toLowerCase()));
}

function signalEntity(type: string, value: string, confidence: number, field: string, text: string, pattern: RegExp, item: CollectedItem, context: ExtractionContext, reviewReasons: string[] = []): ExtractedEntity | undefined {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const start = Math.max(0, match.index - 48), evidence = normalizeWhitespace(text.slice(start, match.index + match[0].length + 96)).slice(0, 240);
  return entity(type, value, confidence, field, item, context, "observed", reviewReasons, Math.max(0, item.rawText.indexOf(match[0])), evidence);
}

function entity(type: string, value: string, confidence: number, field: string, item: CollectedItem, context: ExtractionContext, assertionKind: string, reviewReasons: string[], offset: number, evidenceText = `${field}: ${value}`): ExtractedEntity {
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
    provenance: [provenance(context, startOffset, startOffset + value.length, evidenceText)]
  } as ExtractedEntity;
}

function provenance(context: ExtractionContext, startOffset: number, endOffset: number, evidenceText: string): ExtractionProvenance {
  return { ...context, extractorVersion: SOURCE_SPECIFIC_EXTRACTOR_VERSION, startOffset, endOffset, evidenceText: evidenceText.slice(0, 240) } as ExtractionProvenance;
}

function compact<T>(values: Array<T | undefined>): T[] { return values.filter((value): value is T => value !== undefined); }
function meaningful(value: unknown): string | undefined { return typeof value === "string" && value.trim() && !/^(?:unknown|n\/?a|not disclosed(?: by (?:the )?threat actor| by ta)?)$/i.test(value.trim()) ? value.trim() : undefined; }
