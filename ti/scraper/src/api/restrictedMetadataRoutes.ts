import { buildRestrictedMetadataApplyPlan, buildRestrictedMetadataCutoverReport, buildRestrictedMetadataOperationsStatus, DARKNET_METADATA_NETWORK_CONFIGS, restrictedMetadataApplyPlanApiContract, type ApprovedProxyBoundary, type DarknetNetwork, type RestrictedMetadataApplyAction, type RestrictedMetadataApplyPlan } from "../adapters/darknetMetadata.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export type RestrictedMetadataApplyPlanRequestDto = { sourceIds?: string[]; operatorId?: string; retentionExpiringWithinDays?: number; includeCutover?: boolean; actions?: string[] };
export type RestrictedMetadataApplyPlanRouteOptions = { store: ScraperStore; generatedAt?: string };
export type RestrictedMetadataStatusRequestDto = { sourceIds?: string[]; operatorId?: string; runId?: string };
export type RestrictedMetadataStatusRouteOptions = RestrictedMetadataApplyPlanRouteOptions;
export type RestrictedMetadataApplyPlanRouteResult = any;
const ACTIONS: RestrictedMetadataApplyAction[] = ["enable_metadata_only_queue", "disable_source", "renew_legal_notes", "approve_proxy_isolation", "apply_kill_switch", "shorten_retention", "keep_source_blocked"];

export function buildRestrictedMetadataApplyPlanRouteResponse(input: RestrictedMetadataApplyPlanRequestDto, options: RestrictedMetadataApplyPlanRouteOptions): RestrictedMetadataApplyPlanRouteResult {
  const invalidActions = (input.actions ?? []).filter((action) => !ACTIONS.includes(action as RestrictedMetadataApplyAction));
  if (invalidActions.length) return { ok: false, status: 400, code: "invalid_action", message: "Unsupported restricted-metadata apply-plan action", details: { allowedActions: ACTIONS, invalidActions } };
  const generatedAt = options.generatedAt ?? nowIso(), sources = selected(options.store, input.sourceIds), proxyBoundaries = proxyBoundariesForSources(sources), scheduler = { queuedSourceIds: sources.filter(canPreviewMetadataOnlyQueue).map((s) => s.id) };
  const plan = buildRestrictedMetadataApplyPlan({ sources, proxyBoundaries, scheduler, generatedAt, operatorId: input.operatorId, retentionExpiringWithinDays: input.retentionExpiringWithinDays });
  const selectedActions = new Set((input.actions ?? []) as RestrictedMetadataApplyAction[]);
  const applyPlan = apiSafe(selectedActions.size ? summarize({ ...plan, actions: plan.actions.filter((action: any) => selectedActions.has(action.action)) }) : plan);
  return { ok: true, body: { contract: restrictedMetadataApplyPlanApiContract(), applyPlan, cutoverReport: input.includeCutover ? buildRestrictedMetadataCutoverReport({ sources, proxyBoundaries, scheduler, generatedAt, retentionExpiringWithinDays: input.retentionExpiringWithinDays }) : undefined } };
}

export function buildRestrictedMetadataStatusRouteResponse(input: RestrictedMetadataStatusRequestDto, options: RestrictedMetadataStatusRouteOptions) {
  const generatedAt = options.generatedAt ?? nowIso(), sources = selected(options.store, input.sourceIds);
  return { ok: true as const, body: { status: buildRestrictedMetadataOperationsStatus({ sources, captures: options.store.listCaptures(), proxyBoundaries: proxyBoundariesForSources(sources), generatedAt, operatorId: input.operatorId, runId: input.runId }) } };
}

function selected(store: ScraperStore, sourceIds?: string[]) { const ids = new Set(sourceIds ?? []); return store.listSources().filter((s) => s.type.endsWith("_metadata")).filter((s) => !ids.size || ids.has(s.id)); }
function summarize(plan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan { const count = (safety: string) => plan.actions.filter((a: any) => a.safety === safety).length; return { ...plan, summary: { automation_safe: count("automation_safe"), human_approval_required: count("human_approval_required"), blocked: count("blocked"), rollback_only: count("rollback_only") } }; }
function apiSafe(plan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan { return { ...plan, analystOperations: { ...plan.analystOperations, packets: plan.analystOperations.packets.map((p: any) => ({ ...p, whatWasNotAccessed: (p.whatWasNotAccessed ?? []).map((v: string) => v === "raw leaked files" ? "restricted files" : v) })) } }; }
function proxyBoundariesForSources(sources: readonly SourceRecord[]): Partial<Record<DarknetNetwork, ApprovedProxyBoundary>> { return Object.fromEntries([...new Set(sources.map(networkForSource).filter(Boolean) as DarknetNetwork[])].map((network) => [network, boundary(network)])); }
function boundary(network: DarknetNetwork): ApprovedProxyBoundary { const config = DARKNET_METADATA_NETWORK_CONFIGS[network], id = `${network}-approved-metadata-proxy`; return { id, network, accessMethod: "approved_proxy", config: { ...config, proxyBoundaryId: id }, health: { boundaryId: id, network, proxyType: config.proxyType, isolationId: `${network}:${id}:metadata-only`, healthy: true, checkedAt: nowIso(), timeoutClass: config.timeoutClass, resolutionFailure: "none", fetchFailure: "none", screenshotHashMode: config.screenshotHashMode }, async fetchMetadata() { return {}; } }; }
function networkForSource(source: SourceRecord): DarknetNetwork | undefined { return source.type === "tor_metadata" ? "tor" : source.type === "i2p_metadata" ? "i2p" : source.type === "freenet_metadata" ? "freenet" : undefined; }
function canPreviewMetadataOnlyQueue(source: SourceRecord): boolean { return source.status === "active" && source.accessMethod === "approved_proxy" && source.governance?.approvalState === "approved" && source.governance.metadataOnly === true && Boolean(source.governance.approvedAt) && Boolean(source.governance.approvedBy); }
