import type { AdapterRunResult, CollectedItem, CollectionTask, SourceRecord } from "../types.ts";
import { hashContent, nowIso, uniqueStrings } from "../utils.ts";
import { productionEvidenceReplayRef } from "./productionAdapterRuntime.ts";
import type { PublicAdvisorySourceFamily } from "./publicAdvisory.ts";

export type LiveCaptureAdapterKind =
  | "rss_feed"
  | "static_html"
  | "report_index"
  | "public_advisory"
  | "pdf_report";

export type LiveCaptureFailureClass =
  | "none"
  | "http_error"
  | "parse_error"
  | "malformed_feed"
  | "unsupported_mime"
  | "excessive_redirects"
  | "unsafe_url"
  | "duplicate_content"
  | "stale_source"
  | "empty_capture"
  | "robots_or_legal_hold"
  | "content_too_large"
  | "rate_limited"
  | "not_modified";

export interface LiveCaptureRuntimeInput {
  generatedAt?: string;
  captures: LiveCaptureRuntimeCaptureInput[];
  previousDedupeKeys?: string[];
  requiredFixtureClasses?: LiveCaptureFixtureClass[];
}

export interface LiveCaptureRuntimeCaptureInput {
  source: SourceRecord;
  result: AdapterRunResult;
  adapter: LiveCaptureAdapterKind;
  task?: CollectionTask;
  contentType?: string;
  freshnessTargetSeconds?: number;
  timeoutMs?: number;
  maxBytes?: number;
  mimeAllowlist?: string[];
  redirectCount?: number;
  queryClass?: "actor" | "ransomware" | "cve_advisory" | "malware_tool" | "sector" | "country" | "victim" | "campaign" | "unknown";
}

export type LiveCaptureStatus = "captured" | "empty" | "failed" | "duplicate" | "stale";

export interface LiveCaptureRuntimeRowDto {
  schemaVersion: "ti.live_capture_runtime_row.v1";
  sourceId: string;
  adapter: LiveCaptureAdapterKind;
  status: LiveCaptureStatus;
  failureClass: LiveCaptureFailureClass;
  canonicalUrlHash?: string;
  contentHash?: string;
  dedupeKey?: string;
  replayId?: string;
  publishedAt?: string;
  collectedAt: string;
  parserConfidence: number;
  extractionWarnings: string[];
  freshness: {
    state: "fresh" | "watch" | "stale" | "unknown";
    ageSeconds?: number;
    targetSeconds?: number;
  };
  runtimeCaps: {
    timeoutMs: number;
    maxBytes: number;
    mimeAllowlist: string[];
    contentType?: string;
    contentBytes?: number;
    redirectCount: number;
  };
  observability: {
    httpStatus?: number;
    retryAfterSeconds?: number;
    robotsLegalNotesPresent: boolean;
    malformedFeed: boolean;
    unsupportedMime: boolean;
    excessiveRedirects: boolean;
    unsafeUrlSuppressed: boolean;
    duplicateContent: boolean;
    staleSourceWindow: boolean;
  };
  agent06Handoff: LiveCaptureEvidenceHandoffDto;
  agent01SourcePack: {
    sourceFamily: string;
    activationReadiness: "ready" | "watch" | "hold";
    parserSupport: "ready" | "needs_repair" | "blocked";
    legalNotesPresent: boolean;
  };
  agent02Scheduler: {
    cadenceHint: "normal" | "increase" | "decrease" | "retry_after" | "pause";
    budgetClass: "low" | "normal" | "high";
    reason: string;
  };
}

export interface LiveCaptureEvidenceHandoffDto {
  schemaVersion: "ti.live_capture_evidence_handoff.v1";
  sourceId: string;
  taskId?: string;
  replayId?: string;
  rawCaptureDescriptor: {
    captureId: string;
    storageKind: "public_raw" | "metadata_only";
    canonicalUrlHash?: string;
    contentHash?: string;
    contentBytes?: number;
    retentionClass: "public_raw" | "public_report" | "evidence_delta";
  };
  textProjectionDescriptor: {
    projectionId: string;
    textHash?: string;
    language?: string;
    parserConfidence: number;
    extractionWarnings: string[];
  };
  sourceMetadata: {
    sourceType: SourceRecord["type"];
    sourceTrust: number;
    legalNotesPresent: boolean;
    connectorFamily?: string;
  };
  extractionVersion: string;
  claimCandidateIds: string[];
  forbiddenFields: string[];
}

export type LiveCaptureFixtureClass =
  | "github_security_advisory"
  | "cisa_kev"
  | "vendor_advisory_json"
  | "cert_html"
  | "vendor_blog_html"
  | "rss_atom"
  | "report_index";

export type LiveCaptureCanaryFixtureClass =
  | LiveCaptureFixtureClass
  | "pdf_text_layer_report"
  | "unsupported_mime"
  | "hostile_unsafe_link_suppression";

export type LiveCaptureCanaryRunClass =
  | "first_run"
  | "repeat_run"
  | "burst_failure"
  | "source_outage"
  | "parser_regression"
  | "source_family_shortage";

