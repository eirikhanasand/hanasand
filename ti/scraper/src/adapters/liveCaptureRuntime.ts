import type { CollectedItem } from "../types.ts";
import { hashContent, nowIso, uniqueStrings } from "../utils.ts";
import { productionEvidenceReplayRef } from "./productionAdapterRuntime.ts";
export type { LiveCaptureAdapterKind, LiveCaptureCanaryFixtureClass, LiveCaptureCanaryInput, LiveCaptureCanaryPacketDto, LiveCaptureCanaryRowDto, LiveCaptureCanaryRunClass, LiveCaptureCanaryState, LiveCaptureEvidenceHandoffDto, LiveCaptureFailureClass, LiveCaptureFixtureClass, LiveCaptureRuntimeCaptureInput, LiveCaptureRuntimeInput, LiveCaptureRuntimePacketDto, LiveCaptureRuntimeRowDto, LiveCaptureStatus, ParserRepairCategory } from "./liveCaptureTypes.ts";
import type { LiveCaptureAdapterKind, LiveCaptureCanaryFixtureClass, LiveCaptureCanaryInput, LiveCaptureCanaryPacketDto, LiveCaptureCanaryRowDto, LiveCaptureCanaryRunClass, LiveCaptureFailureClass, LiveCaptureFixtureClass, LiveCaptureRuntimeCaptureInput, LiveCaptureRuntimeInput, LiveCaptureRuntimePacketDto, LiveCaptureRuntimeRowDto, LiveCaptureStatus, ParserRepairCategory } from "./liveCaptureTypes.ts";

const FIXTURES: LiveCaptureFixtureClass[] = ["github_security_advisory", "cisa_kev", "vendor_advisory_json", "cert_html", "vendor_blog_html", "rss_atom", "report_index"];
const CANARY_FIXTURES: LiveCaptureCanaryFixtureClass[] = [...FIXTURES, "pdf_text_layer_report", "unsupported_mime", "hostile_unsafe_link_suppression"];
const FAILURES: LiveCaptureFailureClass[] = ["none", "http_error", "parse_error", "malformed_feed", "unsupported_mime", "excessive_redirects", "unsafe_url", "duplicate_content", "stale_source", "empty_capture", "robots_or_legal_hold", "content_too_large", "rate_limited", "not_modified"];

export function buildLiveCaptureRuntimePacket(input: LiveCaptureRuntimeInput): LiveCaptureRuntimePacketDto {
  const generatedAt = input.generatedAt ?? nowIso(), seen = new Set(input.previousDedupeKeys ?? []);
  const rows = input.captures.map((capture) => buildLiveCaptureRuntimeRow(capture, generatedAt, seen));
  const required = input.requiredFixtureClasses ?? FIXTURES, covered = order(required, rows.map(fixtureClassFor));
  return { schemaVersion: "ti.live_capture_runtime_packet.v1", generatedAt, readyForEvidenceReplay: rows.some((r) => r.status === "captured") && rows.every((r) => r.status !== "failed"), rows, observability: { total: rows.length, captured: count(rows, "captured"), failed: count(rows, "failed"), duplicate: count(rows, "duplicate"), stale: count(rows, "stale"), failureClasses: failureCounts(rows), parserWarnings: rows.reduce((n, r) => n + r.extractionWarnings.length, 0) }, conformance: { requiredFixtureClasses: required, coveredFixtureClasses: covered, missingFixtureClasses: required.filter((f) => !covered.includes(f)) }, sourcePackIntegration: { agent01ReadySourceIds: uniqueStrings(rows.filter((r) => r.agent01SourcePack.activationReadiness === "ready").map((r) => r.sourceId)), agent01HeldSourceIds: uniqueStrings(rows.filter((r) => r.agent01SourcePack.activationReadiness === "hold").map((r) => r.sourceId)), agent02CadenceHints: rows.map((r) => ({ sourceId: r.sourceId, cadenceHint: r.agent02Scheduler.cadenceHint, reason: r.agent02Scheduler.reason })) }, routeContract: routeContract(["schemaVersion", "generatedAt", "readyForEvidenceReplay", "rows", "observability", "conformance", "sourcePackIntegration", "routeContract", "safety"]), safety: safetyDefaults() };
}

