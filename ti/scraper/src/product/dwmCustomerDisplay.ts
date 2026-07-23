import { hashContent, normalizeWhitespace } from "../utils.ts";
import { sanitizeCustomerOutboundText } from "../../../../api/src/utils/dwm/customerOutputSafety.ts";

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

export function sanitizeDwmCustomerValue<T>(value: T): T {
  if (typeof value === "string") return (sanitizeDwmCustomerText(value, "", 1000) ?? "") as T;
  if (Array.isArray(value)) return value.map(sanitizeDwmCustomerValue) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDwmCustomerValue(item)])) as T;
}

export function sanitizeDwmApiPayload<T>(value: T): T {
  return sanitizeApiValue(value, []) as T;
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
  const text = normalizeWhitespace(scrubSensitiveLocations(value))
    .replace(STRUCTURED_TEXT_KEYS, "")
    .replace(JSON_PUNCTUATION, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text ? text.slice(0, maxLength).trim() : undefined;
}

function sanitizeApiValue(value: unknown, path: string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeApiValue(item, path));
  if (!value || typeof value !== "object") return typeof value === "string" ? scrubSensitiveLocations(value, false) : value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (UNSAFE_API_KEYS.has(lowerKey)) continue;
    if (lowerKey === "body" && (path.at(-1) !== "payload" || !item || typeof item !== "object")) continue;
    if (lowerKey === "webhookurl") {
      if (typeof item === "string" && item) output.webhookEndpointHash ??= hashContent(item);
      continue;
    }
    if ((lowerKey === "url" || lowerKey === "sourceurl" || lowerKey === "targeturl") && typeof item === "string" && isRestrictedLocation(item)) {
      output[`${key}Hash`] = hashContent(item);
      continue;
    }
    if (lowerKey === "excerpt") {
      output[key] = sanitizeDwmCustomerEvidenceExcerpt(item);
      continue;
    }
    output[key] = sanitizeApiValue(item, [...path, key]);
  }
  return output;
}

function scrubSensitiveLocations(value: string, minimizeContacts = true): string {
  if (minimizeContacts) return sanitizeCustomerOutboundText(value);
  const minimized = value;
  return minimized
    .replace(/\b(?:https?|socks5?):\/\/[^\s"'<>]*(?:\.onion|\.i2p)(?:[^\s"'<>]*)?/gi, "[restricted source]")
    .replace(/\b[a-z0-9-]{3,56}\.(?:onion|i2p)(?:\/[^\s"'<>]*)?/gi, "[restricted source]")
    .replace(/\bmetadata:\/\/darkweb\/[^\s"'<>]*/gi, "[restricted source]")
    .replace(/\bfreenet:[^\s"'<>]*/gi, "[restricted source]")
    .replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[credentials-redacted]@")
    .replace(/\b(password|passwd|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*([^\s&]+)/gi, "$1=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[credential redacted]");
}

function isRestrictedLocation(value: string): boolean {
  return /(?:\.onion|\.i2p|^metadata:\/\/darkweb\/|^freenet:|^unsafe:)/i.test(value);
}

const UNSAFE_API_KEYS = new Set([
  "rawtext",
  "rawpayload",
  "rawmessage",
  "rawbody",
  "mediapayload",
  "sessionstring",
  "objectkey",
  "objectref",
  "authorization",
  "token",
  "apikey",
  "api_key",
  "headers",
  "proxyurl",
  "cookie",
  "password",
  "credentials",
  "secret"
]);