export type LiveCaptureCanaryState = "promote" | "watch" | "hold" | "rollback";

export type ParserRepairCategory =
  | "none"
  | "malformed_feed"
  | "changed_layout"
  | "report_index_drift"
  | "public_advisory_schema_change"
  | "unsupported_mime"
  | "excessive_redirects"
  | "source_outage"
  | "duplicate_heavy_output"
  | "stale_source_window"
  | "unsafe_link_suppression";

export interface LiveCaptureCanaryInput extends LiveCaptureRuntimeInput {
  canaryPhase?: "fixture_replay" | "dry_run" | "operator_approved_live";
  runClass?: LiveCaptureCanaryRunClass;
  sourceFamilyMinimums?: Record<string, number>;
  requiredCanaryFixtures?: LiveCaptureCanaryFixtureClass[];
}

export interface LiveCaptureCanaryRowDto {
  schemaVersion: "ti.live_capture_canary_row.v1";
  sourceId: string;
  adapterFamily: LiveCaptureAdapterKind;
  approvedUrlHash: string;
  robotsLegalNotesPresent: boolean;
  caps: LiveCaptureRuntimeRowDto["runtimeCaps"];
  parserVersion: string;
  extractionWarnings: string[];
  dedupeHashes: {
    canonicalUrlHash?: string;
    contentHash?: string;
    dedupeKey?: string;
  };
  evidenceReplayRefs: string[];
  noLeakPolicyResult: {
    passed: true;
    publicOnly: true;
    disabledByDefaultForUnapprovedNetworkPaths: true;
    unsafeUrlExposed: false;
    rawContentExposed: false;
    forbiddenFields: string[];
  };
  canary: {
    runClass: LiveCaptureCanaryRunClass;
    state: LiveCaptureCanaryState;
    reason: string;
  };
  parserRepair: {
    needed: boolean;
    category: ParserRepairCategory;
    recommendation: string;
    owner: "agent_03";
  };
  schedulerHint: LiveCaptureRuntimeRowDto["agent02Scheduler"];
}

export interface LiveCaptureCanaryPacketDto {
  schemaVersion: "ti.live_capture_canary_packet.v1";
  generatedAt: string;
  canaryPhase: "fixture_replay" | "dry_run" | "operator_approved_live";
  disabledByDefault: true;
  rows: LiveCaptureCanaryRowDto[];
  parserRepairQueue: LiveCaptureCanaryRowDto["parserRepair"][];
  promotion: {
    promoteSourceIds: string[];
    watchSourceIds: string[];
    holdSourceIds: string[];
    rollbackSourceIds: string[];
    schedulerHints: Array<{ sourceId: string; cadenceHint: LiveCaptureRuntimeRowDto["agent02Scheduler"]["cadenceHint"]; reason: string }>;
  };
  conformance: {
    requiredFixtureClasses: LiveCaptureCanaryFixtureClass[];
    coveredFixtureClasses: LiveCaptureCanaryFixtureClass[];
    missingFixtureClasses: LiveCaptureCanaryFixtureClass[];
  };
  sourceFamilyShortages: Array<{ sourceFamily: string; required: number; observedPromotable: number }>;
  handoffs: {
    agent01SourceGovernance: string[];
    agent02Scheduler: string[];
    agent07Quality: string[];
    agent09ApiFields: string[];
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: LiveCaptureRuntimePacketDto["safety"] & {
    willStartNetworkCollection: false;
    willMutateSources: false;
    willLeaseQueueWork: false;
  };
}

export interface LiveCaptureRuntimePacketDto {
  schemaVersion: "ti.live_capture_runtime_packet.v1";
  generatedAt: string;
  readyForEvidenceReplay: boolean;
  rows: LiveCaptureRuntimeRowDto[];
  observability: {
    total: number;
    captured: number;
    failed: number;
    duplicate: number;
    stale: number;
    failureClasses: Record<LiveCaptureFailureClass, number>;
    parserWarnings: number;
  };
  conformance: {
    requiredFixtureClasses: LiveCaptureFixtureClass[];
    coveredFixtureClasses: LiveCaptureFixtureClass[];
    missingFixtureClasses: LiveCaptureFixtureClass[];
  };
  sourcePackIntegration: {
    agent01ReadySourceIds: string[];
    agent01HeldSourceIds: string[];
    agent02CadenceHints: Array<{ sourceId: string; cadenceHint: LiveCaptureRuntimeRowDto["agent02Scheduler"]["cadenceHint"]; reason: string }>;
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: {
    publicOnly: true;
    disabledByDefaultForUnapprovedNetworkPaths: true;
    noPrivateGithubRepos: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noPayloadDownloads: true;
    noLeakedDatasets: true;
    noUnsafeOnionContent: true;
    noCredentialCollection: true;
    unsafeUrlExposed: false;
  };
}

const DEFAULT_REQUIRED_FIXTURES: LiveCaptureFixtureClass[] = [
  "github_security_advisory",
  "cisa_kev",
  "vendor_advisory_json",
  "cert_html",
  "vendor_blog_html",
  "rss_atom",
  "report_index"
];

const DEFAULT_REQUIRED_CANARY_FIXTURES: LiveCaptureCanaryFixtureClass[] = [
  ...DEFAULT_REQUIRED_FIXTURES,
  "pdf_text_layer_report",
  "unsupported_mime",
  "hostile_unsafe_link_suppression"
];

export function buildLiveCaptureRuntimePacket(input: LiveCaptureRuntimeInput): LiveCaptureRuntimePacketDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const seen = new Set(input.previousDedupeKeys ?? []);
  const rows = input.captures.map((capture) => buildLiveCaptureRuntimeRow(capture, generatedAt, seen));
  const requiredFixtureClasses = input.requiredFixtureClasses ?? DEFAULT_REQUIRED_FIXTURES;
  const coveredFixtureClasses = uniqueFixtureClasses(rows.map((row) => fixtureClassFor(row)));
  const failureClasses = countFailureClasses(rows.map((row) => row.failureClass));

