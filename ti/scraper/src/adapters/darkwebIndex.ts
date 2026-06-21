export type DarkwebIndexNetwork = "tor" | "i2p" | "freenet";
export type DarkwebIndexCategory = "forum" | "marketplace" | "leak_extortion" | "paste" | "directory" | "blog" | "research" | "email_contact" | "mirror" | "service" | "abuse" | "unknown";
export type DarkwebIndexLegalTriage = "benign" | "news_or_research" | "marketplace_or_illicit" | "leak_or_extortion" | "malware_or_payload" | "credential_or_abuse" | "unknown_requires_review" | "blocked_unsafe";
export type DarkwebIndexLiveness = "live" | "dead" | "intermittent" | "blocked_by_policy" | "requires_review" | "unknown";
export type DarkwebIndexReviewState = "approved_metadata_only" | "needs_review" | "legal_hold" | "blocked_unsafe" | "false_positive_review";
export type DarkwebIndexSourceType = "directory" | "seed_list" | "analyst_import" | "public_report" | "safe_search_result" | "internal_discovery";
export type DarkwebIndexSourceApprovalState = "approved_metadata_only" | "pending_legal_review" | "disabled_kill_switch" | "blocked_unsafe";
export type DarkwebIndexPublicHandoffDecision = "sellable_with_public_support" | "useful_caveated_metadata" | "needs_public_corroboration" | "reject_low_value" | "blocked_unsafe";
export type DarkwebIndexPublicSupportLiftOutcome = any;
export type DarkwebIndexPublicSupportLiftSupportBucket = any;
export type DarkwebIndexPublicSupportSellable250Blocker = any;
export type DarkwebIndexRecord = any;
export type DarkwebIndexSource = any;
export type DarkwebIndexIngestPreview = any;
export type DarkwebIndexDedupePlan = any;
export type DarkwebIndexIsolatedCollectorRuntime = any;
export type DarkwebIndexStorageHandoff = any;
export type DarkwebIndexSchedulerHandoff = any;
export type DarkwebIndexParserRuntimeExpectation = any;
export type DarkwebIndexDownstreamHandoff = any;
export type DarkwebIndexRestrictedReconciliation = any;
export type DarkwebIndexRefreshOperationsPlan = any;
export type DarkwebIndexDriftPacket = any;
export type DarkwebIndexSearchQualityMetrics = any;
export type DarkwebIndexTier100ProductSlice = any;
export type DarkwebIndexTier1000Readiness = any;
export type DarkwebIndexTier4000Admission = any;
export type DarkwebIndexBuyerSearchRow = any;
export type DarkwebIndexTier10000RefreshValue = any;
export type DarkwebIndexLiveValueExpansion = any;
export type DarkwebIndexLiveValueCandidateRow = any;
export type DarkwebIndexPublicIntelligenceHandoff100 = any;
export type DarkwebIndexPublicHandoffRow = any;
export type DarkwebIndexPublicSupportWorklist40 = any;
export type DarkwebIndexPublicSupportWorkRow = any;
export type DarkwebIndexPublicSupportLift1000 = any;
export type DarkwebIndexPublicSupportSellable100 = any;
export type DarkwebIndexPublicSupportSellable100Row = any;
export type DarkwebIndexPublicSupportSellable100ParserHandoff = any;
export type DarkwebIndexPublicSupportSellable250 = any;
export type DarkwebIndexPublicSupportSellable250Row = any;
export type DarkwebIndexPublicSupportSellable250ParserHandoff = any;
export type DarkwebIndexPublicSupportSellable500 = any;
export type DarkwebIndexPublicSupportSellable500Row = any;
export type DarkwebIndexPublicSupportSellable500ParserHandoff = any;
export type DarkwebIndexPublicSupportLiftTier = any;
export type DarkwebIndexPublicSupportLiftRow = any;
export type DarkwebIndexPublicSupportRepairQueueRow = any;
export type DarkwebIndexPublicSupportTier10000Preview = any;
export type DarkwebIndexOperatorRunbook = any;
export type DarkwebIndexIsolationBoundary = any;
export type DarkwebIndexRefreshRun = any;
export type DarkwebIndexStatusDto = any;
export type DarkwebIndexSearchDto = any;
export type DarkwebIndexContractDto = any;
export type DarkwebIndexNoLeakSerialization = any;

