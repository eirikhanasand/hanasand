import { normalizeWhitespace } from "../utils.ts";

const STRUCTURED_TEXT_KEYS = /\b(actorName|victimName|claimedData|claimSummary|sourceFamily|sourceName|evidence|metadata|contentHash|raw|body|excerpt)\b\s*[:=]\s*/gi;
const JSON_PUNCTUATION = /[{}\[\]"]/g;

export function sanitizeDwmCustomerText(value: unknown, fallback?: string, maxLength = 500): string | undefined {
  const raw = normalizeWhitespace(String(value ?? ""));
  const fallbackText = fallback ? scrubCustomerText(fallback, maxLength) : undefined;
  if (!raw) return fallbackText;

  const structured = structuredDwmSummary(raw);
  const text = structured ?? raw;
  const scrubbed = scrubCustomerText(text, maxLength);
  return scrubbed || fallbackText;
}

export function buildDwmCustomerAlertSummary(alert: any, fallback?: string): string | undefined {
  const actor = firstText(alert?.actor);
  const company = firstText(alert?.company);
  const matchedTerm = firstText(alert?.matchedTerm?.value ?? alert?.matchedTerm);
  const sourceFamily = firstText(alert?.sourceFamily);
  const claimedData = firstText(alert?.claimedData ?? alert?.dataDescription);

  const subject = company ?? matchedTerm;
  const base = actor && subject
    ? `${actor} exposure claim for ${subject}`
    : subject
      ? `Exposure claim for ${subject}`
      : actor
        ? `${actor} exposure claim`
        : fallback;
  const suffix = claimedData ? `: ${claimedData}` : sourceFamily ? `. Source ${sourceFamily}` : "";
  return sanitizeDwmCustomerText(alert?.claimSummary, base ? `${base}${suffix}` : undefined);
}

export function sanitizeDwmCustomerEvidenceExcerpt(value: unknown, fallback?: string): string | undefined {
  return sanitizeDwmCustomerText(value, fallback, 500);
}

function structuredDwmSummary(raw: string): string | undefined {
  const parsed = parseStructured(raw);
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = Array.isArray(parsed) ? parsed.find((item) => item && typeof item === "object") : parsed;
  if (!record || typeof record !== "object") return undefined;

  const actor = pickText(record, ["actorName", "actor", "threatActor", "group"]);
  const company = pickText(record, ["victimName", "victim", "company", "companyName", "organization", "matchedTerm"]);
  const claimedData = pickText(record, ["claimedData", "data", "description", "summary", "claim", "excerpt", "text"]);
  const sourceFamily = pickText(record, ["sourceFamily", "source", "sourceName"]);

  const base = actor && company
    ? `${actor} exposure claim for ${company}`
    : company
      ? `Exposure claim for ${company}`
      : actor
        ? `${actor} exposure claim`
        : undefined;
  const detail = claimedData && claimedData !== base ? claimedData : undefined;
  const source = sourceFamily ? `Source ${sourceFamily}` : undefined;
  return [base, detail, source].filter(Boolean).join(". ");
}

function parseStructured(raw: string): unknown {
  if (!/^[\[{]/.test(raw)) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function pickText(record: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = firstText(record?.[key]);
    if (value) return scrubCustomerText(value, 160);
  }
  return undefined;
}

function firstText(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.map(firstText).find(Boolean);
  if (value && typeof value === "object") return structuredDwmSummary(JSON.stringify(value));
  const text = normalizeWhitespace(String(value ?? ""));
  return text || undefined;
}

function scrubCustomerText(value: string, maxLength: number): string | undefined {
  const text = normalizeWhitespace(value)
    .replace(STRUCTURED_TEXT_KEYS, "")
    .replace(JSON_PUNCTUATION, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text ? text.slice(0, maxLength).trim() : undefined;
}
