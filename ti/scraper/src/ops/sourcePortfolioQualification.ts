import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";

export const SOURCE_PORTFOLIO_BASELINE = {
  clearWeb: 5_000,
  lawfulDarkWeb: 1_000,
  publicTelegram: 100,
  total: 6_100
} as const;

export function qualifySourcePortfolio(input: {
  sources: any[];
  observations: any[];
  captures: any[];
  generatedAt: string;
}) {
  const observationsBySource = groupBySource(input.observations);
  const capturesBySource = groupBySource(input.captures);
  const canonicalOwner = new Map<string, string>();
  const captureCountBySource = new Map([...capturesBySource].map(([sourceId, captures]) => [sourceId, captures.length]));
  for (const source of input.sources.filter(isExecutableSource).sort((left, right) =>
    (captureCountBySource.get(right.id) ?? 0) - (captureCountBySource.get(left.id) ?? 0)
    || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""))
    || String(left.id).localeCompare(String(right.id)))) {
    const key = canonicalSourceKey(source);
    if (key && !canonicalOwner.has(key)) canonicalOwner.set(key, source.id);
  }

  const sources = input.sources.map((source) => {
    const observations = [...(observationsBySource.get(source.id) ?? [])].sort(byCheckedAt);
    const captures = [...(capturesBySource.get(source.id) ?? [])].sort(byCaptureTime);
    const scheduled = observations.filter((row) => typeof row.collectionRunId === "string" && row.collectionRunId.trim());
    const latest = scheduled.at(-1);
    const successes = scheduled.filter((row) => row.success === true);
    const productive = scheduled.filter((row) => Number(row.captureCount ?? 0) > 0);
    const latestCapture = captures.at(-1);
    const family = baselineFamily(source);
    const lastCheckedAt = validTime(latest?.checkedAt);
    const lastSuccessAt = validTime(successes.at(-1)?.checkedAt);
    const lastUsefulAt = validTime(productive.at(-1)?.checkedAt);
    const lastContentAt = validTime(latestCapture?.publishedAt) ?? validTime(latestCapture?.collectedAt);
    const cadenceSeconds = positiveNumber(source.crawlFrequencySeconds, 86_400);
    const checkWindowSeconds = Math.max(86_400, cadenceSeconds * 3);
    const activityWindowSeconds = Math.max(checkWindowSeconds, positiveNumber(source.metadata?.activityWindowSeconds, 30 * 86_400));
    const reasons: string[] = [];
    const canonicalKey = canonicalSourceKey(source);

    if (!isExecutableSource(source)) reasons.push("not_executable");
    if (!family) reasons.push("not_an_intelligence_feed");
    if (!String(source.legalNotes ?? "").trim()) reasons.push("missing_legal_basis");
    if (canonicalKey && canonicalOwner.get(canonicalKey) !== source.id) reasons.push("duplicate_feed");
    if (family === "lawful_dark_web" && !(source.governance?.metadataOnly === true || source.metadata?.captureMode === "metadata_only")) reasons.push("dark_web_not_metadata_only");
    if (successes.length < 2) reasons.push("insufficient_successful_checks");
    if (productive.length < 2) reasons.push("insufficient_productive_cycles");
    if (!captures.length) reasons.push("no_retained_evidence");
    if (!lastContentAt) reasons.push("missing_content_update_time");
    if (!lastUsefulAt) reasons.push("missing_useful_intelligence_time");
    if (!recent(lastCheckedAt, input.generatedAt, checkWindowSeconds)) reasons.push("check_overdue");
    if (!recent(lastContentAt, input.generatedAt, activityWindowSeconds)) reasons.push("content_stale_for_activity_window");

    return {
      sourceId: source.id,
      family,
      qualifies: reasons.length === 0,
      reasons,
      checkCount: observations.length,
      scheduledCheckCount: scheduled.length,
      successfulCheckCount: successes.length,
      usefulCheckCount: productive.length,
      productiveCheckCount: productive.length,
      latestCheckUseful: Number(latest?.captureCount ?? 0) > 0,
      retainedCaptureCount: captures.length,
      lastCheckedAt,
      lastSuccessAt,
      lastContentAt,
      lastUsefulAt,
      backoffUntil: validTime(source.crawlState?.backoffUntil),
      checkWindowSeconds,
      activityWindowSeconds
    };
  });
  const qualifying = sources.filter((source) => source.qualifies);
  const counts = {
    clearWeb: qualifying.filter((source) => source.family === "clear_web").length,
    lawfulDarkWeb: qualifying.filter((source) => source.family === "lawful_dark_web").length,
    publicTelegram: qualifying.filter((source) => source.family === "public_telegram").length,
    total: qualifying.length
  };

  return {
    schemaVersion: "ti.source_portfolio_qualification.v1",
    generatedAt: input.generatedAt,
    baseline: SOURCE_PORTFOLIO_BASELINE,
    counts,
    gaps: {
      clearWeb: Math.max(0, SOURCE_PORTFOLIO_BASELINE.clearWeb - counts.clearWeb),
      lawfulDarkWeb: Math.max(0, SOURCE_PORTFOLIO_BASELINE.lawfulDarkWeb - counts.lawfulDarkWeb),
      publicTelegram: Math.max(0, SOURCE_PORTFOLIO_BASELINE.publicTelegram - counts.publicTelegram),
      total: Math.max(0, SOURCE_PORTFOLIO_BASELINE.total - counts.total)
    },
    baselineMet: counts.clearWeb >= SOURCE_PORTFOLIO_BASELINE.clearWeb
      && counts.lawfulDarkWeb >= SOURCE_PORTFOLIO_BASELINE.lawfulDarkWeb
      && counts.publicTelegram >= SOURCE_PORTFOLIO_BASELINE.publicTelegram
      && counts.total >= SOURCE_PORTFOLIO_BASELINE.total,
    sources
  };
}

function baselineFamily(source: any): "clear_web" | "lawful_dark_web" | "public_telegram" | undefined {
  if (source.metadata?.transportCanary === true) return undefined;
  if (source.type === "telegram_public") return "public_telegram";
  if (["tor_metadata", "darkweb_metadata"].includes(source.type)) return "lawful_dark_web";
  if (["rss", "api", "json_api", "blog"].includes(source.type)) return "clear_web";
}

function canonicalSourceKey(source: any) {
  return source.url ? canonicalFeedKey(source.url) : "";
}

function groupBySource(records: any[]) {
  const grouped = new Map<string, any[]>();
  for (const record of records) {
    const rows = grouped.get(record.sourceId);
    if (rows) rows.push(record);
    else grouped.set(record.sourceId, [record]);
  }
  return grouped;
}

function byCheckedAt(left: any, right: any) {
  return (Date.parse(left?.checkedAt ?? "") || 0) - (Date.parse(right?.checkedAt ?? "") || 0);
}

function byCaptureTime(left: any, right: any) {
  return (Date.parse(left?.publishedAt ?? left?.collectedAt ?? "") || 0) - (Date.parse(right?.publishedAt ?? right?.collectedAt ?? "") || 0);
}

function validTime(value: unknown) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function recent(value: string | undefined, generatedAt: string, windowSeconds: number) {
  const ageMs = Date.parse(generatedAt) - Date.parse(String(value ?? ""));
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= windowSeconds * 1_000;
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