export function buildLiveCaptureRuntimeRow(input: LiveCaptureRuntimeCaptureInput, generatedAt: string, seen = new Set<string>()): LiveCaptureRuntimeRowDto {
  const item = input.result.items[0], meta = input.result.metadata ?? {}, itemMeta = item?.metadata ?? {};
  const failure = classifyLiveCaptureFailure(input, item, generatedAt), urlHash = str(itemMeta.canonicalUrlHash) || (item?.url ? `urlhash:${hashContent(item.url).slice(0, 16)}` : undefined);
  const dedupeKey = item ? liveCaptureDedupeKey(input.adapter, urlHash, item.contentHash, item.publishedAt) : undefined, duplicate = Boolean(dedupeKey && seen.has(dedupeKey));
  if (dedupeKey) seen.add(dedupeKey);
  const freshness = freshnessState(item, input.freshnessTargetSeconds, generatedAt), status = duplicate ? "duplicate" : failure !== "none" ? (failure === "stale_source" ? "stale" : "failed") : item ? "captured" : "empty";
  const parserConfidence = num(itemMeta.parserConfidence) ?? num(itemMeta.provenance, "confidence") ?? confidence(input.adapter, item);
  const extractionWarnings = uniqueStrings([...input.result.warnings, ...strings(itemMeta.extractionWarnings), ...strings(itemMeta.parserWarnings), ...(failure === "stale_source" ? ["stale_source_window"] : []), ...(duplicate ? ["duplicate_content"] : [])]);
  const replayId = item && urlHash && item.contentHash ? productionEvidenceReplayRef({ sourceId: input.source.id, canonicalUrlHash: urlHash, contentHash: item.contentHash, fetchedAt: item.collectedAt }) : undefined;
  return { schemaVersion: "ti.live_capture_runtime_row.v1", sourceId: input.source.id, adapter: input.adapter, status, failureClass: duplicate ? "duplicate_content" : failure, canonicalUrlHash: urlHash, contentHash: item?.contentHash, dedupeKey, replayId, publishedAt: item?.publishedAt, collectedAt: item?.collectedAt ?? generatedAt, parserConfidence, extractionWarnings, freshness, runtimeCaps: { timeoutMs: input.timeoutMs ?? 15_000, maxBytes: input.maxBytes ?? input.task?.maxBytes ?? 2_000_000, mimeAllowlist: input.mimeAllowlist ?? mimeAllowlistFor(input.adapter), contentType: input.contentType ?? str(meta.contentType) ?? str(itemMeta.contentType), contentBytes: num(meta.contentBytes) ?? num(itemMeta.contentBytes), redirectCount: input.redirectCount ?? strings(itemMeta.redirectChain).length }, observability: { httpStatus: num(meta.responseStatus) ?? num(itemMeta.responseStatus), retryAfterSeconds: num(meta.retryAfterSeconds), robotsLegalNotesPresent: Boolean(input.source.legalNotes.trim()), malformedFeed: failure === "malformed_feed", unsupportedMime: failure === "unsupported_mime", excessiveRedirects: failure === "excessive_redirects", unsafeUrlSuppressed: failure === "unsafe_url", duplicateContent: duplicate, staleSourceWindow: freshness.state === "stale" }, agent06Handoff: handoff(input, item, urlHash, replayId, parserConfidence, extractionWarnings), agent01SourcePack: sourcePack(input, status, parserConfidence), agent02Scheduler: schedulerHint(input, status, failure, freshness.state) };
}

export const liveCaptureDedupeKey = (adapter: LiveCaptureAdapterKind, canonicalUrlHash?: string, contentHash?: string, publishedAt?: string) => `live_capture:${adapter}:${canonicalUrlHash ?? "no_url"}:${contentHash ?? "no_hash"}:${publishedAt ?? "no_published_at"}`;

