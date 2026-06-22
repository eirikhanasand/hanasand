import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";
import type { RansomwareLiveCard } from "./ransomwareLiveCards.ts";

export function ransomwareLiveCardResponse(query: string, cards: RansomwareLiveCard[], sourceUrl: string, mode = "ransomware_live_group_page", sourceLabel = "Ransomware.live"): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  const dated = cards.map((card) => ({ card, iso: safeIso(card.discovered) ?? generatedAt }));
  const activities = dated.map(({ card, iso }, index) => victimClaimActivity(card, iso, index, sourceUrl));
  return {
    query, generatedAt, mode, status: "partial",
    runId: `${mode}_${stableHash(`${query}:${cards.length}:${generatedAt}`)}`,
    refreshAfterSeconds: 1800,
    summary: `Public ransomware victim-claim metadata matching ${query}.`,
    confidence: dated.length >= 10 ? 0.72 : 0.64,
    lastSeen: dated[0]?.iso ?? generatedAt,
    aliases: [], targets: [], ttps: [], datasets: [],
    recentActivity: activities,
    sources: dated.map(({ card }, index) => ({
      id: `rwlive_group_${index}`,
      name: `${card.group} victim metadata: ${card.victim}`,
      type: "captured_public_source",
      provenance: `${sourceLabel} public victim-claim metadata`,
      url: sourceUrl
    })),
    notes: [`${sourceLabel} public victim-claim metadata; no leaked files or credentials`]
  };
}

type Activity = TiSearchResponse["recentActivity"][number];

function victimClaimActivity(card: RansomwareLiveCard, iso: string, index: number, sourceUrl: string): Activity {
  return baseActivity(card, iso, index, sourceUrl, {
    title: `${card.group} victim claim: ${card.victim}`,
    detail: detail(card),
    impact: "public ransomware victim claim metadata"
  });
}

function baseActivity(
  card: RansomwareLiveCard,
  iso: string,
  index: number,
  sourceUrl: string,
  fields: Pick<Activity, "title" | "detail" | "impact">
): Activity {
  const dataClaim = dataClaimFromDescription(card.description, card.dataSize);
  return {
    date: iso,
    title: fields.title,
    detail: fields.detail,
    confidence: 0.68,
    sourceIds: [`rwlive_group_${index}`],
    url: card.publicUrl ?? card.postUrl ?? sourceUrl,
    claimType: "victim_claim",
    victimName: card.victim,
    matchedSearchTerm: card.matchedSearchTerm,
    victimWebsite: card.website,
    actorPostUrl: card.postUrl,
    claimedDataSummary: dataClaim.summary,
    claimedDataSize: dataClaim.size,
    claimedDataTypes: dataClaim.types,
    affectedSectors: card.sector ? [card.sector] : undefined,
    countries: card.country ? [card.country] : undefined,
    firstReportedAt: iso,
    lastReportedAt: iso,
    publisherCount: 1,
    impact: fields.impact
  };
}

function detail(card: RansomwareLiveCard): string {
  const dataClaim = dataClaimFromDescription(card.description, card.dataSize);
  const parts = [
    card.matchedSearchTerm && `Matched search: ${card.matchedSearchTerm}.`,
    dataClaim.summary && `Claimed data: ${dataClaim.summary}.`,
    card.sector && `Sector: ${card.sector}.`,
    card.country && `Country: ${card.country}.`,
    card.attackDate && `Estimated attack: ${card.attackDate}.`
  ]
    .filter(Boolean)
    .join(" ");
  return parts || `${card.victim} is listed as a public victim claim for ${card.group}.`;
}

function dataClaimFromDescription(description: string | undefined, dataSizeHint?: string): { summary?: string; size?: string; types?: string[] } {
  const text = description?.replace(/\s+/g, " ").trim();
  const size = normalizedDataSize(dataSizeHint) ?? normalizedDataSize(text?.match(/\b\d+(?:[.,]\d+)?\s*(?:tb|gb|mb|terabytes?|gigabytes?|megabytes?)\b/i)?.[0]);
  if (!text) return size ? { summary: `claimed ${size}`, size, types: [] } : {};
  const patterns: Array<[RegExp, string]> = [
    [/\b(?:employee|staff|hr|workforce|applicant)s?\s+(?:personal\s+)?(?:data|documents?|files?|records?|information)|\b(?:passports?|ssn|social security|driver'?s licenses?|medical records?|payroll|hr files?)\b/i, "employee personal data"],
    [/\b(?:client|customer|consumer|patient|student)s?\s+(?:data|documents?|files?|records?|information|database)\b/i, "customer/client data"],
    [/\b(?:contracts?\s+(?:and\s+agreements|documents?|files?|records?)|confidential\s+agreements?|shareholder\s+agreements?|executed\s+ndas?|ndas?|legal documents?|litigation docs?)\b/i, "contracts and agreements"],
    [/financial|invoice|payment|bank|accounting|tax/i, "financial records"],
    [/\b(?:project|engineering|design|cad|technical|drawing|specification)s?\s+(?:data|documents?|files?|records?|drawings?|specifications?)|\b(?:source code|repositories|repository|pdm server)\b/i, "project or technical files"],
    [/\b(?:credentials?|passwords?|stored logins?|recovery keys?|bitlocker keys?|api keys?|ssh keys?)\b/i, "access or credential material"],
    [/email|mailbox|correspondence/i, "email or correspondence"],
    [/database|db dump|backup|sql/i, "databases or backups"]
  ];
  const rawTypes = patterns.flatMap(([pattern, label]) => pattern.test(text) ? [label] : []);
  const hasClaimLanguage = /\b(leak|publish|dump|exfiltrat|stolen|stole|download|sell|sale|auction|archive|compromis|breach|exposed|accessed)\b/i.test(text);
  const hasHighRiskDataPhrase = /\b(passports?|ssn|social security|driver'?s licenses?|payroll|hr files?|medical|financial records?|bank records?|database|db dump|backup|source code|repository|email backups?|credentials?|passwords?|stored logins?|recovery keys?|bitlocker keys?|confidential (?:files|documents|data)|customer data|employee data|personal (?:data|documents|information))\b/i.test(text);
  const types = rawTypes.filter((type) =>
    hasClaimLanguage ||
    size ||
    hasHighRiskDataPhrase ||
    !["customer/client data", "contracts and agreements", "project or technical files"].includes(type)
  );
  const summaryParts = [
    size && `claimed ${size}`,
    types.length && `mentions ${types.slice(0, 4).join(", ")}`
  ].filter(Boolean);
  if (!summaryParts.length && !hasClaimLanguage) return {};
  if (types.length && !size && !hasClaimLanguage && !hasHighRiskDataPhrase) return {};
  return {
    summary: summaryParts.length ? summaryParts.join("; ") : "public victim description contains a data-access or leak claim",
    size,
    types: [...new Set(types)]
  };
}

function normalizedDataSize(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized || /^0\s*(?:tb|gb|mb|b)?$/i.test(normalized)) return undefined;
  const match = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|terabytes?|gigabytes?|megabytes?)\b/i);
  if (!match) return undefined;
  const unit = unitLabel(match[2] ?? "");
  return unit ? `${match[1]} ${unit}` : undefined;
}

function unitLabel(value: string): string | undefined {
  if (/^t/i.test(value)) return "TB";
  if (/^g/i.test(value)) return "GB";
  if (/^m/i.test(value)) return "MB";
  return undefined;
}