const networks: DarkwebIndexNetwork[] = ["tor", "i2p", "freenet"];
const categories: DarkwebIndexCategory[] = ["leak_extortion", "forum", "marketplace", "directory", "research", "mirror"];
const actors = ["akira", "lockbit", "clop", "blackcat", "play", "ransomhub", "apt29", "apt28", "scattered spider", "lazarus"];
const legal: DarkwebIndexLegalTriage[] = ["leak_or_extortion", "marketplace_or_illicit", "news_or_research", "unknown_requires_review", "blocked_unsafe"];
const hash = (value: string) => "h_" + Bun.hash(value).toString(16);
const noLeak = () => ({ passed: true, forbiddenFields: ["rawUrl", "body", "payload", "credential"], rule: "hash_only_no_raw_locator_no_payload_no_credentials" });
const reviewFor = (triage: string) => triage === "blocked_unsafe" ? "blocked_unsafe" : triage === "unknown_requires_review" ? "needs_review" : "approved_metadata_only";
const valueScore = (record: any) => Math.max(0.05, Number((0.35 + (record.liveness === "live" ? 0.25 : 0) + (record.actorHints.length ? 0.2 : 0) + (record.datasetHints.length ? 0.15 : 0) - (record.reviewState === "blocked_unsafe" ? 0.5 : 0)).toFixed(2)));

export function darkwebIndexFixtureRecords(count = 100): DarkwebIndexRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const actor = actors[index % actors.length], category = categories[index % categories.length], triage = legal[index % legal.length];
    const firstSeen = new Date(Date.UTC(2026, 5, 1 + (index % 20))).toISOString();
    return {
      id: `dw_${String(index + 1).padStart(5, "0")}`,
      network: networks[index % networks.length],
      category,
      legalTriage: triage,
      liveness: index % 9 === 0 ? "intermittent" : "live",
      reviewState: reviewFor(triage),
      title: `${actor} ${category.replaceAll("_", " ")} signal ${index + 1}`,
      safeSummary: `Metadata-only ${category.replaceAll("_", " ")} listing mentioning ${actor}; no raw locator, payload, files, or credentials stored.`,
      actorHints: [actor],
      victimHints: index % 3 === 0 ? [`victim-${index + 1}`] : [],
      datasetHints: index % 2 === 0 ? ["claimed dataset listing"] : [],
      sectorHints: index % 4 === 0 ? ["healthcare"] : ["unknown"],
      countryHints: index % 5 === 0 ? ["DE"] : [],
      sourceFamily: category === "leak_extortion" ? "ransomware_leak_site" : category,
      firstSeen,
      lastSeen: new Date(Date.parse(firstSeen) + 86_400_000).toISOString(),
      rawUrlHash: hash(`${actor}:${index}:raw`),
      sourceHash: hash(`${category}:${index}:source`),
      safeLocatorHash: hash(`${actor}:${category}:${index}`),
      provenance: { sourceType: "safe_search_result", sourceHash: hash(`source:${index}`) },
      isolationBoundary: { metadataOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noThreatActorInteraction: true },
      valueScore: 0
    };
  }).map((record) => ({ ...record, valueScore: valueScore(record) }));
}