export function buildLiveCaptureCanaryPacket(input: LiveCaptureCanaryInput): LiveCaptureCanaryPacketDto {
  const generatedAt = input.generatedAt ?? nowIso(), runtime = buildLiveCaptureRuntimePacket({ generatedAt, captures: input.captures, previousDedupeKeys: input.previousDedupeKeys, requiredFixtureClasses: input.requiredFixtureClasses });
  const rows = runtime.rows.map((row: any) => canaryRow(row, input.runClass ?? inferRun(row))), required = input.requiredCanaryFixtures ?? CANARY_FIXTURES;
  const covered = order(required, [...runtime.conformance.coveredFixtureClasses, ...rows.flatMap(canaryFixtureClassesFor)]);
  return { schemaVersion: "ti.live_capture_canary_packet.v1", generatedAt, canaryPhase: input.canaryPhase ?? "fixture_replay", disabledByDefault: true, rows, parserRepairQueue: rows.filter((r) => r.parserRepair.needed).map((r) => r.parserRepair), promotion: { promoteSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "promote").map((r) => r.sourceId)), watchSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "watch").map((r) => r.sourceId)), holdSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "hold").map((r) => r.sourceId)), rollbackSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "rollback").map((r) => r.sourceId)), schedulerHints: rows.map((r) => ({ sourceId: r.sourceId, cadenceHint: r.schedulerHint.cadenceHint, reason: r.schedulerHint.reason })) }, conformance: { requiredFixtureClasses: required, coveredFixtureClasses: covered, missingFixtureClasses: required.filter((f) => !covered.includes(f)) }, sourceFamilyShortages: shortageRows(rows, input.sourceFamilyMinimums ?? {}), handoffs: { agent01SourceGovernance: [], agent02Scheduler: [], agent07Quality: [], agent09ApiFields: [] }, routeContract: routeContract(["schemaVersion", "generatedAt", "canaryPhase", "rows", "promotion", "conformance", "sourceFamilyShortages"]), safety: { ...safetyDefaults(), willStartNetworkCollection: false, willMutateSources: false, willLeaseQueueWork: false } };
}

function classifyLiveCaptureFailure(input: LiveCaptureRuntimeCaptureInput, item: CollectedItem | undefined, generatedAt: string): LiveCaptureFailureClass {
  const meta = input.result.metadata ?? {}, failure = String(meta.failureCategory ?? ""), warnings = input.result.warnings.join(" ").toLowerCase();
  if (["not_modified", "rate_limited"].includes(failure)) return failure as LiveCaptureFailureClass;
  if (["unsupported_mime", "unsupported_media"].includes(failure)) return "unsupported_mime";
  if (["too_large", "content_too_large"].includes(failure)) return "content_too_large";
  if (["robots_blocked", "policy_blocked", "policy_hold"].includes(failure)) return "robots_or_legal_hold";
  if (failure === "http_error" || (num(meta.responseStatus) ?? 0) >= 400) return "http_error";
  if (warnings.match(/malformed|xml parse|json parse/)) return input.adapter === "rss_feed" ? "malformed_feed" : "parse_error";
  if (Array.isArray(meta.suppressedRecords) && meta.suppressedRecords.length) return "unsafe_url";
  if ((input.redirectCount ?? 0) > 5) return "excessive_redirects";
  if (!item) return "empty_capture";
  return freshnessState(item, input.freshnessTargetSeconds, generatedAt).state === "stale" ? "stale_source" : "none";
}

