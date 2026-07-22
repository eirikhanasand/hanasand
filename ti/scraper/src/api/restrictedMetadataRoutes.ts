import { buildRestrictedMetadataApplyPlan, buildRestrictedMetadataCutoverReport, buildRestrictedMetadataOperationsStatus, DARKNET_METADATA_NETWORK_CONFIGS, restrictedMetadataApplyPlanApiContract, type ApprovedProxyBoundary, type DarknetNetwork, type RestrictedMetadataApplyAction, type RestrictedMetadataApplyPlan } from "../adapters/darknetMetadata.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";

export type RestrictedMetadataApplyPlanRequestDto = { sourceIds?: string[]; operatorId?: string; retentionExpiringWithinDays?: number; includeCutover?: boolean; actions?: string[] };
export type RestrictedMetadataApplyPlanRouteOptions = { store: ScraperStore; generatedAt?: string };
export type RestrictedMetadataStatusRequestDto = { sourceIds?: string[]; operatorId?: string; runId?: string };
export type RestrictedMetadataStatusRouteOptions = RestrictedMetadataApplyPlanRouteOptions;
export type RestrictedMetadataApplyPlanRouteResult = any;
const ACTIONS: RestrictedMetadataApplyAction[] = ["enable_metadata_only_queue", "disable_source", "renew_legal_notes", "approve_proxy_isolation", "apply_kill_switch", "shorten_retention", "keep_source_blocked"];

export function buildRestrictedMetadataApplyPlanRouteResponse(input: RestrictedMetadataApplyPlanRequestDto, options: RestrictedMetadataApplyPlanRouteOptions): RestrictedMetadataApplyPlanRouteResult {
  const invalidActions = (input.actions ?? []).filter((action) => !ACTIONS.includes(action as RestrictedMetadataApplyAction));
  if (invalidActions.length) return { ok: false, status: 400, code: "invalid_action", message: "Unsupported restricted-metadata apply-plan action", details: { allowedActions: ACTIONS, invalidActions } };
  const generatedAt = options.generatedAt ?? nowIso(), sources = selected(options.store, input.sourceIds), proxyBoundaries = proxyBoundariesForSources(sources), scheduler = { queuedSourceIds: sources.filter(isExecutableSource).map((source: SourceRecord) => source.id) };
  const plan = buildRestrictedMetadataApplyPlan({ sources, proxyBoundaries, scheduler, generatedAt, operatorId: input.operatorId, retentionExpiringWithinDays: input.retentionExpiringWithinDays });
  const selectedActions = new Set((input.actions ?? []) as RestrictedMetadataApplyAction[]);
  const applyPlan = apiSafe(selectedActions.size ? summarize({ ...plan, actions: plan.actions.filter((action: any) => selectedActions.has(action.action)) }) : plan);
  return { ok: true, body: { contract: restrictedMetadataApplyPlanApiContract(), applyPlan, cutoverReport: input.includeCutover ? buildRestrictedMetadataCutoverReport({ sources, proxyBoundaries, scheduler, generatedAt, retentionExpiringWithinDays: input.retentionExpiringWithinDays }) : undefined } };
}

export function buildRestrictedMetadataStatusRouteResponse(input: RestrictedMetadataStatusRequestDto, options: RestrictedMetadataStatusRouteOptions) {
  const generatedAt = options.generatedAt ?? nowIso(), sources = selected(options.store, input.sourceIds);
  const intelligenceSources = sources.filter((source: SourceRecord) => source.metadata?.transportCanary !== true && isExecutableSource(source));
  const sourceIds = new Set(intelligenceSources.map((source: SourceRecord) => source.id));
  const captures = options.store.listCaptures().filter((capture: any) => sourceIds.has(capture.sourceId));
  const backedOffSourceCount = intelligenceSources.filter((source: SourceRecord) => {
    const until = source.crawlState?.backoffUntil;
    return typeof until === "string" && Date.parse(until) > Date.parse(generatedAt);
  }).length;
  return { ok: true as const, body: {
    status: redactRestrictedOutput(buildRestrictedMetadataOperationsStatus({ sources: intelligenceSources, captures, proxyBoundaries: proxyBoundariesForSources(intelligenceSources), generatedAt, operatorId: input.operatorId, runId: input.runId })),
    coverage: {
      intelligenceSourceCount: intelligenceSources.length,
      usefulSourceCount: intelligenceSources.filter((source: SourceRecord) => Boolean(source.health?.lastUsefulAt)).length,
      backedOffSourceCount,
      candidateSourceCount: sources.filter((source: SourceRecord) => source.metadata?.transportCanary !== true && source.status === "candidate").length,
      rejectedSourceCount: sources.filter((source: SourceRecord) => source.status === "rejected" || source.status === "retired").length,
      transportProbeCount: sources.filter((source: SourceRecord) => source.metadata?.transportCanary === true).length
    }
  } };
}

function selected(store: ScraperStore, sourceIds?: string[]): SourceRecord[] { const ids = new Set(sourceIds ?? []); return store.listSources().filter((source: SourceRecord) => source.type.endsWith("_metadata")).filter((source: SourceRecord) => !ids.size || ids.has(source.id)); }
function summarize(plan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan { const count = (safety: string) => plan.actions.filter((a: any) => a.safety === safety).length; return { ...plan, summary: { automation_safe: count("automation_safe"), human_approval_required: count("human_approval_required"), blocked: count("blocked"), rollback_only: count("rollback_only") } }; }
function apiSafe(plan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan { return redactRestrictedOutput({ ...plan, analystOperations: { ...plan.analystOperations, packets: plan.analystOperations.packets.map((p: any) => ({ ...p, whatWasNotAccessed: (p.whatWasNotAccessed ?? []).map((v: string) => v === "raw leaked files" ? "restricted files" : v) })) } }); }
function proxyBoundariesForSources(sources: readonly SourceRecord[]): Partial<Record<DarknetNetwork, ApprovedProxyBoundary>> { return Object.fromEntries([...new Set(sources.map(networkForSource).filter(Boolean) as DarknetNetwork[])].map((network) => [network, boundary(network)])); }
function boundary(network: DarknetNetwork): ApprovedProxyBoundary { const config = DARKNET_METADATA_NETWORK_CONFIGS[network], id = `${network}-approved-metadata-proxy`; return { id, network, accessMethod: "approved_proxy", config: { ...config, proxyBoundaryId: id }, health: { boundaryId: id, network, proxyType: config.proxyType, isolationId: `${network}:${id}:metadata-only`, healthy: true, checkedAt: nowIso(), timeoutClass: config.timeoutClass, resolutionFailure: "none", fetchFailure: "none", screenshotHashMode: config.screenshotHashMode }, async fetchMetadata() { return {}; } }; }
function networkForSource(source: SourceRecord): DarknetNetwork | undefined { return source.type === "tor_metadata" ? "tor" : source.type === "i2p_metadata" ? "i2p" : source.type === "freenet_metadata" ? "freenet" : undefined; }
function redactRestrictedOutput(value: any): any {
  if (Array.isArray(value)) return value.map(redactRestrictedOutput);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "targetUrl" && key !== "url").map(([key, child]) => [key, redactRestrictedOutput(child)]));
  return typeof value === "string" ? value.replace(/\b(?:https?:\/\/)?[a-z2-7]{56}\.onion(?:\/[^\s"']*)?/gi, "[restricted-locator]") : value;
}
