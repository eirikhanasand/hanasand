import { hashContent } from "../utils.ts";
import { sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { tagsFor } from "./searchTags.ts";

export function rowFromCapture(capture: any, source?: any) {
  const metadataOnly = isMetadataOnlyCapture(capture);
  const summary = cleanSearchText(metadataOnly ? safeMetadataText(capture.metadata) : capture.body ?? capture.rawText ?? capture.metadata?.safeExcerpt ?? "");
  const title = cleanTitle(capture.title, summary, source?.name);
  const url = safePublicUrl(capture.url, capture.metadata);
  const claim = victimClaim(title);
  return {
    id: capture.id,
    sourceId: capture.sourceId,
    sourceName: source?.name ?? capture.sourceId,
    sourceFamily: source?.metadata?.sourceFamily ?? source?.type,
    title,
    summary: summary.slice(0, 500),
    publishedAt: capture.publishedAt,
    collectedAt: capture.collectedAt,
    url,
    urlHash: hashContent(String(capture.url ?? capture.id)).slice(0, 16),
    tags: tagsFor(`${title} ${summary}`),
    ...claim,
    actor: claim.actor ?? text(capture.metadata?.leakSite?.actorName ?? capture.metadata?.actorName),
    victimName: claim.victimName ?? text(capture.metadata?.leakSite?.victimName ?? capture.metadata?.victimName),
    provenanceHash: hashContent(capture.id),
    metadataOnly
  };
}

function victimClaim(title: string) {
  const match = title.match(/(?:🏴‍☠️\s*)?(.+?)\s+has just published a new victim\s*:\s*(.+)$/i);
  if (!match) return {};
  return { actor: match[1].trim(), victimName: match[2].trim(), claimType: "ransomware_victim_publication" };
}

function cleanTitle(title: unknown, summary: string, sourceName?: string) {
  const lines = summary.split("\n").map((line) => line.trim()).filter(Boolean);
  const fallback = lines[0] === sourceName ? lines[1] : lines[0];
  const cleaned = cleanSearchText(title || fallback || "Public intelligence row", 160);
  if (/window\.dataLayer|display:\s*none|function\s+\w+\s*\(/i.test(cleaned)) return sourceName || cleaned.split(/window\.dataLayer|display:\s*none|function\s+\w+\s*\(/i)[0].replace(/[.;\s]+$/, "");
  return cleaned.slice(0, 160);
}

function safeMetadataText(metadata: any) {
  const fields = metadata?.leakSite ?? metadata?.structuredFields ?? metadata?.exposureClaim ?? {};
  return [
    text(fields.actorName ?? metadata?.actorName),
    text(fields.victimName ?? metadata?.victimName),
    text(fields.claimedSector),
    text(fields.claimedCountry),
    text(fields.claimedDataType ?? fields.claimedDataCategory ?? fields.dataType),
    text(metadata?.safeExcerpt)
  ].filter(Boolean).join(". ");
}

function safePublicUrl(url: unknown, metadata: any) {
  const value = String(url ?? "");
  if (!/^https?:\/\//i.test(value) || /\.onion\b/i.test(value)) return undefined;
  if (metadata?.adapter === "darknet_metadata" || metadata?.captureMode === "metadata_only") return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some((key) => /(?:token|secret|password|authorization|cookie|api[_-]?key|signature)/i.test(key))) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isMetadataOnlyCapture(capture: any) {
  return capture.storageKind === "metadata_only" || capture.metadata?.adapter === "darknet_metadata";
}

export function cleanSearchText(value: unknown, maxLength = 500) {
  const cleaned = String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, " ")
    .replace(/\.[a-z][\w-]*\s*\{[^{}]{0,500}\}/gi, " ")
    .replace(/window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\]\s*;?/gi, " ")
    .replace(/function\s+gtag\s*\(\s*\)\s*\{\s*dataLayer\.push\(arguments\)\s*;?\s*\}\s*;?/gi, " ")
    .replace(/gtag\s*\(\s*['"]js['"]\s*,\s*new Date\(\)\s*\)\s*;?/gi, " ")
    .replace(/gtag\s*\(\s*['"]config['"]\s*,\s*['"][^'"]{1,100}['"]\s*\)\s*;?/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/<[^>\s]{1,24}(?=\s|$)/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&reg;/gi, "®").replace(/&copy;/gi, "©")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  return sanitizeDwmCustomerText(cleaned, undefined, maxLength) ?? "";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? sanitizeDwmCustomerText(value, undefined, 160) : undefined;
}