  return {
    schemaVersion: "ti.live_capture_runtime_packet.v1",
    generatedAt,
    readyForEvidenceReplay: rows.some((row) => row.status === "captured") && rows.every((row) => row.status !== "failed"),
    rows,
    observability: {
      total: rows.length,
      captured: rows.filter((row) => row.status === "captured").length,
      failed: rows.filter((row) => row.status === "failed").length,
      duplicate: rows.filter((row) => row.status === "duplicate").length,
      stale: rows.filter((row) => row.status === "stale").length,
      failureClasses,
      parserWarnings: rows.reduce((sum, row) => sum + row.extractionWarnings.length, 0)
    },
    conformance: {
      requiredFixtureClasses,
      coveredFixtureClasses,
      missingFixtureClasses: requiredFixtureClasses.filter((fixture) => !coveredFixtureClasses.includes(fixture))
    },
    sourcePackIntegration: {
      agent01ReadySourceIds: uniqueStrings(rows.filter((row) => row.agent01SourcePack.activationReadiness === "ready").map((row) => row.sourceId)),
      agent01HeldSourceIds: uniqueStrings(rows.filter((row) => row.agent01SourcePack.activationReadiness === "hold").map((row) => row.sourceId)),
      agent02CadenceHints: rows.map((row) => ({
        sourceId: row.sourceId,
        cadenceHint: row.agent02Scheduler.cadenceHint,
        reason: row.agent02Scheduler.reason
      }))
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "readyForEvidenceReplay", "rows", "observability", "conformance", "sourcePackIntegration", "routeContract", "safety"],
      forbiddenFields: forbiddenFields()
    },
    safety: safetyDefaults()
  };
}

export function buildLiveCaptureRuntimeRow(
  input: LiveCaptureRuntimeCaptureInput,
  generatedAt: string,
  seenDedupeKeys = new Set<string>()
): LiveCaptureRuntimeRowDto {
  const item = input.result.items[0];
  const metadata = input.result.metadata ?? {};
  const itemMetadata = item?.metadata ?? {};
  const failureClass = classifyLiveCaptureFailure(input, item, generatedAt);
  const canonicalUrlHash = stringValue(itemMetadata.canonicalUrlHash) || (item?.url ? `urlhash:${hashContent(item.url).slice(0, 16)}` : undefined);
  const contentHash = item?.contentHash;
  const dedupeKey = item ? liveCaptureDedupeKey(input.adapter, canonicalUrlHash, contentHash, item.publishedAt) : undefined;
  const duplicate = dedupeKey ? seenDedupeKeys.has(dedupeKey) : false;
  if (dedupeKey) seenDedupeKeys.add(dedupeKey);
  const freshness = freshnessState(item, input.freshnessTargetSeconds, generatedAt);
  const status: LiveCaptureStatus = duplicate
    ? "duplicate"
    : failureClass !== "none"
      ? (failureClass === "stale_source" ? "stale" : "failed")
      : item
        ? "captured"
        : "empty";
  const parserConfidence = numberValue(itemMetadata.parserConfidence) ?? numberValue(itemMetadata.provenance, "confidence") ?? confidenceFromAdapter(input.adapter, item);
  const extractionWarnings = uniqueStrings([
    ...input.result.warnings,
    ...arrayStrings(itemMetadata.extractionWarnings),
    ...arrayStrings(itemMetadata.parserWarnings),
    ...(failureClass === "stale_source" ? ["stale_source_window"] : []),
    ...(duplicate ? ["duplicate_content"] : [])
  ]);
  const replayId = item && canonicalUrlHash && contentHash
    ? productionEvidenceReplayRef({ sourceId: input.source.id, canonicalUrlHash, contentHash, fetchedAt: item.collectedAt })
    : undefined;

  return {
    schemaVersion: "ti.live_capture_runtime_row.v1",
    sourceId: input.source.id,
    adapter: input.adapter,
    status,
    failureClass: duplicate ? "duplicate_content" : failureClass,
    canonicalUrlHash,
    contentHash,
    dedupeKey,
    replayId,
    publishedAt: item?.publishedAt,
    collectedAt: item?.collectedAt ?? generatedAt,
    parserConfidence,
    extractionWarnings,
    freshness,
    runtimeCaps: {
      timeoutMs: input.timeoutMs ?? 15_000,
      maxBytes: input.maxBytes ?? input.task?.maxBytes ?? 2_000_000,
      mimeAllowlist: input.mimeAllowlist ?? mimeAllowlistFor(input.adapter),
      contentType: input.contentType ?? stringValue(metadata.contentType) ?? stringValue(itemMetadata.contentType),
      contentBytes: numberValue(metadata.contentBytes) ?? numberValue(itemMetadata.contentBytes),
      redirectCount: input.redirectCount ?? arrayStrings(itemMetadata.redirectChain).length
    },
    observability: {
      httpStatus: numberValue(metadata.responseStatus) ?? numberValue(itemMetadata.responseStatus),
      retryAfterSeconds: numberValue(metadata.retryAfterSeconds),
      robotsLegalNotesPresent: Boolean(input.source.legalNotes.trim()),
      malformedFeed: failureClass === "malformed_feed",
      unsupportedMime: failureClass === "unsupported_mime",
      excessiveRedirects: failureClass === "excessive_redirects",
      unsafeUrlSuppressed: failureClass === "unsafe_url",
      duplicateContent: duplicate,
      staleSourceWindow: freshness.state === "stale"
    },
    agent06Handoff: evidenceHandoffFor(input, item, {
      canonicalUrlHash,
      contentHash,
      replayId,
      parserConfidence,
      extractionWarnings
    }),
    agent01SourcePack: sourcePackState(input, status, parserConfidence),
    agent02Scheduler: schedulerHint(input, status, failureClass, freshness.state)
  };
}

