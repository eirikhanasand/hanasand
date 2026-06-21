// @ts-nocheck
import type { PipelineResult } from "../types.ts";
import type { TemporalExtraction } from "./intelligenceProfileTypes.ts";

export function extractTemporal(result: PipelineResult): TemporalExtraction {
  const text = `${result.capture.body ?? ""} ${result.incident?.summary ?? ""}`;
  const dates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+20\d{2})\b/gi)].map((m) => normDate(m[1])).filter(Boolean);
  const firstSeenAt = labeledDate(text, /first seen(?: on| in)?\s+/i), lastSeenAt = labeledDate(text, /last seen(?: on| in)?\s+/i), incidentDate = labeledDate(text, /(?:incident date|observed on|activity on)\s+/i);
  const reportPublishedAt = result.capture.publishedAt ?? firstIso(result.capture.metadata.publishedAt) ?? firstIso(result.capture.collectedAt);
  const anchor = lastSeenAt ?? incidentDate ?? dates[0] ?? reportPublishedAt;
  return {
    reportPublishedAt,
    incidentDate,
    campaignWindow: { start: labeledDate(text, /(?:campaign window|campaign from|between)\s+/i), end: labeledDate(text, /\b(?:through|to|and)\s+/i) },
    firstSeenAt,
    lastSeenAt,
    claimedLeakDate: labeledDate(text, /(?:claimed leak date|leak date|posted on)\s+/i),
    observedInfrastructureDate: labeledDate(text, /(?:infrastructure (?:observed|seen) on|observed infrastructure on)\s+/i),
    freshnessScore: freshness(anchor, result.capture.collectedAt),
    notes: [...(dates.length ? [] : ["no explicit dates found in source text"]), ...(!incidentDate && !firstSeenAt && !lastSeenAt ? ["temporal extraction is based on publication/collection date only"] : [])]
  };
}

function labeledDate(text: string, label: RegExp) {
  const start = label.exec(text);
  if (!start) return;
  const slice = text.slice(start.index + start[0].length, start.index + start[0].length + 48);
  const date = /\b(20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+20\d{2})\b/i.exec(slice)?.[1];
  return date ? normDate(date) : undefined;
}

const normDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value}T00:00:00.000Z`
  : Number.isNaN(Date.parse(value)) ? undefined : new Date(Date.parse(value)).toISOString();
const firstIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined;

function freshness(anchor: string | undefined, collectedAt: string) {
  if (!anchor || Number.isNaN(Date.parse(anchor)) || Number.isNaN(Date.parse(collectedAt))) return 0.25;
  const days = Math.max(0, (Date.parse(collectedAt) - Date.parse(anchor)) / 86400000);
  return days <= 7 ? 0.95 : days <= 30 ? 0.75 : days <= 180 ? 0.5 : 0.25;
}
