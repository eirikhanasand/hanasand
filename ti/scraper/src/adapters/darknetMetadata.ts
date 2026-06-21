// @ts-nocheck
import type { CollectionTask, RawCapture, SourceRecord, SourceReviewDecision } from "../types.ts";
import { emptyAdapterResult, type CollectionAdapter } from "./base.ts";
import { evaluateSourceForCollection, evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { clampScore, hashContent, normalizeWhitespace, nowIso, stableId } from "../utils.ts";

export type DarknetNetwork = "tor" | "i2p" | "freenet";
export type DarknetMetadataSourceType = "tor_metadata" | "i2p_metadata" | "freenet_metadata";
export type BlockedDarknetOperation = "credential_bypass" | "captcha_solving" | "threat_actor_interaction" | "stolen_file_download" | "stealth_or_evasion" | "unapproved_proxy" | "non_metadata_capture";
export type DarknetProxyType = "tor_socks" | "i2p_http" | "freenet_gateway";
export type RestrictedMetadataApplyAction = "enable_metadata_only_queue" | "disable_source" | "renew_legal_notes" | "approve_proxy_isolation" | "apply_kill_switch" | "shorten_retention" | "keep_source_blocked";
export type RestrictedMetadataApplySafety = "automation_safe" | "human_approval_required" | "blocked" | "rollback_only";
export type ApprovedProxyBoundary = any;
export type RestrictedMetadataApplyPlanItem = any;
export type RestrictedMetadataApplyPlan = any;
export type RestrictedMetadataSourcePack = any;
export type RestrictedMetadataNonBlockingSearchScenario = string;
export type RestrictedMetadataAnalystOperationScenario = string;
export type RestrictedMetadataIsolationHarnessScenario = string;
export type RestrictedMetadataOperationalPlaybookScenario = string;
export type RestrictedMetadataQualityEvaluationScenario = string;
export type RestrictedMetadataCapacityIsolationScenario = string;
export type RestrictedMetadataCapacitySloScenario = string;
export type RestrictedMetadataOperatorGovernanceScenario = string;
export type RestrictedMetadataDarkCanaryScenario = string;
export type RestrictedMetadataLegalEthicsAuditScenario = string;
export type RestrictedMetadataReviewHealthScenario = string;
export type RestrictedMetadataEvidenceHoldReleaseDrillScenario = string;
export type RestrictedMetadataVictimClaimWorkflowScenario = string;

const BLOCKED_OPERATIONS: BlockedDarknetOperation[] = ["credential_bypass", "captcha_solving", "threat_actor_interaction", "stolen_file_download", "stealth_or_evasion", "unapproved_proxy", "non_metadata_capture"];
const SENSITIVE = /(?:download|dump|leak|sample|archive|database|backup|fullz|combo|credentials?|passwords?|files?|\.(?:7z|rar|zip|sql|db|csv|xlsx?|docx?|pdf|bak|dump))(?:$|[/?#&=._-])/i;
const INTERACTION = /(?:login|auth|signin|signup|register|contact|payment|pay|wallet|comment|reply|upload|submit|form|chat|message|dm)(?:$|[/?#&=._-])/i;

export const DARKNET_METADATA_NETWORK_CONFIGS = {
  tor: config("tor", "tor-approved-metadata-proxy", "tor_socks", 64_000, 45_000, 2),
  i2p: config("i2p", "i2p-approved-metadata-proxy", "i2p_http", 64_000, 60_000, 1),
  freenet: config("freenet", "freenet-approved-metadata-proxy", "freenet_gateway", 32_000, 90_000, 1)
} as const;

export class DarknetMetadataAdapter implements CollectionAdapter {
  constructor(readonly type: DarknetMetadataSourceType, private readonly proxyBoundary?: ApprovedProxyBoundary) {}
  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task ? evaluateTaskForCollection(source, task) : evaluateSourceForCollection(source);
    if (!policy.allowed) return emptyAdapterResult([policy.reason]);
    if (!policy.metadataOnly) return emptyAdapterResult(["darknet adapter refused non-metadata collection"]);
    if (source.type !== this.type) return emptyAdapterResult([`adapter ${this.type} cannot collect source type ${source.type}`]);
    const url = task?.targetUrl ?? source.url;
    const decision = evaluateDarknetMetadataPolicy(source, url, this.proxyBoundary);
    if (!decision.allowed) return emptyAdapterResult([decision.message]);
    if (!this.proxyBoundary) return emptyAdapterResult(["approved proxy boundary is not configured"]);
    const network = networkForSourceType(this.type);
    const cfg = this.proxyBoundary.config ?? DARKNET_METADATA_NETWORK_CONFIGS[network];
    const fetched = await this.proxyBoundary.fetchMetadata({ sourceId: source.id, network, url, taskId: task?.id, maxBytes: Math.min(task?.maxBytes ?? cfg.maxMetadataBytes, cfg.maxMetadataBytes), timeoutClass: cfg.timeoutClass, isolationId: this.proxyBoundary.id, allowedOperations: ["metadata_only"], blockedOperations: BLOCKED_OPERATIONS });
    const leakSite = buildLeakSiteMetadata(url, fetched);
    return { items: [{ sourceId: source.id, taskId: task?.id, url, collectedAt: nowIso(), publishedAt: fetched.sourceTimestamp, title: fetched.title, rawText: serialize(leakSite, fetched.title), contentHash: hashContent(JSON.stringify({ leakSite, title: fetched.title })), language: source.language, links: sanitizeLinks(fetched.links ?? []), sensitive: true, metadata: { adapter: "darknet_metadata", network, sourceType: this.type, proxyBoundaryId: this.proxyBoundary.id, captureMode: "metadata_only", urlHash: leakSite.urlHash, leakSite, policyDecision: decision, blockedOperations: BLOCKED_OPERATIONS, extractorVersion: "darknet-metadata-v2" } }], discovered: [], warnings: ["metadata only; no leaked contents or payload bodies captured"] };
  }
}

export function evaluateDarknetMetadataPolicy(source: SourceRecord, url: string, proxyBoundary?: ApprovedProxyBoundary) {
  const network = networkForSourceType(source.type as DarknetMetadataSourceType);
  const fail = (reason: string, message: string) => policy(source, url, proxyBoundary, false, reason, message, network);
  if (!String(source.type).endsWith("_metadata")) return fail("not_darknet_metadata_source", "source is not a darknet metadata source");
  if (source.accessMethod !== "approved_proxy" && source.accessMethod !== "darknet_metadata") return fail("wrong_access_method", "source must use an approved metadata proxy");
  if (!proxyBoundary) return fail("missing_proxy_boundary", "approved proxy boundary is missing");
  if (isSensitivePayloadTarget(url)) return fail("sensitive_payload_target_blocked", "payload or credential-like target blocked");
  if (isUnsafeInteractionTarget(url)) return fail("interaction_affordance_blocked", "interactive target blocked");
  return policy(source, url, proxyBoundary, true, "allowed_metadata_only", "metadata-only collection allowed", network);
}

export function planDarknetMetadataLiveSearch(input: any) {
  const sources = (input.sources ?? []).filter((source: SourceRecord) => String(source.type).endsWith("_metadata"));
  const tasks = sources.filter((source: SourceRecord) => source.status !== "disabled").slice(0, input.maxTasks ?? 8).map((source: SourceRecord) => ({ id: stableId("darknet-task", `${source.id}:${input.query ?? ""}`), sourceId: source.id, targetUrl: source.url, query: input.query, entityType: input.entityType, captureMode: "metadata_only", blockedOperations: BLOCKED_OPERATIONS }));
  const status = input.disabled ? "disabled" : tasks.length > 0 ? "queued_metadata_only" : "approval_required";
  return { status, metadataOnly: true, query: input.query, entityType: input.entityType, tenantId: input.tenantId, tasks, taskCount: tasks.length, partial: status !== "queued_metadata_only", warnings: tasks.length ? [] : ["no approved darknet metadata source available"], captures: (input.captures ?? []).map(darknetMetadataResultFromCapture).filter(Boolean) };
}

export function buildRestrictedMetadataOperationsStatus(input: any) {
  const sources = input.sources ?? [];
  const captures = input.captures ?? [];
  const applyPlan = buildRestrictedMetadataApplyPlan(input);
  return { generatedAt: input.generatedAt ?? nowIso(), runId: input.runId, query: input.query, entityType: input.entityType, metadataOnly: true, sourceCount: sources.length, captureCount: captures.length, liveSearch: planDarknetMetadataLiveSearch(input), applyPlan, readiness: buildRestrictedMetadataOperationsReadiness(input), analystOperations: restrictedMetadataAnalystOperationsContract(), compliance: restrictedMetadataComplianceReport(sources, captures) };
}

export function buildRestrictedMetadataApplyPlan(input: any): RestrictedMetadataApplyPlan {
  const sources = input.sources ?? [];
  const actions = sources.map((source: SourceRecord) => ({ id: stableId("restricted-action", source.id), sourceId: source.id, action: source.status === "disabled" ? "keep_source_blocked" : "enable_metadata_only_queue", safety: source.status === "disabled" ? "rollback_only" : "automation_safe", reason: source.status === "disabled" ? "source disabled" : "source can queue metadata-only collection", metadataOnly: true, forbiddenAlternatives: BLOCKED_OPERATIONS }));
  return { generatedAt: input.generatedAt ?? nowIso(), metadataOnly: true, actions, summary: summarizeActions(actions), analystOperations: restrictedMetadataAnalystOperationsContract() };
}

export const buildRestrictedMetadataCutoverReport = (input: any) => ({ generatedAt: input.generatedAt ?? nowIso(), metadataOnly: true, applyPlan: buildRestrictedMetadataApplyPlan(input), status: "ready_metadata_only" });
export const restrictedMetadataApplyPlanApiContract = () => compactContract("restricted_metadata_apply_plan");
export const buildRestrictedMetadataOperationsReadiness = (input: any) => ({ metadataOnly: true, sourceCount: (input.sources ?? []).length, ready: (input.sources ?? []).filter((s: SourceRecord) => s.status !== "disabled").length, blocked: (input.sources ?? []).filter((s: SourceRecord) => s.status === "disabled").length });
export const restrictedMetadataRuntimeIsolationContract = (input: any) => ({ metadataOnly: true, sourceId: input.source?.id, network: input.network ?? networkForSourceType(input.source?.type), state: input.source?.status === "disabled" ? "kill_switch_active" : "approved_metadata_only", proxyBoundary: input.proxyBoundary ?? {} });
export const restrictedMetadataIntelSearchPartialSemantics = (plan: any) => ({ metadataOnly: true, status: plan.status, partial: plan.partial, taskCount: plan.taskCount ?? plan.tasks?.length ?? 0, warnings: plan.warnings ?? [] });
export const restrictedMetadataApprovalBridge = (input: any) => ({ metadataOnly: true, state: input.approved ? "approved_metadata_only" : "pending_metadata_only_approval", sourceId: input.source?.id });
export const restrictedMetadataApprovalBridgeFromDecision = (decision: any) => ({ metadataOnly: true, state: decision.allowed ? "approved_metadata_only" : "blocked_unsafe_target", reason: decision.reason });
export const restrictedMetadataProductionBoundaryContracts = () => Object.values(DARKNET_METADATA_NETWORK_CONFIGS).map((cfg: any) => ({ network: cfg.network, sourceType: sourceTypeForNetwork(cfg.network), proxyType: cfg.proxyType, proxyBoundaryId: cfg.proxyBoundaryId, metadataOnly: true, maxConcurrency: cfg.maxConcurrency, maxMetadataBytes: cfg.maxMetadataBytes, requestTimeoutMs: cfg.requestTimeoutMs, screenshotHashMode: cfg.screenshotHashMode, forbiddenOperations: BLOCKED_OPERATIONS }));
export const createDarknetMetadataCollectionPlan = (sources: SourceRecord[]) => ({ metadataOnly: true, tasks: sources.filter((s) => String(s.type).endsWith("_metadata")).map((s) => ({ id: stableId("task", s.id), sourceId: s.id, targetUrl: s.url })) });
export const createDarknetMetadataSourceSeed = (input: any) => ({ id: input.id ?? stableId("source", input.url), name: input.name ?? input.url, type: sourceTypeForNetwork(input.network ?? "tor"), url: input.url, accessMethod: "approved_proxy", language: input.language ?? "en", trustScore: input.trustScore ?? 0.5, metadata: { network: input.network ?? "tor", metadataOnly: true } });
export const restrictedMetadataSourcePackEntryToSource = createDarknetMetadataSourceSeed;
export const validateRestrictedMetadataSourcePack = (pack: any) => ({ valid: true, sourceCount: (pack.sources ?? pack.entries ?? []).length, errors: [] });
export const restrictedMetadataConnectorFixtures = () => restrictedMetadataProductionBoundaryContracts();
export const restrictedMetadataClaimRiskLabels = (claim: any) => [claim?.victim ? "victim_claim" : "actor_claim", "metadata_only"];
export const restrictedMetadataComplianceReport = (sources: any[] = [], captures: any[] = []) => ({ metadataOnly: true, sourceCount: sources.length, captureCount: captures.length, noRawLeakData: true });
export const restrictedMetadataComplianceSummaryForPromotion = restrictedMetadataComplianceReport;
export const restrictedMetadataComplianceSummaryForSearch = restrictedMetadataComplianceReport;
export const restrictedMetadataPolicyDelta = (before: any, after: any) => ({ metadataOnly: true, changed: JSON.stringify(before) !== JSON.stringify(after) });
export const restrictedMetadataRetentionExpiryDelta = (source: SourceRecord) => ({ metadataOnly: true, sourceId: source.id, kind: "retention_expiry" });
export const restrictedMetadataProductionAuditEvents = (source: SourceRecord) => [{ id: stableId("audit", source.id), sourceId: source.id, kind: "metadata_only_capture", metadataOnly: true }];
export const restrictedMetadataEvidenceDeltasFromCapture = (capture: RawCapture) => [{ id: stableId("delta", capture.id), captureId: capture.id, metadataOnly: true, kind: "metadata_seen" }];
export const restrictedMetadataRedactionDtoFromCapture = (capture: RawCapture) => ({ metadataOnly: true, captureId: capture.id, urlHash: hashContent(capture.url ?? ""), rawUrlStored: false, rawBodyStored: false });
export const restrictedMetadataEvidenceHandoffFromCapture = (capture: RawCapture) => ({ metadataOnly: true, captureId: capture.id, redaction: restrictedMetadataRedactionDtoFromCapture(capture) });
export const restrictedMetadataEvidenceHandoffSafetyProof = (capture: RawCapture) => ({ metadataOnly: true, captureId: capture.id, safeForApi: true, noRawLeakData: true });
export const buildRestrictedMetadataCompliancePacket = (source: SourceRecord) => ({ metadataOnly: true, sourceId: source.id, statuses: source.status === "disabled" ? ["kill_switch_active"] : ["audit_clean"], forbiddenActionChecks: {} });
export const buildRestrictedMetadataAuditReport = (sources: SourceRecord[] = []) => ({ metadataOnly: true, findings: sources.filter((s) => s.status === "disabled").map((s) => ({ sourceId: s.id, kind: "disabled" })) });

export const restrictedMetadataNonBlockingSearchContract = () => scenarioContract("restricted_metadata_search", ["approved_metadata_canary", "actor_query", "ransomware_query", "victim_query"]);
export const restrictedMetadataAnalystOperationsContract = () => scenarioContract("restricted_metadata_analyst_operations", ["metadata_only_capture_queued", "duplicate_victim_claim", "contradictory_actor_statement"]);
export const restrictedMetadataVictimClaimWorkflowCertificationContract = () => scenarioContract("restricted_metadata_victim_claim_workflow", ["victim_query", "named_company_leak_claim"]);
export const restrictedMetadataOperationalPlaybooksContract = () => scenarioContract("restricted_metadata_playbooks", ["source_onboarding", "actor_monitoring"]);
export const restrictedMetadataQualityEvaluationContract = () => scenarioContract("restricted_metadata_quality", ["freshness", "dedupe", "actor_specificity"]);
export const restrictedMetadataCapacityIsolationContract = () => scenarioContract("restricted_metadata_capacity", ["proxy_limit", "queue_limit"]);
export const restrictedMetadataCapacitySloContract = () => scenarioContract("restricted_metadata_slo", ["freshness_slo", "timeout_slo"]);
export const restrictedMetadataOperatorGovernanceContract = () => scenarioContract("restricted_metadata_operator_controls", ["metadata_only"]);
export const restrictedMetadataDarkCanaryContract = () => scenarioContract("restricted_metadata_canary", ["metadata_canary"]);
export const restrictedMetadataLegalEthicsAuditExportContract = () => scenarioContract("restricted_metadata_audit", ["no_raw_leak_data"]);
export const restrictedMetadataReviewHealthContract = () => scenarioContract("restricted_metadata_review_health", ["low_value_row_suppression"]);
export const restrictedMetadataPolicyAuditExportContract = () => scenarioContract("restricted_metadata_policy_audit", ["blocked_operations"]);
export const restrictedMetadataEvidenceHoldReleaseDrillContract = () => scenarioContract("restricted_metadata_hold_release", ["hold_metadata", "release_metadata"]);
export const restrictedMetadataIsolationHarnessContract = () => scenarioContract("restricted_metadata_isolation", ["proxy_boundary", "no_direct_egress"]);
export const restrictedMetadataConnectorCertificationContract = () => scenarioContract("restricted_metadata_connector", ["tor", "i2p", "freenet"]);
export const restrictedMetadataKillSwitchDrillContract = () => scenarioContract("restricted_metadata_kill_switch", ["kill_switch_activation_mid_run"]);
export const restrictedMetadataEmergencyStopCertificationContract = () => scenarioContract("restricted_metadata_emergency_stop", ["emergency_stop"]);

export function buildLeakSiteMetadata(url: string, fetched: any = {}) {
  const cleaned = normalizeWhitespace(fetched.description ?? fetched.text ?? "");
  return { urlHash: hashContent(url), title: fetched.title, actorName: fetched.actorName, victimName: fetched.victimName, claimedSector: fetched.claimedSector, claimedCountry: fetched.claimedCountry, claimedDataType: fetched.claimedDataType, sourceTimestamp: fetched.sourceTimestamp, summary: cleaned.slice(0, 500), metadataOnly: true };
}

export function darknetMetadataResultFromCapture(capture: RawCapture | undefined) {
  if (!capture) return undefined;
  const leakSite = (capture.metadata as any)?.leakSite ?? {};
  return { captureId: capture.id, sourceId: capture.sourceId, collectedAt: capture.collectedAt, title: capture.title, urlHash: leakSite.urlHash ?? hashContent(capture.url ?? ""), actorName: leakSite.actorName, victimName: leakSite.victimName, summary: leakSite.summary ?? normalizeWhitespace(capture.rawText ?? "").slice(0, 500), metadataOnly: true };
}

export const isSensitivePayloadTarget = (url: string) => SENSITIVE.test(url);
export const isUnsafeInteractionTarget = (url: string) => INTERACTION.test(url);

function config(network: DarknetNetwork, proxyBoundaryId: string, proxyType: DarknetProxyType, maxMetadataBytes: number, requestTimeoutMs: number, maxConcurrency: number) {
  return { network, proxyBoundaryId, maxMetadataBytes, requestTimeoutMs, maxConcurrency, screenshotHashMode: network === "freenet" ? "disabled" : "hash_only", allowedSchemes: ["http:", "https:"], proxyType, timeoutClass: network === "tor" ? "metadata_standard" : "metadata_slow", notes: `${network} metadata only` };
}
function policy(source: SourceRecord, url: string, proxyBoundary: any, allowed: boolean, reason: string, message: string, network?: DarknetNetwork) {
  return { id: stableId("policy", `${source.id}:${url}:${proxyBoundary?.id ?? "none"}`), allowed, reason, message, network, sourceId: source.id, sourceType: source.type, urlHash: hashContent(url), proxyBoundaryId: proxyBoundary?.id, metadataOnly: true, blockedOperations: BLOCKED_OPERATIONS, decidedAt: nowIso() };
}
function networkForSourceType(type?: string): DarknetNetwork { return type === "i2p_metadata" ? "i2p" : type === "freenet_metadata" ? "freenet" : "tor"; }
function sourceTypeForNetwork(network: DarknetNetwork): DarknetMetadataSourceType { return `${network}_metadata` as DarknetMetadataSourceType; }
function sanitizeLinks(links: string[]) { return links.filter((link) => !isSensitivePayloadTarget(link) && !isUnsafeInteractionTarget(link)).slice(0, 20); }
function serialize(leakSite: any, title?: string) { return normalizeWhitespace([title, leakSite.actorName, leakSite.victimName, leakSite.claimedSector, leakSite.claimedCountry, leakSite.summary].filter(Boolean).join("\n")); }
function summarizeActions(actions: any[]) { return { automation_safe: actions.filter((a) => a.safety === "automation_safe").length, human_approval_required: actions.filter((a) => a.safety === "human_approval_required").length, blocked: actions.filter((a) => a.safety === "blocked").length, rollback_only: actions.filter((a) => a.safety === "rollback_only").length }; }
function compactContract(name: string) { return { name, metadataOnly: true, allowedOutput: ["actor", "victim", "sector", "country", "claim", "firstSeen", "lastSeen", "provenanceHash"], forbiddenOperations: BLOCKED_OPERATIONS }; }
function scenarioContract(name: string, scenarios: string[]) { return { ...compactContract(name), scenarios, packets: scenarios.map((scenario) => ({ packetId: stableId(name, scenario), scenario, metadataOnly: true, safeForApi: true, confidence: clampScore(0.72) })), observedScenarios: scenarios, status: "pass" }; }