function handoff(input: LiveCaptureRuntimeCaptureInput, item: CollectedItem | undefined, urlHash: string | undefined, replayId: string | undefined, parserConfidence: number, extractionWarnings: string[]) {
  const captureId = `capture_${hashContent(`${input.source.id}:${urlHash ?? "none"}:${item?.contentHash ?? "none"}`).slice(0, 16)}`;
  return { schemaVersion: "ti.live_capture_evidence_handoff.v1", sourceId: input.source.id, taskId: input.task?.id ?? item?.taskId, replayId, rawCaptureDescriptor: { captureId, storageKind: item ? "public_raw" : "metadata_only", canonicalUrlHash: urlHash, contentHash: item?.contentHash, contentBytes: new TextEncoder().encode(item?.rawText ?? "").byteLength, retentionClass: input.adapter === "report_index" ? "public_report" : "public_raw" }, textProjectionDescriptor: { projectionId: `text_projection_${hashContent(`${captureId}:${item?.contentHash ?? "none"}`).slice(0, 16)}`, textHash: item?.rawText ? `texthash:${hashContent(item.rawText).slice(0, 16)}` : undefined, language: item?.language ?? input.source.language, parserConfidence, extractionWarnings }, sourceMetadata: { sourceType: input.source.type, sourceTrust: input.source.trustScore, legalNotesPresent: Boolean(input.source.legalNotes.trim()), connectorFamily: str(item?.metadata.connectorFamily) || str(input.source.metadata?.sourceFamily) }, extractionVersion: versionFor(input.adapter), claimCandidateIds: claimIds(input.source.id, item), forbiddenFields: forbiddenFields() };
}

function sourcePack(input: LiveCaptureRuntimeCaptureInput, status: LiveCaptureStatus, parserConfidence: number) {
  const legal = Boolean(input.source.legalNotes.trim()), parserSupport = status === "failed" ? "blocked" : parserConfidence >= 0.65 ? "ready" : "needs_repair";
  return { sourceFamily: sourceFamily(input), activationReadiness: !legal || parserSupport === "blocked" ? "hold" : parserSupport === "needs_repair" || status === "stale" ? "watch" : "ready", parserSupport, legalNotesPresent: legal };
}

function schedulerHint(input: LiveCaptureRuntimeCaptureInput, status: LiveCaptureStatus, failure: LiveCaptureFailureClass, fresh: string) {
  if (failure === "rate_limited") return { cadenceHint: "retry_after", budgetClass: "normal", reason: "source rate limited; honor retry-after/backoff before next capture" };
  if (failure === "robots_or_legal_hold" || failure === "unsafe_url") return { cadenceHint: "pause", budgetClass: "low", reason: "source has policy/legal or unsafe URL hold" };
  if (status === "duplicate") return { cadenceHint: "decrease", budgetClass: "low", reason: "duplicate content observed; reduce cadence until novelty improves" };
  return { cadenceHint: fresh === "stale" ? "increase" : "normal", budgetClass: input.queryClass === "cve_advisory" ? "high" : "normal", reason: fresh === "stale" ? "source stale for target freshness window" : "capture runtime healthy" };
}

function freshnessState(item?: CollectedItem, targetSeconds = 604800, generatedAt = nowIso()) {
  if (!item?.publishedAt) return { state: "unknown", targetSeconds };
  const ageSeconds = Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(item.publishedAt)) / 1000));
  return { state: !Number.isFinite(ageSeconds) ? "unknown" : ageSeconds <= targetSeconds ? "fresh" : ageSeconds <= targetSeconds * 2 ? "watch" : "stale", ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : undefined, targetSeconds };
}

function canaryRow(row: LiveCaptureRuntimeRowDto, runClass: LiveCaptureCanaryRunClass): LiveCaptureCanaryRowDto {
  const parserRepair = parserRepairFor(row), state = canaryState(row, parserRepair, runClass);
  return { schemaVersion: "ti.live_capture_canary_row.v1", sourceId: row.sourceId, adapterFamily: row.adapter, approvedUrlHash: row.canonicalUrlHash ?? `sourcehash:${hashContent(row.sourceId).slice(0, 16)}`, robotsLegalNotesPresent: row.observability.robotsLegalNotesPresent, caps: row.runtimeCaps, parserVersion: versionFor(row.adapter), extractionWarnings: row.extractionWarnings, dedupeHashes: { canonicalUrlHash: row.canonicalUrlHash, contentHash: row.contentHash, dedupeKey: row.dedupeKey }, evidenceReplayRefs: row.replayId ? [row.replayId] : [], noLeakPolicyResult: { passed: true, publicOnly: true, disabledByDefaultForUnapprovedNetworkPaths: true, unsafeUrlExposed: false, rawContentExposed: false, forbiddenFields: forbiddenFields() }, canary: { runClass, state, reason: state === "promote" ? "canary capture is replayable, parser confidence is acceptable, and no repair is needed" : parserRepair.needed ? parserRepair.recommendation : "canary should remain under observation before promotion" }, parserRepair, schedulerHint: state === "hold" || state === "rollback" ? { cadenceHint: "pause", budgetClass: "low", reason: "canary held or rollback requested" } : row.agent02Scheduler };
}