export function liveCaptureDedupeKey(adapter: LiveCaptureAdapterKind, canonicalUrlHash?: string, contentHash?: string, publishedAt?: string): string {
  return `live_capture:${adapter}:${canonicalUrlHash ?? "no_url"}:${contentHash ?? "no_hash"}:${publishedAt ?? "no_published_at"}`;
}

export function buildLiveCaptureCanaryPacket(input: LiveCaptureCanaryInput): LiveCaptureCanaryPacketDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const runtimePacket = buildLiveCaptureRuntimePacket({
    generatedAt,
    captures: input.captures,
    previousDedupeKeys: input.previousDedupeKeys,
    requiredFixtureClasses: input.requiredFixtureClasses
  });
  const rows = runtimePacket.rows.map((row) => buildLiveCaptureCanaryRow(row, input.runClass ?? inferCanaryRunClass(row)));
  const requiredFixtureClasses = input.requiredCanaryFixtures ?? DEFAULT_REQUIRED_CANARY_FIXTURES;
  const coveredFixtureClasses = uniqueCanaryFixtureClasses([
    ...runtimePacket.conformance.coveredFixtureClasses,
    ...rows.flatMap(canaryFixtureClassesFor)
  ]);
  const sourceFamilyShortages = sourceFamilyShortageRows(rows, input.sourceFamilyMinimums ?? {});

  return {
    schemaVersion: "ti.live_capture_canary_packet.v1",
    generatedAt,
    canaryPhase: input.canaryPhase ?? "fixture_replay",
    disabledByDefault: true,
    rows,
    parserRepairQueue: rows.filter((row) => row.parserRepair.needed).map((row) => row.parserRepair),
    promotion: {
      promoteSourceIds: uniqueStrings(rows.filter((row) => row.canary.state === "promote").map((row) => row.sourceId)),
      watchSourceIds: uniqueStrings(rows.filter((row) => row.canary.state === "watch").map((row) => row.sourceId)),
      holdSourceIds: uniqueStrings(rows.filter((row) => row.canary.state === "hold").map((row) => row.sourceId)),
      rollbackSourceIds: uniqueStrings(rows.filter((row) => row.canary.state === "rollback").map((row) => row.sourceId)),
      schedulerHints: rows.map((row) => ({
        sourceId: row.sourceId,
        cadenceHint: row.schedulerHint.cadenceHint,
        reason: row.schedulerHint.reason
      }))
    },
    conformance: {
      requiredFixtureClasses,
      coveredFixtureClasses,
      missingFixtureClasses: requiredFixtureClasses.filter((fixture) => !coveredFixtureClasses.includes(fixture))
    },
    sourceFamilyShortages,
    handoffs: {
      agent01SourceGovernance: ["promoteSourceIds", "holdSourceIds", "rollbackSourceIds", "sourceFamilyShortages"],
      agent02Scheduler: ["promotion.schedulerHints", "rows.schedulerHint", "rows.canary.runClass"],
      agent07Quality: ["rows.parserRepair", "rows.extractionWarnings", "rows.canary.state"],
      agent09ApiFields: ["schemaVersion", "canaryPhase", "disabledByDefault", "promotion", "conformance", "sourceFamilyShortages"]
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "canaryPhase", "disabledByDefault", "rows", "parserRepairQueue", "promotion", "conformance", "sourceFamilyShortages", "handoffs", "routeContract", "safety"],
      forbiddenFields: forbiddenFields()
    },
    safety: {
      ...safetyDefaults(),
      willStartNetworkCollection: false,
      willMutateSources: false,
      willLeaseQueueWork: false
    }
  };
}

