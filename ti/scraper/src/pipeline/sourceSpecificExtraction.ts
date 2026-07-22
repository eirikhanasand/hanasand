import type { CollectedItem, ExtractedEntity, ExtractionProvenance } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import type { ExtractionContext } from "./extractors.ts";
import { resolveMitreActorIdentity, type ActorIdentityRecord } from "./mitreActorCatalog.ts";
import { extractActorBusinessEvidence } from "./actorBusinessEvidence.ts";

export const SOURCE_SPECIFIC_EXTRACTOR_VERSION = "ti-source-specific-extractor-v3";

export function extractSourceSpecificEntities(item: CollectedItem, context: ExtractionContext, actorIdentities?: ActorIdentityRecord[]): ExtractedEntity[] {
  const profile = item.metadata?.extractionProfile;
  const entities = profile === "ransomware_victim_blog" ? victimBlogEntities(item, context)
    : profile === "ransomware_group_metadata" ? ransomwareGroupEntities(item, context)
      : profile === "cisa_kev" ? cisaKevEntities(item, context)
        : profile === "cert_ua_public_channel" ? certUaEntities(item, context)
          : [];
  return actorIdentities?.length ? entities.map((entity) => resolveActorEntity(entity, actorIdentities)) : entities;
}

function resolveActorEntity(entity: ExtractedEntity, identities: ActorIdentityRecord[]): ExtractedEntity {
  if (entity.type !== "actor" && entity.type !== "ransomware_family") return entity;
  const resolution = resolveMitreActorIdentity(entity.value, identities);
  if (!resolution.candidates.length) return entity;
  const exact = !resolution.ambiguous && resolution.candidates.length === 1 && resolution.candidates[0].matchKinds.includes("canonical");
  const identity = resolution.candidates[0].identity;
  return {
    ...entity,
    value: exact ? identity.canonicalName : entity.value,
    normalizedValue: exact ? identity.canonicalName : entity.normalizedValue,
    aliases: exact ? identity.associatedNames : [entity.value],
    actorIdentityIds: resolution.candidates.map((candidate) => candidate.identity.id)
  } as ExtractedEntity;
}

function ransomwareGroupEntities(item: CollectedItem, context: ExtractionContext): ExtractedEntity[] {
  const fields = item.metadata?.ransomwareGroup ?? {}, channels = Array.isArray(fields.channelTypes) ? fields.channelTypes.map(meaningful).filter(Boolean) : [];
  const actor = fieldEntity("ransomware_family", fields.actorName, 0.88, "actorName", item, context, "observed", []);
  if (actor) (actor as any).aliases = Array.isArray(fields.aliases) ? fields.aliases.map(meaningful).filter(Boolean) : [];
  const has = (type: string) => channels.some((channel: string) => channel.toLowerCase() === type.toLowerCase());
  const description = meaningful(fields.description) ?? "", descriptionOffset = Math.max(0, item.rawText.indexOf(description));
  const businessEvidence = extractActorBusinessEvidence(description).map((finding) => entity(
    finding.type,
    finding.value,
    finding.confidence,
    "description",
    item,
    context,
    finding.assertionKind,
    finding.reviewReasons,
    descriptionOffset + finding.startOffset,
    finding.evidenceText,
    finding.matchedLength
  ));
  return compact([
    actor,
    ...channels.map((channel: string) => fieldEntity("channel_type", channel, 0.9, "channelTypes", item, context, "observed", [])),
    fieldEntity("publication_strategy", has("DLS") ? "dedicated leak-site publication" : undefined, 0.9, "channelTypes", item, context, "observed", []),
    fieldEntity("publicity_tactic", has("DLS") ? "public victim listing infrastructure" : undefined, 0.86, "channelTypes", item, context, "observed", []),
    ...businessEvidence
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
    fieldEntity("extortion_type", fields.extortionType, 0.8, "extortionType", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("monetization_path", fields.monetizationPath, 0.72, "monetizationPath", item, context, "source_claim", ["unverified threat-actor claim"]),
    fieldEntity("publicity_tactic", fields.publicityTactic ?? "public victim naming", fields.publicityTactic ? 0.8 : 0.7, "publicityTactic", item, context, fields.publicityTactic ? "source_claim" : "observed", fields.publicityTactic ? ["unverified threat-actor claim"] : []),
    fieldEntity("publication_strategy", fields.publicationStrategy ?? "public victim listing", fields.publicationStrategy ? 0.8 : 0.95, "publicationStrategy", item, context, fields.publicationStrategy ? "source_claim" : "observed", fields.publicationStrategy ? ["unverified threat-actor claim"] : []),
    signalEntity("publication_strategy", "staged publication status", 0.86, "summary", summary, /\b(?:PENDING|RELEASED|Publishes? after)\b/, item, context),
    signalEntity("publication_strategy", "public data release link", 0.9, "summary", summary, /\bDownload\s*:/i, item, context),
    signalEntity("publicity_event", "public victim listing", 0.88, "summary", summary, /\b(?:has just published|published) (?:a )?new victim\b/i, item, context, ["third-party publication report requires analyst review"], "third_party_report"),
    fieldEntity("channel_type", fields.channelType, 0.95, "channel", item, context, "observed", []),
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

function signalEntity(type: string, value: string, confidence: number, field: string, text: string, pattern: RegExp, item: CollectedItem, context: ExtractionContext, reviewReasons: string[] = [], assertionKind = "observed"): ExtractedEntity | undefined {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const start = Math.max(0, match.index - 48), evidence = normalizeWhitespace(text.slice(start, match.index + match[0].length + 96)).slice(0, 240);
  return entity(type, value, confidence, field, item, context, assertionKind, reviewReasons, Math.max(0, item.rawText.indexOf(match[0])), evidence, match[0].length);
}

function entity(type: string, value: string, confidence: number, field: string, item: CollectedItem, context: ExtractionContext, assertionKind: string, reviewReasons: string[], offset: number, evidenceText = `${field}: ${value}`, evidenceLength = value.length): ExtractedEntity {
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
    provenance: [provenance(context, startOffset, startOffset + evidenceLength, evidenceText)]
  } as ExtractedEntity;
}

function provenance(context: ExtractionContext, startOffset: number, endOffset: number, evidenceText: string): ExtractionProvenance {
  return { ...context, extractorVersion: SOURCE_SPECIFIC_EXTRACTOR_VERSION, startOffset, endOffset, evidenceText: evidenceText.slice(0, 240) } as ExtractionProvenance;
}

function compact<T>(values: Array<T | undefined>): T[] { return values.filter((value): value is T => value !== undefined); }
function meaningful(value: unknown): string | undefined { return typeof value === "string" && value.trim() && !/^(?:unknown|n\/?a|not disclosed(?: by (?:the )?threat actor| by ta)?)$/i.test(value.trim()) ? value.trim() : undefined; }