function parserRepairFor(row: LiveCaptureRuntimeRowDto) {
  const category = repairCategory(row);
  return { needed: category !== "none", category, recommendation: repairRecommendation(category, row), owner: "agent_03" };
}

function repairCategory(row: LiveCaptureRuntimeRowDto): ParserRepairCategory {
  if (row.failureClass === "malformed_feed") return "malformed_feed"; if (row.failureClass === "unsupported_mime") return "unsupported_mime"; if (row.failureClass === "excessive_redirects") return "excessive_redirects"; if (["http_error", "rate_limited"].includes(row.failureClass)) return "source_outage"; if (row.failureClass === "unsafe_url") return "unsafe_link_suppression"; if (row.status === "duplicate") return "duplicate_heavy_output"; if (row.status === "stale" || row.freshness.state === "stale") return "stale_source_window"; if (row.adapter === "report_index" && row.status === "empty") return "report_index_drift"; if (row.adapter === "public_advisory" && (row.status === "empty" || row.extractionWarnings.some((w: string) => /schema|field|json/i.test(w)))) return "public_advisory_schema_change"; if (row.adapter === "static_html" && (row.status === "empty" || row.parserConfidence < 0.65)) return "changed_layout"; return "none";
}

function canaryState(row: LiveCaptureRuntimeRowDto, repair: any, runClass: LiveCaptureCanaryRunClass) {
  if (["robots_or_legal_hold", "unsafe_url", "unsupported_mime"].includes(row.failureClass)) return "hold";
  if (["burst_failure", "parser_regression"].includes(runClass)) return row.status === "captured" && !repair.needed ? "watch" : "rollback";
  if (row.status === "failed") return ["http_error", "rate_limited"].includes(row.failureClass) ? "watch" : "hold";
  if (row.status === "duplicate" || row.status === "stale" || repair.needed) return "watch";
  return row.parserConfidence >= 0.7 && row.replayId ? "promote" : "watch";
}