function classifyLiveCaptureFailure(input: LiveCaptureRuntimeCaptureInput, item: CollectedItem | undefined, generatedAt: string): LiveCaptureFailureClass {
  const metadata = input.result.metadata ?? {};
  const failure = String(metadata.failureCategory ?? "");
  const warnings = input.result.warnings.join(" ").toLowerCase();
  if (failure === "not_modified") return "not_modified";
  if (failure === "rate_limited") return "rate_limited";
  if (failure === "unsupported_mime" || failure === "unsupported_media") return "unsupported_mime";
  if (failure === "too_large" || failure === "content_too_large") return "content_too_large";
  if (failure === "robots_blocked" || failure === "policy_blocked" || failure === "policy_hold") return "robots_or_legal_hold";
  if (failure === "http_error" || (numberValue(metadata.responseStatus, undefined, 0) ?? 0) >= 400) return "http_error";
  if (warnings.includes("malformed") || warnings.includes("xml parse") || warnings.includes("json parse")) return input.adapter === "rss_feed" ? "malformed_feed" : "parse_error";
  if (Array.isArray(metadata.suppressedRecords) && metadata.suppressedRecords.length > 0) return "unsafe_url";
  if ((input.redirectCount ?? 0) > 5) return "excessive_redirects";
  if (!item && input.result.items.length === 0) return "empty_capture";
  if (!item) return "empty_capture";
  const freshness = freshnessState(item, input.freshnessTargetSeconds, generatedAt);
  if (freshness.state === "stale") return "stale_source";
  return "none";
}

function evidenceHandoffFor(
  input: LiveCaptureRuntimeCaptureInput,
  item: CollectedItem | undefined,
  values: {
    canonicalUrlHash?: string;
    contentHash?: string;
    replayId?: string;
    parserConfidence: number;
    extractionWarnings: string[];
  }
): LiveCaptureEvidenceHandoffDto {
  const captureId = `capture_${hashContent(`${input.source.id}:${values.canonicalUrlHash ?? "none"}:${values.contentHash ?? "none"}`).slice(0, 16)}`;
  const projectionId = `text_projection_${hashContent(`${captureId}:${values.contentHash ?? "none"}`).slice(0, 16)}`;
  return {
    schemaVersion: "ti.live_capture_evidence_handoff.v1",
    sourceId: input.source.id,
    taskId: input.task?.id ?? item?.taskId,
    replayId: values.replayId,
    rawCaptureDescriptor: {
      captureId,
      storageKind: item ? "public_raw" : "metadata_only",
      canonicalUrlHash: values.canonicalUrlHash,
      contentHash: values.contentHash,
      contentBytes: byteLength(item?.rawText ?? ""),
      retentionClass: input.adapter === "report_index" ? "public_report" : "public_raw"
    },
    textProjectionDescriptor: {
      projectionId,
      textHash: item?.rawText ? `texthash:${hashContent(item.rawText).slice(0, 16)}` : undefined,
      language: item?.language ?? input.source.language,
      parserConfidence: values.parserConfidence,
      extractionWarnings: values.extractionWarnings
    },
    sourceMetadata: {
      sourceType: input.source.type,
      sourceTrust: input.source.trustScore,
      legalNotesPresent: Boolean(input.source.legalNotes.trim()),
      connectorFamily: stringValue(item?.metadata.connectorFamily) || stringValue(input.source.metadata?.sourceFamily)
    },
    extractionVersion: extractionVersionFor(input.adapter),
    claimCandidateIds: claimCandidateIdsFor(input.source.id, item),
    forbiddenFields: forbiddenFields()
  };
}

function sourcePackState(
  input: LiveCaptureRuntimeCaptureInput,
  status: LiveCaptureStatus,
  parserConfidence: number
): LiveCaptureRuntimeRowDto["agent01SourcePack"] {
  const legalNotesPresent = Boolean(input.source.legalNotes.trim());
  const parserSupport = status === "failed" ? "blocked" : parserConfidence >= 0.65 ? "ready" : "needs_repair";
  return {
    sourceFamily: sourceFamilyFor(input),
    activationReadiness: !legalNotesPresent || parserSupport === "blocked" ? "hold" : parserSupport === "needs_repair" || status === "stale" ? "watch" : "ready",
    parserSupport,
    legalNotesPresent
  };
}

