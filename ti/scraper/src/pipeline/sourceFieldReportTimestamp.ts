import { privateTarget } from "../registry/sourceRegistry.ts";

export function zonedSourceTimestamp(value: unknown) {
  const timestamp = typeof value === "string" ? value.trim() : "";
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) && Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
}

export function publicSourceReferenceUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.href.length > 2_048
      || !["http:", "https:"].includes(url.protocol)
      || url.username || url.password
      || privateTarget(url.hostname)
      || /(?:\.onion|\.i2p)$/i.test(url.hostname)
      || [...url.searchParams.keys()].some((key) => /token|secret|password|authorization|cookie|api[_-]?key|signature/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function sourceFieldReportTimestamp(input: {
  role: string;
  timestamp: unknown;
  referenceUrl: unknown;
  sourceId: string;
  sourceName?: string;
  evidencePath: string;
  parserVersion?: string;
}) {
  const timestamp = zonedSourceTimestamp(input.timestamp);
  const referenceUrl = publicSourceReferenceUrl(input.referenceUrl);
  return timestamp && referenceUrl ? { ...input, timestamp, referenceUrl, extractionMethod: "source_field" } : undefined;
}