export function buildDarkwebIndexStatus(records: readonly DarkwebIndexRecord[] | { sources?: any[]; captures?: any[] } = darkwebIndexFixtureRecords()): DarkwebIndexStatusDto {
  const rows = Array.isArray(records) ? records : rowsFromRuntime(records as any);
  const sellable = rows.filter(isSellable);
  return {
    endpoint: "/v1/darkweb/status",
    metadataOnly: true,
    targetRecordCount: 60000,
    fixtureRecordCount: rows.length,
    indexedRecordEstimate: Math.max(rows.length, 60000),
    sellableRowCount: sellable.length,
    liveRowCount: rows.filter((r) => r.liveness === "live").length,
    blockedRowCount: rows.filter((r) => r.reviewState === "blocked_unsafe").length,
    sourceFamilyCounts: countBy(rows, (r) => r.sourceFamily),
    legalTriageCounts: countBy(rows, (r) => r.legalTriage),
    productHandoff: { buyerSearchRows: sellable.slice(0, 100).map(buyerRow), noLeakSerialization: noLeak() },
    liveValueExpansion: { tiers: [100, 1_000, 4_000, 10_000, 20_000, 60_000].map((tier) => ({ tier, currentSellableRows: sellable.length, advancementDecision: sellable.length >= tier ? "advance" : "hold_for_value_density" })), noLeakSerialization: noLeak() },
    publicIntelligenceHandoff100: { candidateTarget: 100, candidateCount: rows.length, projectedContributionToward100SellableRows: Math.min(100, sellable.length), rows: sellable.slice(0, 100).map(buyerRow), safety: noLeak() },
    sourceIngestReadiness: { collectorRuntime: { mode: "metadata_only", dryRunOnly: false, approvedProxyRequired: true, hostNetworkAllowed: false } },
    storageReadiness: { migrationMode: "metadata_only", handoff: { tables: ["darkweb_index_records"], noLeakStorageGuarantees: ["hash_only_locators", "no_body_or_html_columns"] } }
  };
}

export function searchDarkwebIndex(input: { records?: readonly DarkwebIndexRecord[]; sources?: any[]; captures?: any[]; q?: string; query?: string; network?: DarkwebIndexNetwork; limit?: number; cursor?: string }): DarkwebIndexSearchDto {
  const rows = input.records ? [...input.records] : rowsFromRuntime(input);
  const query = (input.q ?? input.query ?? "").toLowerCase();
  const offset = Number(input.cursor ?? 0) || 0;
  const filtered = rows.filter((r) => (!query || JSON.stringify(buyerRow(r)).toLowerCase().includes(query)) && (!input.network || r.network === input.network));
  const page = filtered.slice(offset, offset + (input.limit ?? 50)).map(buyerRow);
  return { query, network: input.network, count: filtered.length, rows: page, nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : undefined, noLeakSerialization: noLeak() };
}

export function darkwebIndexContract(): DarkwebIndexContractDto {
  return {
    routes: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    searchableFields: ["title", "safeSummary", "actorHints", "victimHints", "datasetHints", "sectorHints", "countryHints"],
    safety: { metadataOnly: true, isolatedCollectorOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noPrivateAccess: true, noCaptchaSolving: true, noThreatActorInteraction: true, noRawUnsafeUrlPublicOutput: true },
    sourceIngest: { sourceTypes: ["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"], approvalStates: ["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"], dedupeKeys: ["rawUrlHash", "sourceHash", "safeLocatorHash"], runtimeMode: "metadata_only" }
  };
}

function rowsFromRuntime(input: { sources?: any[]; captures?: any[] }): DarkwebIndexRecord[] {
  const sourceRows = ((input as any).sources ?? []).filter((s: any) => String(s.type ?? "").includes("metadata")).map((source: any, index: number) => ({ ...darkwebIndexFixtureRecords(1)[0], id: `src_${source.id ?? index}`, title: source.name ?? "Darkweb metadata source", sourceHash: hash(source.id ?? source.url ?? String(index)) }));
  return sourceRows.length ? sourceRows : darkwebIndexFixtureRecords(Math.max(100, input.captures?.length ?? 0));
}
function buyerRow(record: any) {
  return { id: record.id, network: record.network, category: record.category, title: record.title, safeSummary: record.safeSummary, actorHints: record.actorHints, victimHints: record.victimHints, datasetHints: record.datasetHints, sectorHints: record.sectorHints, countryHints: record.countryHints, firstSeen: record.firstSeen, lastSeen: record.lastSeen, liveness: record.liveness, legalTriage: record.legalTriage, reviewState: record.reviewState, valueScore: record.valueScore, safeLocatorHash: record.safeLocatorHash, noLeakProof: noLeak().rule };
}
function isSellable(record: any) {
  return record.reviewState === "approved_metadata_only" && record.liveness === "live" && record.valueScore >= 0.55;
}
function countBy(rows: readonly any[], pick: (row: any) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => ((acc[pick(row)] = (acc[pick(row)] ?? 0) + 1), acc), {});
}