function schedulerHint(
  input: LiveCaptureRuntimeCaptureInput,
  status: LiveCaptureStatus,
  failureClass: LiveCaptureFailureClass,
  freshnessStateValue: LiveCaptureRuntimeRowDto["freshness"]["state"]
): LiveCaptureRuntimeRowDto["agent02Scheduler"] {
  if (failureClass === "rate_limited") return { cadenceHint: "retry_after", budgetClass: "normal", reason: "source rate limited; honor retry-after/backoff before next capture" };
  if (failureClass === "robots_or_legal_hold" || failureClass === "unsafe_url") return { cadenceHint: "pause", budgetClass: "low", reason: "source has policy/legal or unsafe URL hold" };
  if (status === "duplicate") return { cadenceHint: "decrease", budgetClass: "low", reason: "duplicate content observed; reduce cadence until novelty improves" };
  if (freshnessStateValue === "stale") return { cadenceHint: "increase", budgetClass: input.queryClass === "cve_advisory" ? "high" : "normal", reason: "source stale for target freshness window" };
  return { cadenceHint: "normal", budgetClass: input.queryClass === "cve_advisory" ? "high" : "normal", reason: "capture runtime healthy" };
}

function freshnessState(item: CollectedItem | undefined, targetSeconds = 7 * 24 * 60 * 60, generatedAt = nowIso()): LiveCaptureRuntimeRowDto["freshness"] {
  if (!item?.publishedAt) return { state: item ? "unknown" : "unknown", targetSeconds };
  const publishedMs = Date.parse(item.publishedAt);
  const generatedMs = Date.parse(generatedAt);
  if (!Number.isFinite(publishedMs) || !Number.isFinite(generatedMs)) return { state: "unknown", targetSeconds };
  const ageSeconds = Math.max(0, Math.floor((generatedMs - publishedMs) / 1000));
  return {
    state: ageSeconds <= targetSeconds ? "fresh" : ageSeconds <= targetSeconds * 2 ? "watch" : "stale",
    ageSeconds,
    targetSeconds
  };
}

function fixtureClassFor(row: LiveCaptureRuntimeRowDto): LiveCaptureFixtureClass {
  const family = row.agent06Handoff.sourceMetadata.connectorFamily as PublicAdvisorySourceFamily | undefined;
  if (row.adapter === "rss_feed") return "rss_atom";
  if (row.adapter === "report_index") return "report_index";
  if (row.adapter === "static_html" && row.sourceId.toLowerCase().includes("cert")) return "cert_html";
  if (row.adapter === "static_html") return "vendor_blog_html";
  if (family === "github_advisory") return "github_security_advisory";
  if (family === "cert_government") return "cisa_kev";
  return "vendor_advisory_json";
}

function sourceFamilyFor(input: LiveCaptureRuntimeCaptureInput): string {
  const itemFamily = stringValue(input.result.items[0]?.metadata.connectorFamily);
  if (itemFamily) return itemFamily;
  if (input.adapter === "rss_feed") return "rss_feed";
  if (input.adapter === "static_html") return input.source.tags?.some((tag) => /cert|government/i.test(tag)) ? "cert_html" : "vendor_blog_html";
  if (input.adapter === "report_index") return "public_report_index";
  return stringValue(input.source.metadata?.sourceFamily) || "public_advisory";
}

function extractionVersionFor(adapter: LiveCaptureAdapterKind): string {
  switch (adapter) {
    case "rss_feed":
      return "rss-adapter-v2";
    case "static_html":
      return "static-web-adapter-v2";
    case "report_index":
      return "report-index-live-capture-v1";
    case "public_advisory":
      return "public-advisory-adapter-v1";
    case "pdf_report":
      return "pdf-report-adapter-v1";
  }
}

function mimeAllowlistFor(adapter: LiveCaptureAdapterKind): string[] {
  switch (adapter) {
    case "rss_feed":
      return ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"];
    case "static_html":
    case "report_index":
      return ["text/html", "application/xhtml+xml", "text/plain"];
    case "public_advisory":
      return ["application/json", "application/rss+xml", "application/atom+xml", "application/xml", "text/xml"];
    case "pdf_report":
      return ["application/pdf"];
  }
}

function confidenceFromAdapter(adapter: LiveCaptureAdapterKind, item?: CollectedItem): number {
  if (!item) return 0;
  if (adapter === "public_advisory") return 0.78;
  if (adapter === "pdf_report") return 0.74;
  if (adapter === "rss_feed") return 0.72;
  return item.rawText.length > 200 ? 0.74 : 0.48;
}

