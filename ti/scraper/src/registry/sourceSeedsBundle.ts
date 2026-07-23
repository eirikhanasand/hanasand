import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { ACTORS, SAFE_ACCESS, SAFE_TYPES } from "./sourceSeedConstants.ts";
import { canonicalFeedKey } from "./sourceSeedUtils.ts";

export function validateSeedBundle(bundle: any, options: any = {}): any {
  return buildSeedImportReport(bundle, options);
}

export function importSeedBundle(bundle: any, options: any = {}): any {
  return buildSeedImportReport(bundle, options);
}

export function exportSeedBundle(sources: SourceRecord[], name: string, generatedAt = nowIso()) {
  return { version: 1, name, generatedAt, sources: sources.map((source) => ({ ...source })) };
}

export function seedDuplicateKey(source: { tenantId?: string; type: string; url?: string }): any {
  return canonicalFeedKey(source.url ?? "");
}

export function buildSafePublicSourcePackInstallPlan(bundle: any, mode: any = "dry_run"): any {
  const selectedMode = typeof mode === "string" ? mode : mode.mode ?? "dry_run";
  const report = validateSeedBundle(bundle, { dryRun: selectedMode === "dry_run", existingSources: mode.existingSources ?? [] });
  return { packName: bundle.name, mode: selectedMode, dryRun: selectedMode === "dry_run", valid: report.valid, safeToInstall: report.valid, willStartCrawling: false, willInstall: selectedMode !== "dry_run" ? report.accepted.length : 0, duplicateSourceCount: report.duplicates.length, recommendations: report.accepted.map((source: SourceRecord) => ({ sourceId: source.id, action: "install_candidate", requiredAction: "install_candidate", reasons: ["safe public source is not present in registry"] })), sources: report.accepted, errors: report.errors };
}

export function validateSafePublicStarterPackCoverage(bundle: any, queries = ACTORS): any {
  const report = validateSeedBundle(bundle);
  return { valid: report.valid, queries: queries.map((query: string) => ({ query, covered: report.accepted.length > 0, sourceCount: report.accepted.length })) };
}

export function explainSourceForQuery(source: SourceRecord, query: string): any {
  return { sourceId: source.id, query, matches: source.name.toLowerCase().includes(query.toLowerCase()) || source.url.toLowerCase().includes(query.toLowerCase()), reason: "source can provide public CTI metadata for this query" };
}

function buildSeedImportReport(bundle: any, options: any) {
  const importedAt = options.importedAt ?? nowIso(), seen = new Map<string, any>();
  const duplicates: any[] = [], errors: any[] = [], excluded: any[] = [], accepted: SourceRecord[] = [];
  for (const rawSource of bundle.sources ?? []) {
    const source = normalizeSeedSource(rawSource, bundle);
    const key = seedDuplicateKey(source);
    if (seen.has(key)) duplicates.push({ key, sourceId: source.id, existingSourceId: seen.get(key)?.id });
    seen.set(key, source);
    if (source.metadata?.sourcePortfolioExcluded === true) {
      excluded.push({ sourceId: source.id, reason: source.metadata?.sourcePortfolioQualificationState ?? "portfolio_excluded" });
      continue;
    }
    if (!SAFE_TYPES.has(source.type) || !SAFE_ACCESS.has(source.accessMethod) || source.risk === "high") errors.push({ sourceId: source.id, message: "source must be safe public CTI" });
    if (!source.legalNotes) errors.push({ sourceId: source.id, message: "legal notes are required" });
    accepted.push(toSourceRecord(source, importedAt));
  }
  for (const existing of options.existingSources ?? []) if ((bundle.sources ?? []).some((source) => seedDuplicateKey(source) === seedDuplicateKey(existing))) duplicates.push({ key: seedDuplicateKey(existing), existingSourceId: existing.id });
  return { dryRun: options.dryRun ?? false, valid: errors.length === 0 && duplicates.length === 0, accepted, excluded, errors, duplicates, compliance: { missingCatalog: [], missingLegalNotes: errors.filter((error) => String(error.message).includes("legal")), overlappingCoverage: duplicates }, activation: { approved: accepted.length } };
}

function normalizeSeedSource(source: any, bundle: any) {
  if (source.type || source.url || !source.publicUrl) return source;
  const disabledByDefault = bundle.disabledByDefault === true;
  const approvalState = source.approvalState ?? (disabledByDefault ? "pending" : "approved");
  const minIntervalSeconds = Number(source.rateLimit?.minIntervalSeconds ?? 3600);
  return {
    ...source,
    type: "telegram_public",
    url: source.publicUrl,
    accessMethod: "public_http",
    status: source.status ?? "candidate",
    risk: source.risk ?? "medium",
    crawlFrequencySeconds: Number.isFinite(minIntervalSeconds) ? Math.max(300, minIntervalSeconds) : 3600,
    legalNotes: source.legalNotes ?? source.compliance?.legalBasis ?? "Public Telegram candidate requires review before collection.",
    catalog: {
      ...(source.catalog ?? {}),
      approvalScope: source.compliance?.approvalScope ?? "public_requires_review",
      adapterCompatibility: ["telegram_public"],
      collection: {
        freshnessTargetSeconds: Number.isFinite(minIntervalSeconds) ? Math.max(300, minIntervalSeconds) : 3600
      }
    },
    governance: {
      ...(source.governance ?? {}),
      approvalState,
      approvalRequired: true,
      approvalScope: source.compliance?.approvalScope ?? "public_requires_review",
      metadataOnly: false
    },
    metadata: {
      ...(source.metadata ?? {}),
      sourceFamily: "telegram_public",
      publicTelegramCandidate: true,
      disabledByDefault,
      channelHandle: source.channelHandle,
      topicTags: source.topicTags ?? [],
      focus: source.focus ?? {},
      rateLimit: source.rateLimit ?? {},
      compliance: source.compliance ?? {},
      retentionClass: source.retentionClass,
      approvalState
    }
  };
}

function toSourceRecord(source: any, at: string): SourceRecord {
  return { id: source.id ?? stableId("src", source.url), name: source.name ?? source.url, type: source.type, url: source.url, accessMethod: source.accessMethod, status: source.status ?? "candidate", risk: source.risk ?? "low", trustScore: source.trustScore ?? 0.7, crawlFrequencySeconds: source.crawlFrequencySeconds ?? 3600, legalNotes: source.legalNotes ?? "", tenantId: source.tenantId, language: source.language, createdAt: source.createdAt ?? at, updatedAt: at, metadata: source.metadata ?? {}, catalog: source.catalog, governance: source.governance };
}
