import type { SourceRecord } from "../types.ts";

export function sourceSummary(source: SourceRecord) {
  return { id: source.id, name: source.name, type: source.type, url: source.url, status: source.status, trustScore: source.trustScore };
}

export function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}