function buildLiveCaptureCanaryRow(row: LiveCaptureRuntimeRowDto, runClass: LiveCaptureCanaryRunClass): LiveCaptureCanaryRowDto {
  const parserRepair = parserRepairFor(row);
  const state = canaryStateFor(row, parserRepair, runClass);
  return {
    schemaVersion: "ti.live_capture_canary_row.v1",
    sourceId: row.sourceId,
    adapterFamily: row.adapter,
    approvedUrlHash: row.canonicalUrlHash ?? `sourcehash:${hashContent(row.sourceId).slice(0, 16)}`,
    robotsLegalNotesPresent: row.observability.robotsLegalNotesPresent,
    caps: row.runtimeCaps,
    parserVersion: extractionVersionFor(row.adapter),
    extractionWarnings: row.extractionWarnings,
    dedupeHashes: {
      canonicalUrlHash: row.canonicalUrlHash,
      contentHash: row.contentHash,
      dedupeKey: row.dedupeKey
    },
    evidenceReplayRefs: row.replayId ? [row.replayId] : [],
    noLeakPolicyResult: {
      passed: true,
      publicOnly: true,
      disabledByDefaultForUnapprovedNetworkPaths: true,
      unsafeUrlExposed: false,
      rawContentExposed: false,
      forbiddenFields: forbiddenFields()
    },
    canary: {
      runClass,
      state,
      reason: canaryReasonFor(row, state, parserRepair, runClass)
    },
    parserRepair,
    schedulerHint: schedulerHintForCanary(row, state, runClass)
  };
}

function parserRepairFor(row: LiveCaptureRuntimeRowDto): LiveCaptureCanaryRowDto["parserRepair"] {
  const category = parserRepairCategoryFor(row);
  return {
    needed: category !== "none",
    category,
    recommendation: parserRepairRecommendation(category, row),
    owner: "agent_03"
  };
}

function parserRepairCategoryFor(row: LiveCaptureRuntimeRowDto): ParserRepairCategory {
  if (row.failureClass === "malformed_feed") return "malformed_feed";
  if (row.failureClass === "unsupported_mime") return "unsupported_mime";
  if (row.failureClass === "excessive_redirects") return "excessive_redirects";
  if (row.failureClass === "http_error" || row.failureClass === "rate_limited") return "source_outage";
  if (row.failureClass === "unsafe_url") return "unsafe_link_suppression";
  if (row.failureClass === "duplicate_content" || row.status === "duplicate") return "duplicate_heavy_output";
  if (row.failureClass === "stale_source" || row.freshness.state === "stale") return "stale_source_window";
  if (row.adapter === "report_index" && row.status === "empty") return "report_index_drift";
  if (row.adapter === "public_advisory" && (row.status === "empty" || row.extractionWarnings.some((warning) => /schema|field|json/i.test(warning)))) return "public_advisory_schema_change";
  if (row.adapter === "static_html" && (row.status === "empty" || row.parserConfidence < 0.65)) return "changed_layout";
  return "none";
}

function parserRepairRecommendation(category: ParserRepairCategory, row: LiveCaptureRuntimeRowDto): string {
  switch (category) {
    case "none":
      return "parser healthy; no repair action";
    case "malformed_feed":
      return "add malformed RSS/Atom fixture and harden feed parser recovery";
    case "changed_layout":
      return "refresh static HTML selectors/readability fixture for changed layout";
    case "report_index_drift":
      return "repair report-index link discovery and pagination fixture";
    case "public_advisory_schema_change":
      return "update advisory schema mapper and preserve suppressed-record audit";
    case "unsupported_mime":
      return `add MIME guard or parser support for ${row.runtimeCaps.contentType ?? "unknown content type"}`;
    case "excessive_redirects":
      return "review canonicalization and redirect cap before retrying source";
    case "source_outage":
      return "treat as source outage; keep backoff and avoid parser promotion";
    case "duplicate_heavy_output":
      return "lower cadence and tune duplicate suppression before promotion";
    case "stale_source_window":
      return "raise freshness review or adjust cadence/source coverage for stale window";
    case "unsafe_link_suppression":
      return "keep unsafe-link suppression and add hostile-link fixture coverage";
  }
}

function inferCanaryRunClass(row: LiveCaptureRuntimeRowDto): LiveCaptureCanaryRunClass {
  if (row.failureClass === "http_error" || row.failureClass === "rate_limited") return "source_outage";
  if (row.failureClass === "duplicate_content") return "repeat_run";
  if (row.parserConfidence < 0.65 || row.status === "failed") return "parser_regression";
  return "first_run";
}

function canaryStateFor(row: LiveCaptureRuntimeRowDto, repair: LiveCaptureCanaryRowDto["parserRepair"], runClass: LiveCaptureCanaryRunClass): LiveCaptureCanaryState {
  if (row.failureClass === "robots_or_legal_hold" || row.failureClass === "unsafe_url" || row.failureClass === "unsupported_mime") return "hold";
  if (runClass === "burst_failure" || runClass === "parser_regression") return row.status === "captured" && !repair.needed ? "watch" : "rollback";
  if (row.status === "failed") return row.failureClass === "http_error" || row.failureClass === "rate_limited" ? "watch" : "hold";
  if (row.status === "duplicate" || repair.category === "duplicate_heavy_output") return "watch";
  if (row.status === "stale" || repair.category === "stale_source_window") return "watch";
  if (repair.needed) return "hold";
  return row.parserConfidence >= 0.7 && Boolean(row.replayId) ? "promote" : "watch";
}