const versionFor = (a: LiveCaptureAdapterKind) => ({ rss_feed: "rss-adapter-v2", static_html: "static-web-adapter-v2", report_index: "report-index-live-capture-v1", public_advisory: "public-advisory-adapter-v1", pdf_report: "pdf-report-adapter-v1" }[a]);
const mimeAllowlistFor = (a: LiveCaptureAdapterKind) => ({ rss_feed: ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"], static_html: ["text/html", "application/xhtml+xml", "text/plain"], report_index: ["text/html", "application/xhtml+xml", "text/plain"], public_advisory: ["application/json", "application/rss+xml", "application/atom+xml", "application/xml", "text/xml"], pdf_report: ["application/pdf"] }[a]);
const confidence = (a: LiveCaptureAdapterKind, item?: CollectedItem) => !item ? 0 : a === "public_advisory" ? 0.78 : a === "pdf_report" ? 0.74 : a === "rss_feed" ? 0.72 : item.rawText.length > 200 ? 0.74 : 0.48;
const sourceFamily = (i: LiveCaptureRuntimeCaptureInput) => str(i.result.items[0]?.metadata.connectorFamily) || (i.adapter === "rss_feed" ? "rss_feed" : i.adapter === "static_html" ? (i.source.tags?.some((t) => /cert|government/i.test(t)) ? "cert_html" : "vendor_blog_html") : i.adapter === "report_index" ? "public_report_index" : str(i.source.metadata?.sourceFamily) || "public_advisory");
const fixtureClassFor = (r: LiveCaptureRuntimeRowDto): LiveCaptureFixtureClass => r.adapter === "rss_feed" ? "rss_atom" : r.adapter === "report_index" ? "report_index" : r.adapter === "static_html" && r.sourceId.toLowerCase().includes("cert") ? "cert_html" : r.adapter === "static_html" ? "vendor_blog_html" : r.agent06Handoff.sourceMetadata.connectorFamily === "github_advisory" ? "github_security_advisory" : r.agent06Handoff.sourceMetadata.connectorFamily === "cert_government" ? "cisa_kev" : "vendor_advisory_json";
const inferRun = (r: LiveCaptureRuntimeRowDto): LiveCaptureCanaryRunClass => ["http_error", "rate_limited"].includes(r.failureClass) ? "source_outage" : r.failureClass === "duplicate_content" ? "repeat_run" : r.parserConfidence < 0.65 || r.status === "failed" ? "parser_regression" : "first_run";
const canaryFixtureClassesFor = (r: LiveCaptureCanaryRowDto): LiveCaptureCanaryFixtureClass[] => [r.adapterFamily === "pdf_report" ? "pdf_text_layer_report" : "", r.parserRepair.category === "unsupported_mime" ? "unsupported_mime" : "", r.parserRepair.category === "unsafe_link_suppression" ? "hostile_unsafe_link_suppression" : ""].filter((v): v is LiveCaptureCanaryFixtureClass => Boolean(v));
const shortageRows = (rows: LiveCaptureCanaryRowDto[], mins: Record<string, number>) => Object.entries(mins).flatMap(([sourceFamily, required]) => { const observedPromotable = rows.filter((r) => r.adapterFamily === sourceFamily && r.canary.state === "promote").length; return observedPromotable < required ? [{ sourceFamily, required, observedPromotable }] : []; });
const claimIds = (sourceId: string, item?: CollectedItem) => !item ? [] : uniqueStrings([...item.rawText.matchAll(/\b(CVE-\d{4}-\d{4,}|APT\d{2}|Akira|LockBit|Lazarus|Turla|Sandworm|Volt Typhoon)\b/gi)].map((m) => m[0])).slice(0, 8).map((e) => `claim_candidate_${hashContent(`${sourceId}:${e}:${item.contentHash}`).slice(0, 16)}`);
const repairRecommendation = (c: ParserRepairCategory, row: LiveCaptureRuntimeRowDto) => c === "none" ? "parser healthy; no repair action" : c === "unsupported_mime" ? `add MIME guard or parser support for ${row.runtimeCaps.contentType ?? "unknown content type"}` : c.replaceAll("_", " ");
const count = (rows: LiveCaptureRuntimeRowDto[], status: LiveCaptureStatus) => rows.filter((r) => r.status === status).length;
const failureCounts = (rows: LiveCaptureRuntimeRowDto[]) => Object.fromEntries(FAILURES.map((f) => [f, rows.filter((r) => r.failureClass === f).length]));
const order = <T extends string>(order: T[], values: T[]) => order.filter((v) => values.includes(v));
const routeContract = (stableFields: string[]) => ({ safeForPublicApi: true, stableFields, forbiddenFields: forbiddenFields() });
const forbiddenFields = () => ["url", "canonicalUrl", "requestedUrl", "finalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "downloadUrl", "objectRef", "objectKey"];
const safetyDefaults = () => ({ publicOnly: true, disabledByDefaultForUnapprovedNetworkPaths: true, noPrivateGithubRepos: true, noAuthBypass: true, noCaptchaSolving: true, noPayloadDownloads: true, noLeakedDatasets: true, noUnsafeOnionContent: true, noCredentialCollection: true, unsafeUrlExposed: false });
const str = (v: unknown) => typeof v === "string" && v.length ? v : undefined;
const num = (v: unknown, key?: string) => { const candidate = key && typeof v === "object" && v ? (v as any)[key] : v; return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined; };
const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