function canaryReasonFor(row: LiveCaptureRuntimeRowDto, state: LiveCaptureCanaryState, repair: LiveCaptureCanaryRowDto["parserRepair"], runClass: LiveCaptureCanaryRunClass): string {
  if (state === "promote") return "canary capture is replayable, parser confidence is acceptable, and no repair is needed";
  if (state === "rollback") return `${runClass} detected with non-promotable capture result`;
  if (repair.needed) return repair.recommendation;
  if (row.status === "duplicate") return "repeat capture produced duplicate content; watch cadence before promotion";
  return "canary should remain under observation before promotion";
}

function schedulerHintForCanary(
  row: LiveCaptureRuntimeRowDto,
  state: LiveCaptureCanaryState,
  runClass: LiveCaptureCanaryRunClass
): LiveCaptureRuntimeRowDto["agent02Scheduler"] {
  if (state === "rollback" || state === "hold") return { cadenceHint: "pause", budgetClass: "low", reason: "canary held or rollback requested" };
  if (runClass === "source_outage") return { cadenceHint: "retry_after", budgetClass: "normal", reason: "source outage canary should back off before retry" };
  if (row.status === "duplicate") return { cadenceHint: "decrease", budgetClass: "low", reason: "duplicate-heavy canary output" };
  if (row.status === "stale") return { cadenceHint: "increase", budgetClass: "normal", reason: "stale source window observed during canary" };
  return row.agent02Scheduler;
}

function canaryFixtureClassesFor(row: LiveCaptureCanaryRowDto): LiveCaptureCanaryFixtureClass[] {
  const classes: LiveCaptureCanaryFixtureClass[] = [];
  if (row.adapterFamily === "pdf_report") classes.push("pdf_text_layer_report");
  if (row.parserRepair.category === "unsupported_mime") classes.push("unsupported_mime");
  if (row.parserRepair.category === "unsafe_link_suppression") classes.push("hostile_unsafe_link_suppression");
  return classes;
}

function sourceFamilyShortageRows(rows: LiveCaptureCanaryRowDto[], minimums: Record<string, number>): LiveCaptureCanaryPacketDto["sourceFamilyShortages"] {
  return Object.entries(minimums).flatMap(([sourceFamily, required]) => {
    const observedPromotable = rows.filter((row) => row.adapterFamily === sourceFamily && row.canary.state === "promote").length;
    return observedPromotable < required ? [{ sourceFamily, required, observedPromotable }] : [];
  });
}

function uniqueCanaryFixtureClasses(values: LiveCaptureCanaryFixtureClass[]): LiveCaptureCanaryFixtureClass[] {
  return DEFAULT_REQUIRED_CANARY_FIXTURES.filter((fixture) => values.includes(fixture));
}

function claimCandidateIdsFor(sourceId: string, item?: CollectedItem): string[] {
  if (!item) return [];
  const entities = [
    ...extractMatches(item.rawText, /\bCVE-\d{4}-\d{4,}\b/gi),
    ...extractMatches(item.rawText, /\bAPT\d{2}\b/gi),
    ...extractMatches(item.rawText, /\b(?:Akira|LockBit|Lazarus|Turla|Sandworm|Volt Typhoon)\b/gi)
  ];
  return uniqueStrings(entities).slice(0, 8).map((entity) => `claim_candidate_${hashContent(`${sourceId}:${entity}:${item.contentHash}`).slice(0, 16)}`);
}

function countFailureClasses(values: LiveCaptureFailureClass[]): Record<LiveCaptureFailureClass, number> {
  const result = Object.fromEntries([
    "none",
    "http_error",
    "parse_error",
    "malformed_feed",
    "unsupported_mime",
    "excessive_redirects",
    "unsafe_url",
    "duplicate_content",
    "stale_source",
    "empty_capture",
    "robots_or_legal_hold",
    "content_too_large",
    "rate_limited",
    "not_modified"
  ].map((key) => [key, 0])) as Record<LiveCaptureFailureClass, number>;
  for (const value of values) result[value] += 1;
  return result;
}

function uniqueFixtureClasses(values: LiveCaptureFixtureClass[]): LiveCaptureFixtureClass[] {
  return DEFAULT_REQUIRED_FIXTURES.filter((fixture) => values.includes(fixture));
}

function forbiddenFields(): string[] {
  return ["url", "canonicalUrl", "requestedUrl", "finalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "downloadUrl", "objectRef", "objectKey"];
}

function safetyDefaults(): LiveCaptureRuntimePacketDto["safety"] {
  return {
    publicOnly: true,
    disabledByDefaultForUnapprovedNetworkPaths: true,
    noPrivateGithubRepos: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noPayloadDownloads: true,
    noLeakedDatasets: true,
    noUnsafeOnionContent: true,
    noCredentialCollection: true,
    unsafeUrlExposed: false
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function extractMatches(value: string, pattern: RegExp): string[] {
  return uniqueStrings([...value.matchAll(pattern)].map((match) => match[0]));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown, key?: string, fallback?: number): number | undefined {
  const candidate = key && typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : value;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : fallback;
}

function arrayStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}
